import assert from "node:assert/strict";
import test from "node:test";
import { activeAccount, identity } from "./cloud-test-support.mjs";
import { AccountCache, accountCacheKey } from "../src/game/persistence/cloud/AccountCache.ts";
import { CloudSaveCoordinator } from "../src/game/persistence/cloud/CloudSaveCoordinator.ts";
import { CloudSessionClient } from "../src/game/persistence/cloud/CloudSessionClient.ts";
import { ApiClientError } from "../src/game/persistence/cloud/GameApiClient.ts";
import { bootstrapAccount } from "../api/src/services/account.ts";
import { saveProgress, resetProgress } from "../api/src/services/save.ts";
import { acquireSession, heartbeatSession, releaseSession } from "../api/src/services/session.ts";
import { ApiError } from "../api/src/errors.ts";

class MemoryStorage {
 data=new Map();fail=false;
 getItem(k){if(this.fail)throw new Error("disabled");return this.data.get(k)??null;}
 setItem(k,v){if(this.fail)throw new Error("quota");this.data.set(k,v);}
 removeItem(k){if(this.fail)throw new Error("disabled");this.data.delete(k);}
}
const tick=async(t,ms=0)=>{t.mock.timers.tick(ms);for(let i=0;i<20;i++)await Promise.resolve();};
const fakeTime=t=>t.mock.timers.enable({apis:["setTimeout","Date"],now:Date.parse("2026-11-04T00:00:00.000Z")});
async function fixture(t,overrides={}){
 const c=await activeAccount(),storage=new MemoryStorage(),calls=[],statuses=[],acks=[];
 const wrap=fn=>async(...args)=>{try{return await fn(...args);}catch(e){if(e instanceof ApiError)throw new ApiClientError(e.status,e.code,e.message,e.retryAfterMs);throw e;}};
 const api={
  bootstrap:wrap(()=>bootstrapAccount(c.id,c.repo,c.now)),
  acquire:wrap(input=>acquireSession(c.id,input,c.repo,c.now)),
  heartbeat:wrap(input=>heartbeatSession(c.id,input,c.repo,c.now)),
  release:wrap(input=>releaseSession(c.id,input,c.repo,c.now)),
  save:wrap(input=>{calls.push(structuredClone(input));return saveProgress(c.id,input,c.repo,c.now);}),
  reset:wrap(input=>{calls.push(structuredClone(input));return resetProgress(c.id,input,c.repo,c.now);}),
 };
 const options={api,cache:new AccountCache(storage),bootstrap:c.bootstrap,sessionId:c.sessionId,onStatus:s=>statuses.push(s),onAck:a=>acks.push(a),now:Date.now,random:()=>0,...overrides};
 const coordinator=new CloudSaveCoordinator(options);t.after(()=>coordinator.dispose());
 return{...c,storage,calls,statuses,acks,api,options,coordinator,progress:structuredClone(c.bootstrap.current.progress)};
}
const state={kind:"state",stageId:"world-01-stage-1"};
test("FIFO freezes milestone snapshot and assigns metadata only once at the queue head",async t=>{
 fakeTime(t);const c=await fixture(t),p=c.progress;
 c.coordinator.observe({kind:"stage-enter",stageId:state.stageId,seed:1,world02Travel:{}},p);
 p.clearedStages.push(state.stageId);c.coordinator.observe({kind:"stage-complete",stageId:state.stageId},p);
 c.coordinator.observe({kind:"stage-enter",stageId:"world-01-stage-2",seed:1,world02Travel:{}},p);
 p.deathsTotal=3;p.deathsByStage["world-01-stage-2"]=3;
 c.coordinator.observe({kind:"checkpoint",stageId:"world-01-stage-2",origin:"reached",snapshot:{checkpointId:"world-01-stage-2-checkpoint",stageId:"world-01-stage-2",x:500,y:440,facing:1,randomSeed:1,mapSnapshotVersion:0,contentVersion:1,capturedAt:10,mapSnapshot:null}},p);
 p.deathsTotal=7;p.deathsByStage["world-01-stage-2"]=7;c.coordinator.observe({kind:"state",stageId:"world-01-stage-2"},p);
 await c.coordinator.flush();assert.deepEqual(c.calls.map(r=>r.sequence),[1,2,3,4,5]);assert.equal(c.calls[3].progress.deathsTotal,3);
 assert.equal(c.coordinator.getBootstrap().best.deaths,3);assert.equal(c.coordinator.getBootstrap().current.progress.deathsTotal,7);assert.equal(c.coordinator.getStatus(),"idle");
});
test("only adjacent unsubmitted state observations coalesce and debounce",async t=>{
 fakeTime(t);const c=await fixture(t);c.coordinator.observe(state,c.progress);c.progress.playerName="나비";c.coordinator.observe(state,c.progress);
 await tick(t,99);assert.equal(c.calls.length,0);await tick(t,1);await c.coordinator.flush();assert.equal(c.calls.length,1);assert.equal(c.calls[0].progress.playerName,"나비");
});
test("lost response retries exact persisted request after Retry-After and heartbeat, commits once",async t=>{
 fakeTime(t);const c=await fixture(t),original=c.api.save;let lost=true,heartbeats=0;
 c.api.save=async r=>{const ack=await original(r);if(lost){lost=false;throw new ApiClientError(503,"UNAVAILABLE","lost",2500);}return ack;};
 const heartbeat=c.api.heartbeat;c.api.heartbeat=async r=>{heartbeats++;return heartbeat(r);};
 c.coordinator.observe(state,c.progress);await assert.rejects(c.coordinator.flush());const cached=c.options.cache.read(c.id.playerId,c.sessionId);
 assert.equal(c.coordinator.getStatus(),"reconnecting");assert.ok(cached.inFlight);assert.equal(cached.confirmed.current.version,c.bootstrap.current.version);
 await tick(t,2499);assert.equal(c.calls.length,1);await tick(t,1);await c.coordinator.retry();
 assert.deepEqual(c.calls[0],c.calls[1]);assert.equal(heartbeats,1);assert.equal(c.coordinator.getBootstrap().current.version,c.bootstrap.current.version+1);
 assert.equal(c.coordinator.getStatus(),"idle");assert.equal(c.options.cache.read(c.id.playerId,c.sessionId).inFlight,null);
 assert.ok(!c.statuses.slice(c.statuses.indexOf("reconnecting")+1,-1).includes("saving"));
});
test("reload recovers head before acquire increments version; committed-response loss is safe",async t=>{
 fakeTime(t);const c=await fixture(t),original=c.api.save;
 c.api.save=async r=>{await original(r);throw new ApiClientError(503,"UNAVAILABLE","lost");};c.coordinator.observe(state,c.progress);await assert.rejects(c.coordinator.flush());c.coordinator.dispose();
 c.api.save=original;const latest=await c.api.bootstrap(),recovered=new CloudSaveCoordinator({...c.options,bootstrap:latest});t.after(()=>recovered.dispose());
 assert.equal(recovered.getStatus(),"reconnecting");await recovered.flush();assert.equal(recovered.hasPending(),false);assert.equal(recovered.getBootstrap().current.version,latest.current.version);
 const acquired=await c.api.acquire({requestId:crypto.randomUUID(),sessionId:c.sessionId,takeover:false});assert.equal(acquired.current.version,latest.current.version+1);
});
test("takeover quarantines old requests and never auto-merges into the new session",async t=>{
 fakeTime(t);const c=await fixture(t);c.coordinator.observe(state,c.progress);
 await c.api.acquire({requestId:crypto.randomUUID(),sessionId:crypto.randomUUID(),takeover:true});await assert.rejects(c.coordinator.flush());assert.equal(c.coordinator.getStatus(),"session-lost");
 const again=await c.api.acquire({requestId:crypto.randomUUID(),sessionId:c.sessionId,takeover:true}),fresh=new CloudSaveCoordinator({...c.options,bootstrap:again});t.after(()=>fresh.dispose());
 assert.equal(fresh.hasPending(),false);assert.ok([...c.storage.data.keys()].some(k=>k.includes(":quarantine:")));await fresh.flush();assert.equal(c.calls.length,1);
});
test("401 pauses for reauthentication, 400/403/version conflict do not auto-resubmit",async t=>{
 fakeTime(t);
 for(const [status,code,expected] of [[401,"UNAUTHENTICATED","reauth-required"],[400,"INVALID_REQUEST","conflict"],[403,"FORBIDDEN","conflict"],[409,"VERSION_CONFLICT","conflict"]]){
  const c=await fixture(t);let calls=0;c.api.save=async()=>{calls++;throw new ApiClientError(status,code,"blocked");};c.coordinator.observe(state,c.progress);await assert.rejects(c.coordinator.flush());
  assert.equal(c.coordinator.getStatus(),expected);await tick(t,60000);assert.equal(calls,1);c.coordinator.dispose();
 }
});
test("dispose ignores delayed successful responses and keeps pending for its original account",async t=>{
 fakeTime(t);const c=await fixture(t);let resolve;c.api.save=()=>new Promise(r=>{resolve=r;});c.coordinator.observe(state,c.progress);const pending=c.coordinator.flush();
 c.coordinator.dispose();const r=c.options.cache.read(c.id.playerId,c.sessionId).inFlight;resolve({requestId:r.requestId,runId:r.runId,version:r.expectedVersion+1,sequence:r.sequence,best:null,committedAt:c.now().toISOString()});
 await assert.rejects(pending,e=>e.name==="AbortError");assert.equal(c.acks.length,0);assert.ok(c.options.cache.read(c.id.playerId,c.sessionId).inFlight);
 assert.equal(c.options.cache.read(identity(crypto.randomUUID()).playerId,c.sessionId),null);
});
test("quota failure retains immutable memory request, pauses gameplay and recovers on retry",async t=>{
 fakeTime(t);const c=await fixture(t);c.storage.fail=true;c.coordinator.observe(state,c.progress);assert.equal(c.coordinator.getStatus(),"storage-error");
 await c.coordinator.flush();assert.equal(c.calls.length,1);assert.equal(c.coordinator.getStatus(),"storage-error");
 c.storage.fail=false;await c.coordinator.retry();assert.equal(c.coordinator.getStatus(),"idle");assert.equal(c.calls.length,1);
});
test("corrupt/mismatched cache never uploads defaults or touches legacy data",async t=>{
 fakeTime(t);const c=await fixture(t);c.coordinator.dispose();const key=accountCacheKey(c.id.playerId,c.sessionId),legacy="legendary-rib-corgi:progress:v1";
 c.storage.data.set(legacy,"old-game");c.storage.data.set(key,"{broken");const fresh=new CloudSaveCoordinator(c.options);t.after(()=>fresh.dispose());
 await fresh.flush();assert.equal(c.calls.length,0);assert.equal(c.storage.data.get(legacy),"old-game");
 const envelope=c.options.cache.read(c.id.playerId,c.sessionId);envelope.playerId=identity(crypto.randomUUID()).playerId;c.storage.data.set(key,JSON.stringify(envelope));assert.equal(c.options.cache.read(c.id.playerId,c.sessionId),null);
});
test("reset response loss recovers across reload into exactly one new run and preserves best",async t=>{
 fakeTime(t);const c=await fixture(t);c.coordinator.observe({kind:"stage-enter",stageId:state.stageId,seed:1,world02Travel:{}},c.progress);await c.coordinator.flush();
 const before=c.coordinator.getBootstrap(),original=c.api.reset;c.api.reset=async r=>{await original(r);throw new ApiClientError(503,"UNAVAILABLE","lost");};
 await assert.rejects(c.coordinator.reset());const pending=c.options.cache.read(c.id.playerId,c.sessionId).pendingReset;assert.ok(pending);c.coordinator.dispose();
 const committed=await c.api.bootstrap();assert.notEqual(committed.current.runId,before.current.runId);c.api.reset=original;
 const recovered=new CloudSaveCoordinator({...c.options,bootstrap:committed});t.after(()=>recovered.dispose());const result=await recovered.reset();
 assert.equal(result.current.runId,committed.current.runId);assert.deepEqual(result.best,before.best);assert.equal(result.current.lastSequence,0);
 assert.deepEqual(c.calls.at(-1),pending);assert.equal(recovered.hasPending(),false);
});
test("concurrent reset calls share one reset operation and block new observations",async t=>{
 fakeTime(t);const c=await fixture(t);const a=c.coordinator.reset(),b=c.coordinator.reset();assert.equal(a,b);assert.throws(()=>c.coordinator.observe(state,c.progress));
 await a;assert.equal(c.calls.length,1);
});
test("capacity pauses at the queue boundary and rejected overflow does not mutate accepted requests",async t=>{
 fakeTime(t);const c=await fixture(t);for(let i=0;i<128;i++)c.coordinator.observe({kind:"stage-enter",stageId:state.stageId,seed:1,world02Travel:{}},c.progress);
 assert.equal(c.coordinator.getStatus(),"storage-error");assert.throws(()=>c.coordinator.observe({kind:"stage-enter",stageId:state.stageId,seed:1,world02Travel:{}},c.progress));
 assert.equal(c.options.cache.read(c.id.playerId,c.sessionId).queued.length,128);await c.coordinator.flush();assert.equal(c.calls.length,128);
});
test("heartbeat is serialized, recurring, and visibility recovery waits for a successful confirmation",async t=>{
 fakeTime(t);const c=await fixture(t),events=new EventTarget(),document={visibilityState:"hidden",addEventListener:(...a)=>events.addEventListener(...a),removeEventListener:(...a)=>events.removeEventListener(...a)};
 let calls=0,resolve;const api={...c.api,heartbeat:()=>{calls++;return new Promise(r=>{resolve=r;});}},lost=[],valid=[];
 const session=new CloudSessionClient(api,code=>lost.push(code),lease=>valid.push(lease),document);t.after(()=>session.dispose());session.start(c.bootstrap.lease);
 const a=session.ensureValid(),b=session.ensureValid();assert.equal(a,b);assert.equal(calls,1);resolve(c.bootstrap.lease);await a;
 document.visibilityState="visible";events.dispatchEvent(new Event("visibilitychange"));assert.deepEqual(lost,["UNAVAILABLE"]);assert.equal(valid.length,1);resolve(c.bootstrap.lease);await session.ensureValid();assert.equal(valid.length,2);
 await tick(t,15000);assert.equal(calls,3);resolve(c.bootstrap.lease);await session.ensureValid();session.dispose();await tick(t,60000);assert.equal(calls,3);
});
test("session acquire retries identical request after response loss; takeover loss stops heartbeat",async t=>{
 fakeTime(t);const c=await fixture(t),seen=[],original=c.api.acquire;let lost=true;
 c.api.acquire=async r=>{seen.push(structuredClone(r));const result=await original(r);if(lost){lost=false;throw new ApiClientError(503,"UNAVAILABLE","lost");}return result;};
 const failures=[],session=new CloudSessionClient(c.api,code=>failures.push(code),undefined,null);t.after(()=>session.dispose());
 await assert.rejects(session.acquire(c.sessionId,false));const acquired=await session.acquire(c.sessionId,false);assert.deepEqual(seen[0],seen[1]);session.start(acquired.lease);
 await original({requestId:crypto.randomUUID(),sessionId:crypto.randomUUID(),takeover:true});await assert.rejects(session.ensureValid());assert.deepEqual(failures,["SESSION_LOST"]);
});
test("ten-second transport timeout aborts without discarding immutable head",async t=>{
 fakeTime(t);t.mock.method(AbortSignal,"timeout",ms=>{assert.equal(ms,10000);const ac=new AbortController();setTimeout(()=>ac.abort(new DOMException("timeout","TimeoutError")),ms);return ac.signal;});
 const c=await fixture(t);c.api.save=(_r,signal)=>new Promise((_,reject)=>signal.addEventListener("abort",()=>reject(signal.reason),{once:true}));
 c.coordinator.observe(state,c.progress);const pending=assert.rejects(c.coordinator.flush(),e=>e.name==="TimeoutError");await tick(t,10000);await pending;
 assert.equal(c.coordinator.getStatus(),"reconnecting");assert.ok(c.options.cache.read(c.id.playerId,c.sessionId).inFlight);
});
test("beforeunload writes local pending only and never claims an asynchronous server save",async t=>{
 fakeTime(t);const previous=globalThis.window,events=new EventTarget();globalThis.window=events;
 t.after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});
 const c=await fixture(t);c.coordinator.observe(state,c.progress);events.dispatchEvent(new Event("beforeunload"));
 assert.equal(c.calls.length,0);assert.equal(c.options.cache.read(c.id.playerId,c.sessionId).queued.length,1);c.coordinator.dispose();
});
test("serialized cache limit rejects oversized snapshots without modifying the last durable copy",async t=>{
 fakeTime(t);const c=await fixture(t);c.coordinator.observe(state,c.progress);const envelope=c.options.cache.read(c.id.playerId,c.sessionId),before=new Map(c.storage.data);
 envelope.queued=Array.from({length:128},()=>({requestId:crypto.randomUUID(),event:state,progress:{...c.progress,customOutfits:[1,2,3].map(i=>({id:"custom-outfit-"+i,cells:Array(1792).fill("#abcdef"),updatedAt:c.now().toISOString()}))}}));
 assert.throws(()=>c.options.cache.write(envelope));assert.deepEqual(c.storage.data,before);
});
