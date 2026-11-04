import assert from "node:assert/strict";
import test from "node:test";
import {randomUUID} from "node:crypto";
import {bootstrapAccount} from "../api/src/services/account.ts";
import {acquireSession,heartbeatSession,releaseSession} from "../api/src/services/session.ts";
import {CosmosGameRepository,databaseError} from "../api/src/repository.ts";
import {ApiError,RepositoryConflict} from "../api/src/errors.ts";
import {activeAccount,fakeClock,identity,InMemoryGameRepository} from "./cloud-test-support.mjs";

test("simultaneous first logins create exactly one account and run",async()=>{
 const repo=new InMemoryGameRepository(),id=identity(),now=fakeClock();
 const [a,b]=await Promise.all([bootstrapAccount(id,repo,now),bootstrapAccount(id,repo,now)]);
 assert.equal(a.current.runId,b.current.runId);assert.equal(repo.docs.size,4);
 assert.equal(a.best,null);assert.equal(a.lease.sessionId,null);
});
test("bootstrap is read-only for an existing account and does not acquire a lease",async()=>{
 const a=await activeAccount();const before=a.repo.snapshot(),calls=a.repo.commitCalls;
 const b=await bootstrapAccount(a.id,a.repo,a.now);
 assert.equal(b.current.runId,a.bootstrap.current.runId);assert.equal(a.repo.commitCalls,calls);assert.deepEqual(a.repo.snapshot(),before);
});
test("read failures and partial accounts never recreate defaults",async()=>{
 const repo=new InMemoryGameRepository(),now=fakeClock(),id=identity();
 repo.failRead=new ApiError(503,"UNAVAILABLE","offline");
 await assert.rejects(()=>bootstrapAccount(id,repo,now),e=>e.status===503);assert.equal(repo.commitCalls,0);
 repo.failRead=null;await bootstrapAccount(id,repo,now);
 repo.docs.delete(repo.key(id.playerId,"best"));const count=repo.commitCalls;
 await assert.rejects(()=>bootstrapAccount(id,repo,now),e=>e.status===503);assert.equal(repo.commitCalls,count);
});
test("accounts with identical nicknames remain in separate partitions",async()=>{
 const repo=new InMemoryGameRepository(),now=fakeClock(),a=identity(),b=identity(randomUUID());
 const first=await bootstrapAccount(a,repo,now),second=await bootstrapAccount(b,repo,now);
 assert.notEqual(first.current.runId,second.current.runId);assert.equal(repo.docs.size,8);
});
test("a second active tab cannot take ownership without explicit takeover",async()=>{
 const a=await activeAccount(),before=a.repo.snapshot();
 await assert.rejects(()=>acquireSession(a.id,{requestId:randomUUID(),sessionId:randomUUID(),takeover:false},a.repo,a.now),e=>e.code==="SESSION_CONFLICT");
 assert.deepEqual(a.repo.snapshot(),before);
});
test("explicit takeover fences the old writer's heartbeat and release",async()=>{
 const a=await activeAccount();
 const b=await acquireSession(a.id,{requestId:randomUUID(),sessionId:randomUUID(),takeover:true},a.repo,a.now);
 assert.equal(b.lease.generation,a.lease.generation+1);
 await assert.rejects(()=>heartbeatSession(a.id,a.lease,a.repo,a.now),e=>e.code==="SESSION_LOST");
 await assert.rejects(()=>releaseSession(a.id,a.lease,a.repo,a.now),e=>e.code==="SESSION_LOST");
 assert.equal((await a.repo.readAccount(a.id)).session.value.sessionId,b.lease.sessionId);
});
test("an expired owner can renew only while its generation is still current",async()=>{
 const a=await activeAccount();a.now.advance(61000);
 const renewed=await heartbeatSession(a.id,a.lease,a.repo,a.now);
 assert.equal(Date.parse(renewed.expiresAt),a.now().getTime()+60000);
 a.now.advance(61000);
 await acquireSession(a.id,{requestId:randomUUID(),sessionId:randomUUID(),takeover:false},a.repo,a.now);
 await assert.rejects(()=>heartbeatSession(a.id,a.lease,a.repo,a.now),e=>e.code==="SESSION_LOST");
});
test("acquire retry is idempotent and conflicting request reuse is rejected",async()=>{
 const a=await activeAccount(),request={requestId:randomUUID(),sessionId:a.sessionId,takeover:false};
 const first=await acquireSession(a.id,request,a.repo,a.now);
 a.now.advance(1000);const second=await acquireSession(a.id,request,a.repo,a.now);
 assert.equal(first.current.version,second.current.version);assert.equal(first.lease.generation,second.lease.generation);
 await assert.rejects(()=>acquireSession(a.id,{...request,takeover:true},a.repo,a.now),e=>e.code==="REQUEST_REUSED");
 await acquireSession(a.id,{requestId:randomUUID(),sessionId:randomUUID(),takeover:true},a.repo,a.now);
 await assert.rejects(()=>acquireSession(a.id,request,a.repo,a.now),e=>e.code==="SESSION_LOST");
});
test("release affects only the matching owner and preserves progress",async()=>{
 const a=await activeAccount(),before=a.bootstrap.current;
 await releaseSession(a.id,a.lease,a.repo,a.now);
 const after=await bootstrapAccount(a.id,a.repo,a.now);
 assert.equal(after.lease.sessionId,null);assert.deepEqual(after.current,before);
});
test("ETag conflict rolls back every operation, including earlier ones",async()=>{
 const a=await activeAccount(),snapshot=a.repo.snapshot();
 const account=await a.repo.readAccount(a.id);
 await assert.rejects(()=>a.repo.commit(a.id.playerId,[
  {type:"replace",doc:{...account.session.value,expiresAt:"2099-01-01T00:00:00.000Z"},etag:account.session.etag},
  {type:"replace",doc:account.current.value,etag:"stale"},
 ]),RepositoryConflict);
 assert.deepEqual(a.repo.snapshot(),snapshot);
});
test("heartbeat retries a benign conditional conflict without changing save version",async()=>{
 const a=await activeAccount();a.repo.failCommit=new RepositoryConflict();
 await heartbeatSession(a.id,a.lease,a.repo,a.now);
 assert.equal((await a.repo.readAccount(a.id)).current.value.version,a.bootstrap.current.version);
});
test("real adapter sends If-Match in one same-partition batch and checks operation errors",async()=>{
 const a=await activeAccount(),account=await a.repo.readAccount(a.id);let sent;
 const container={items:{batch:async(ops,pk)=>{sent={ops,pk};return {code:200,result:[{statusCode:412}]};}}};
 const repo=new CosmosGameRepository(container);
 await assert.rejects(()=>repo.commit(a.id.playerId,[{type:"replace",doc:account.session.value,etag:account.session.etag}]),RepositoryConflict);
 assert.equal(sent.pk,a.id.playerId);assert.equal(sent.ops[0].ifMatch,account.session.etag);
 assert.equal(sent.ops[0].operationType,"Replace");
});
test("Cosmos SDK wrapped failures preserve 429/412 without leaking messages",()=>{
 const conflict=databaseError(new Error("SDK wrapper",{cause:{code:412,message:"private"}}));
 assert.ok(conflict instanceof RepositoryConflict);
 const throttled=databaseError(new Error("SDK wrapper",{cause:{code:429,retryAfterInMs:2400}}));
 assert.equal(throttled.status,429);assert.equal(throttled.retryAfterMs,2400);
 assert.equal(databaseError({code:403,message:"private"}).status,503);
});
test("adapter reads an atomic account snapshot and distinguishes empty from corrupt storage",async()=>{
 const a=await activeAccount(),raw=await a.repo.readAccount(a.id);
 const rows=Object.values(raw).map(v=>({statusCode:200,resourceBody:v.value,eTag:v.etag}));
 let result=rows,existing=[];
 const repo=new CosmosGameRepository({items:{
  batch:async()=>({code:200,result}),
  query:()=>({fetchAll:async()=>({resources:existing})}),
 }});
 assert.equal((await repo.readAccount(a.id)).current.value.runId,a.bootstrap.current.runId);
 result=[{statusCode:404},{statusCode:424},{statusCode:424},{statusCode:424}];
 assert.equal(await repo.readAccount(a.id),null);
 existing=[{id:"profile"}];
 await assert.rejects(()=>repo.readAccount(a.id),e=>e.code==="UNSUPPORTED_SAVE");
});
test("wrapped read-batch 404 verifies emptiness instead of treating broken infrastructure as a new account",async()=>{
 const id=identity();
 let queryFails=false;
 const repo=new CosmosGameRepository({items:{
  batch:async()=>{throw new Error("batch failed",{cause:{code:404}});},
  query:()=>({fetchAll:async()=>{if(queryFails)throw {code:404};return {resources:[]};}}),
 }});
 assert.equal(await repo.readAccount(id),null);
 queryFails=true;
 await assert.rejects(()=>repo.readAccount(id),e=>e.status===503);
});
