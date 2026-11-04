import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { activeAccount, identity } from "./cloud-test-support.mjs";
import { saveProgress, resetProgress } from "../api/src/services/save.ts";
import { acquireSession, heartbeatSession } from "../api/src/services/session.ts";
import { bootstrapAccount } from "../api/src/services/account.ts";
import { ApiError } from "../api/src/errors.ts";
import { PLAYABLE_PATH } from "../src/game/cloud/progression.ts";

const cp=(stageId)=>({checkpointId:stageId+"-checkpoint",stageId,x:500,y:440,facing:1,randomSeed:5,mapSnapshotVersion:0,contentVersion:1,capturedAt:100,mapSnapshot:null});
const read=c=>bootstrapAccount(c.id,c.repo,c.now);
async function request(c,event,change=()=>{}){
 const b=await read(c),p=structuredClone(b.current.progress);change(p);
 return {schemaVersion:1,requestId:randomUUID(),...c.lease,runId:b.current.runId,expectedVersion:b.current.version,sequence:b.current.lastSequence+1,event,progress:p};
}
async function send(c,event,change){return saveProgress(c.id,await request(c,event,change),c.repo,c.now);}
const enter=(c,stageId,world02Travel={})=>send(c,{kind:"stage-enter",stageId,seed:5,world02Travel});
const complete=(c,stageId)=>send(c,{kind:"stage-complete",stageId},p=>{if(!p.clearedStages.includes(stageId))p.clearedStages.push(stageId);});
const checkpoint=(c,stageId,origin="reached")=>send(c,{kind:"checkpoint",stageId,origin,snapshot:cp(stageId)});
const deaths=(c,stageId,count)=>send(c,{kind:"state",stageId},p=>{p.deathsTotal+=count;p.deathsByStage[stageId]=(p.deathsByStage[stageId]??0)+count;});
async function advance(c,target){
 let stage=(await read(c)).current.activeStageId;
 while(stage!==target){await complete(c,stage);stage=PLAYABLE_PATH[PLAYABLE_PATH.indexOf(stage)+1];await enter(c,stage);}
}
async function reset(c){const r=await request(c,{kind:"state",stageId:"world-01-stage-1"});delete r.event;delete r.progress;return {input:r,ack:await resetProgress(c.id,r,c.repo,c.now)};}
const rejects=(promise,code)=>assert.rejects(promise,e=>e.code===code);

test("achievement deaths stay paired with checkpoint while current deaths increase",async()=>{
 const c=await activeAccount();await enter(c,"world-01-stage-1");await advance(c,"world-01-stage-2");await deaths(c,"world-01-stage-2",3);
 const ack=await checkpoint(c,"world-01-stage-2");await deaths(c,"world-01-stage-2",4);
 const b=await read(c);assert.equal(b.current.progress.deathsTotal,7);assert.deepEqual(b.best,ack.best);assert.equal(b.best.deaths,3);assert.equal(b.best.progressRank,101);
 await checkpoint(c,"world-01-stage-2");assert.equal((await read(c)).best.deaths,3);
 await advance(c,"world-01-stage-4");await deaths(c,"world-01-stage-4",13);await checkpoint(c,"world-01-stage-4");
 assert.equal((await read(c)).best.deaths,20);assert.equal((await read(c)).best.progressRank,102);
});
test("reset preserves best/name, changes run, and new run cannot mix previous position with zero deaths",async()=>{
 const c=await activeAccount();await advance(c,"world-01-stage-2");await deaths(c,"world-01-stage-2",3);await checkpoint(c,"world-01-stage-2");
 await send(c,{kind:"state",stageId:"world-01-stage-2"},p=>{p.playerName=" <나비> ";});
 const old=await read(c),late=await request(c,{kind:"state",stageId:"world-01-stage-2"}),r=await reset(c),b=await read(c);
 assert.notEqual(b.current.runId,old.current.runId);assert.equal(b.current.version,old.current.version+1);assert.equal(r.ack.sequence,0);
 assert.equal(b.current.progress.playerName,"나비");assert.equal(b.current.progress.onboardingCompleted,false);assert.equal(b.current.progress.deathsTotal,0);assert.deepEqual(b.best,old.best);
 assert.deepEqual(await resetProgress(c.id,r.input,c.repo,c.now),r.ack);
 await rejects(saveProgress(c.id,late,c.repo,c.now),"RUN_CONFLICT");await enter(c,"world-01-stage-1");assert.deepEqual((await read(c)).best,old.best);
 await advance(c,"world-01-stage-2");await checkpoint(c,"world-01-stage-2");assert.equal((await read(c)).best.deaths,0);assert.equal((await read(c)).best.runId,b.current.runId);
});
test("same request retries return identical ack; altered body fails; expired receipt cannot reapply",async()=>{
 const c=await activeAccount(),r=await request(c,{kind:"state",stageId:"world-01-stage-1"}),ack=await saveProgress(c.id,r,c.repo,c.now),before=c.repo.snapshot();
 c.now.advance(1000);assert.deepEqual(await saveProgress(c.id,r,c.repo,c.now),ack);assert.deepEqual(c.repo.snapshot(),before);
 const altered=structuredClone(r);altered.progress.playerName="다름";await rejects(saveProgress(c.id,altered,c.repo,c.now),"REQUEST_REUSED");
 c.repo.docs.delete(c.repo.key(c.id.playerId,"receipt:"+r.requestId));await rejects(saveProgress(c.id,r,c.repo,c.now),"VERSION_CONFLICT");
 const fresh=await request(c,r.event);fresh.sequence=r.sequence;await rejects(saveProgress(c.id,fresh,c.repo,c.now),"SEQUENCE_CONFLICT");
});
test("owner fence is checked even before existing receipt",async()=>{
 const c=await activeAccount(),r=await request(c,{kind:"state",stageId:"world-01-stage-1"});await saveProgress(c.id,r,c.repo,c.now);
 await acquireSession(c.id,{requestId:randomUUID(),sessionId:randomUUID(),takeover:true},c.repo,c.now);await rejects(saveProgress(c.id,r,c.repo,c.now),"SESSION_LOST");
});
test("takeover between read and batch rolls back all mutation documents",async()=>{
 const c=await activeAccount(),r=await request(c,{kind:"stage-enter",stageId:"world-01-stage-1",seed:5,world02Travel:{}});let afterTakeover;
 c.repo.beforeCommit=async()=>{await acquireSession(c.id,{requestId:randomUUID(),sessionId:randomUUID(),takeover:true},c.repo,c.now);afterTakeover=c.repo.snapshot();};
 await rejects(saveProgress(c.id,r,c.repo,c.now),"SESSION_LOST");assert.deepEqual(c.repo.snapshot(),afterTakeover);assert.equal((await read(c)).best,null);
});
test("heartbeat-only ETag change retries transaction without duplicate sequence",async()=>{
 const c=await activeAccount(),r=await request(c,{kind:"state",stageId:"world-01-stage-1"});c.repo.beforeCommit=()=>heartbeatSession(c.id,c.lease,c.repo,c.now);
 const ack=await saveProgress(c.id,r,c.repo,c.now);assert.equal(ack.version,r.expectedVersion+1);assert.equal(ack.sequence,1);
});
test("concurrent different saves yield one commit and one version conflict",async()=>{
 const c=await activeAccount(),a=await request(c,{kind:"state",stageId:"world-01-stage-1"},p=>{p.playerName="첫째";}),b={...structuredClone(a),requestId:randomUUID()};
 const results=await Promise.allSettled([saveProgress(c.id,a,c.repo,c.now),saveProgress(c.id,b,c.repo,c.now)]);
 assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal(results.find(r=>r.status==="rejected").reason.code,"VERSION_CONFLICT");
});
test("429/503 do not advance save; immutable request safely retries",async()=>{
 for(const [status,code] of [[429,"THROTTLED"],[503,"UNAVAILABLE"]]){
  const c=await activeAccount(),r=await request(c,{kind:"state",stageId:"world-01-stage-1"}),before=c.repo.snapshot();c.repo.failCommit=new ApiError(status,code,"retry",1000);
  await rejects(saveProgress(c.id,r,c.repo,c.now),code);assert.deepEqual(c.repo.snapshot(),before);assert.equal((await saveProgress(c.id,r,c.repo,c.now)).sequence,1);
 }
});
test("expired owner must heartbeat before replaying pending save",async()=>{
 const c=await activeAccount(),r=await request(c,{kind:"state",stageId:"world-01-stage-1"});c.now.advance(60000);
 await rejects(saveProgress(c.id,r,c.repo,c.now),"SESSION_LOST");await heartbeatSession(c.id,c.lease,c.repo,c.now);await saveProgress(c.id,r,c.repo,c.now);
});
test("rejects jump, forged clear, unrelated death, early skill and hidden owner/rank fields",async()=>{
 const c=await activeAccount();await rejects(enter(c,"world-03-stage-1"),"INVALID_REQUEST");
 for(const change of [p=>p.clearedStages.push("world-01-stage-boss"),p=>p.unlockedSkills.push("bark"),p=>{p.deathsTotal=1;p.deathsByStage["world-02-stage-1"]=1;}])
  await rejects(send(c,{kind:"state",stageId:"world-01-stage-1"},change),"INVALID_REQUEST");
 const r=await request(c,{kind:"state",stageId:"world-01-stage-1"});r.best={progressRank:599};await rejects(saveProgress(c.id,r,c.repo,c.now),"INVALID_REQUEST");
 await rejects(checkpoint(c,"world-01-stage-1"),"INVALID_REQUEST");await rejects(checkpoint(c,"world-01-stage-2"),"INVALID_REQUEST");
});
test("clears, deaths, skills and coin ledger cannot be removed except boss world coin clearing",async()=>{
 const c=await activeAccount();await advance(c,"world-01-stage-boss");
 await send(c,{kind:"state",stageId:"world-01-stage-boss"},p=>{p.collectedCoinIds=["world-01-stage-1:coin-a"];});
 await rejects(send(c,{kind:"state",stageId:"world-01-stage-boss"},p=>{p.collectedCoinIds=[];}),"INVALID_REQUEST");
 await send(c,{kind:"stage-complete",stageId:"world-01-stage-boss"},p=>{p.clearedStages.push("world-01-stage-boss");p.unlockedSkills.push("bark");p.collectedCoinIds=[];});
 await rejects(send(c,{kind:"state",stageId:"world-01-stage-boss"},p=>{p.clearedStages=[];}),"INVALID_REQUEST");
 await rejects(send(c,{kind:"state",stageId:"world-01-stage-boss"},p=>{p.unlockedSkills=[];}),"INVALID_REQUEST");
 await deaths(c,"world-01-stage-boss",1);await rejects(send(c,{kind:"state",stageId:"world-01-stage-boss"},p=>{p.deathsTotal=0;p.deathsByStage={};}),"INVALID_REQUEST");
});
test("world selection checks unlock; replay restore does not create ranking achievement",async()=>{
 const c=await activeAccount(),select={kind:"world-select",selection:{worldId:"world-01",point:"checkpoint-2"}};
 await rejects(send(c,select),"INVALID_REQUEST");await advance(c,"world-01-stage-boss");await complete(c,"world-01-stage-boss");const best=(await read(c)).best;
 await send(c,select);assert.equal((await read(c)).current.resume.checkpoint,null);
 await rejects(checkpoint(c,"world-01-stage-4"),"INVALID_REQUEST");await enter(c,"world-01-stage-4");await checkpoint(c,"world-01-stage-4","restored");
 const b=await read(c);assert.deepEqual(b.best,best);assert.equal(b.current.pendingCheckpointId,null);assert.equal(b.current.resume.stageId,"world-01-stage-4");
 await send(c,{kind:"world-select",selection:{worldId:"world-01",point:"boss"}});assert.deepEqual((await read(c)).current.resume,b.current.resume);
 await send(c,{kind:"world-select",selection:{worldId:"world-02"}});assert.equal((await read(c)).current.resume.checkpoint,null);
});
test("same checkpoint restore preserves random snapshot and score; unsolicited restore fails",async()=>{
 const c=await activeAccount();await advance(c,"world-01-stage-2");await rejects(checkpoint(c,"world-01-stage-2","restored"),"INVALID_REQUEST");await checkpoint(c,"world-01-stage-2");
 const before=await read(c),event={kind:"checkpoint",stageId:"world-01-stage-2",origin:"restored",snapshot:{...cp("world-01-stage-2"),randomSeed:123}};
 await send(c,event);const after=await read(c);assert.deepEqual(after.current.resume,before.current.resume);assert.deepEqual(after.best,before.best);
});
test("World 2 backtracking/visits cannot award checkpoints; crossing world clears resume",async()=>{
 const c=await activeAccount();await advance(c,"world-02-stage-1");await checkpoint(c,"world-02-stage-1");await advance(c,"world-02-stage-3");
 const before=await read(c),travel=before.current.resume.world02Travel;
 await enter(c,"world-02-stage-2",travel);assert.equal((await read(c)).current.resume.stageId,"world-02-stage-1");assert.deepEqual((await read(c)).best,before.best);
 await enter(c,"world-02-stage-1",travel);await advance(c,"world-02-stage-boss");await complete(c,"world-02-stage-boss");
 assert.equal((await read(c)).current.resume.worldId,"world-02");await enter(c,"world-03-stage-1");const b=await read(c);
 assert.equal(b.current.resume.checkpoint,null);assert.deepEqual(b.current.resume.world02Travel,{});assert.equal(b.best.progressRank,300);
 await rejects(enter(c,"world-03-stage-1",travel),"INVALID_REQUEST");
});
test("final world clear is persistent; test namespace never becomes eligible",async()=>{
 const c=await activeAccount(undefined,identity(undefined,"test"));await advance(c,"world-05-stage-boss");await complete(c,"world-05-stage-boss");
 const b=await read(c);assert.equal(b.current.resume.completed,true);assert.equal(b.best.progressRank,599);
 assert.equal((await c.repo.readAccount(c.id)).best.value.eligible,false);
 const next=await acquireSession(c.id,{requestId:randomUUID(),sessionId:randomUUID(),takeover:true},c.repo,c.now);assert.equal(next.current.resume.completed,true);
});
