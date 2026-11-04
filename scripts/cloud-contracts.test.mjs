import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultProgressState } from "../src/game/core/constants.ts";
import { STAGE_DEFINITIONS } from "../src/game/data/worlds.ts";
import { world01Checkpoint } from "../src/game/data/world01Maps.ts";
import { CHECKPOINT_STAGES, MILESTONES, PLAYABLE_PATH, canEnterStage, isBetterRecord, milestoneFor } from "../src/game/cloud/progression.ts";
import { ContractError, normalizeNickname, parseBootstrap, parseSaveRequest, validateCheckpoint, validateProgress, validateTravel } from "../src/game/cloud/validation.ts";

const uuid = "11111111-1111-4111-8111-111111111111";
const resume = () => ({worldId:"world-01",stageId:"world-01-stage-1",checkpoint:null,worldSeed:1,world02Travel:{},completed:false});
const current = () => ({runId:uuid,version:0,lastSequence:0,activeStageId:"world-01-stage-1",pendingCheckpointId:null,progress:createDefaultProgressState(),resume:resume()});
const checkpoint = (stageId="world-01-stage-2") => ({checkpointId:stageId+"-checkpoint",stageId,x:1520,y:440,facing:1,randomSeed:1,mapSnapshotVersion:0,contentVersion:1,capturedAt:123.5,mapSnapshot:null});
const request = () => ({schemaVersion:1,requestId:uuid,sessionId:uuid,generation:1,runId:uuid,expectedVersion:0,sequence:1,event:{kind:"state",stageId:"world-01-stage-1"},progress:createDefaultProgressState()});
const bootstrap = () => ({schemaVersion:1,playerId:"prod:"+uuid+":"+uuid,displayName:"코기",current:current(),best:null,lease:{sessionId:null,generation:0,expiresAt:"1970-01-01T00:00:00.000Z"},serverTime:"2026-11-04T00:00:00.000Z"});

test("all default progress fields survive strict JSON validation independently", () => {
  const original=createDefaultProgressState();
  const parsed=validateProgress(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(parsed,original);
  parsed.keybinds.jump="KeyJ";
  assert.equal(original.keybinds.jump,"Space");
  assert.deepEqual(parseBootstrap(bootstrap()),bootstrap());
});
test("painted outfits, null cells, equipped ownership and all counters round trip", () => {
  const p=createDefaultProgressState();
  p.customOutfits=[{id:"custom-outfit-1",cells:Array.from({length:1792},(_,i)=>i%2?"#aabbCC":null),updatedAt:"2026-11-04T00:00:00.000Z"}];
  p.equippedCustomOutfitId="custom-outfit-1";
  p.deathsTotal=3;p.deathsByStage={"world-01-stage-1":2,"world-01-stage-2":1};
  assert.deepEqual(validateProgress(p),p);
  p.customOutfits[0].cells.pop();assert.throws(()=>validateProgress(p),ContractError);
});
for(const [label,change] of [
  ["missing field",p=>delete p.keybinds],
  ["extra field",p=>p.owner="other"],
  ["wrong schema",p=>p.version=6],
  ["negative coins",p=>p.bankedCoins=-1],
  ["nonfinite coins",p=>p.bankedCoins=NaN],
  ["fractional deaths",p=>p.deathsTotal=0.5],
  ["inconsistent deaths",p=>p.deathsTotal=1],
  ["unknown skill",p=>p.unlockedSkills=["admin"]],
  ["duplicate IDs",p=>p.ownedToolIds.push(p.ownedToolIds[0])],
  ["unowned equipment",p=>p.equippedAttackToolId="squeaky-ball"],
  ["wrong equipment slot",p=>p.equippedAttackToolId="upside-down-bowl"],
  ["removed playable stage",p=>p.clearedStages=["world-02-stage-4"]],
  ["invalid coin stage",p=>p.collectedCoinIds=["world-02-stage-4:coin-1"]],
  ["empty key binding",p=>p.keybinds.jump=""],
]) test("rejects "+label+" without replacing progress with defaults",()=>{const p=createDefaultProgressState();change(p);assert.throws(()=>validateProgress(p),ContractError);});
test("nickname normalization retains the existing Korean game rule",()=>{
  assert.equal(normalizeNickname("  <코기>  "),"코기");
  assert.equal(normalizeNickname("<>"),"코기");
  assert.equal(normalizeNickname("가".repeat(30)).length,20);
  const p=createDefaultProgressState(" <나비> ");assert.equal(validateProgress(p).playerName,"나비");
});
test("all 17 ranking checkpoints match actual playable map content",()=>{
  assert.equal(CHECKPOINT_STAGES.length,17);
  assert.equal(MILESTONES.length,27);
  assert.equal(PLAYABLE_PATH.length,24);
  for(const id of PLAYABLE_PATH){
    const stage=STAGE_DEFINITIONS.find(s=>s.id===id);
    assert.deepEqual(MILESTONES.filter(m=>m.stageId===id&&m.checkpointId).map(m=>m.checkpointId),stage.checkpointIds);
  }
  assert.equal(world01Checkpoint(2).id,"world-01-stage-2-checkpoint");
  assert.equal(world01Checkpoint(4).id,"world-01-stage-4-checkpoint");
  assert.equal(world01Checkpoint(1),null);
  assert.ok(!CHECKPOINT_STAGES.includes("world-02-stage-4"));
});
test("boss entry, ordinary map clear and restored checkpoints do not award a rank",()=>{
  assert.equal(milestoneFor({kind:"stage-enter",stageId:"world-01-stage-boss",seed:1,world02Travel:{}}),null);
  assert.equal(milestoneFor({kind:"stage-complete",stageId:"world-01-stage-2"}),null);
  assert.equal(milestoneFor({kind:"checkpoint",stageId:"world-01-stage-2",origin:"restored",snapshot:checkpoint()}),null);
  assert.equal(milestoneFor({kind:"checkpoint",stageId:"world-01-stage-2",origin:"reached",snapshot:checkpoint()}).rank,101);
  assert.equal(milestoneFor({kind:"stage-complete",stageId:"world-05-stage-boss"}).rank,599);
});
test("legal entry includes clears, world2 backtrack and server resume only",()=>{
  const c=current();assert.equal(canEnterStage(c,"world-04-stage-1"),false);
  assert.equal(canEnterStage(c,"world-01-stage-2"),false);
  c.progress.clearedStages.push(c.activeStageId);assert.equal(canEnterStage(c,"world-01-stage-2"),true);
  c.activeStageId="world-02-stage-3";c.progress.clearedStages.push(c.activeStageId);
  assert.equal(canEnterStage(c,"world-02-stage-boss"),true);
  assert.equal(canEnterStage(c,"world-02-stage-2"),true);
  assert.equal(canEnterStage(c,"world-02-stage-4"),false);
});
test("best comparison keeps achievement deaths and run identity paired",()=>{
  const best={milestoneId:"world-02:start",progressRank:200,deaths:3,runId:uuid};
  assert.equal(isBetterRecord({...best,deaths:7},best),false);
  assert.equal(isBetterRecord({...best,deaths:2,runId:"new-run"},best),true);
  assert.equal(isBetterRecord({...best,progressRank:201,deaths:30},best),true);
  assert.equal(isBetterRecord({...best,progressRank:199,deaths:0},best),false);
  assert.deepEqual(best,{milestoneId:"world-02:start",progressRank:200,deaths:3,runId:uuid});
});
test("checkpoint identity, numeric bounds and snapshot format are strict",()=>{
  assert.deepEqual(validateCheckpoint(checkpoint(),"world-01-stage-2"),checkpoint());
  for(const patch of [{checkpointId:"fake"},{stageId:"world-01-stage-4"},{contentVersion:2},{randomSeed:0},{x:Infinity},{x:-1},{capturedAt:-1},{secret:"bad"}]){
    assert.throws(()=>validateCheckpoint({...checkpoint(),...patch},"world-01-stage-2"),ContractError);
  }
  assert.throws(()=>validateCheckpoint(checkpoint("world-01-stage-boss"),"world-01-stage-boss"),ContractError);
});
test("legacy-shaped world2 visit snapshots are normalized without trusting unknown fields",()=>{
  const c=checkpoint("world-02-stage-1");
  const legacy={...c};
  delete legacy.contentVersion;delete legacy.capturedAt;delete legacy.mapSnapshot;
  const travel={"world-02-stage-1":{seed:1,checkpointSnapshot:legacy}};
  assert.deepEqual(validateTravel(travel),travel);
  assert.throws(()=>validateTravel({"world-02-stage-4":travel["world-02-stage-1"]}),ContractError);
  assert.throws(()=>validateTravel({"world-02-stage-1":{seed:2,checkpointSnapshot:legacy}}),ContractError);
});
test("request parsing validates identity-independent mutation metadata and copies event state",()=>{
  const r=request(),p=parseSaveRequest(r);
  assert.deepEqual(p,r);
  p.progress.bankedCoins=4;assert.equal(r.progress.bankedCoins,0);
  for(const patch of [{playerId:"other"},{sequence:0},{runId:"not-uuid"},{schemaVersion:2}]){
    assert.throws(()=>parseSaveRequest({...r,...patch}),ContractError);
  }
});
test("oversize progress and prototype pollution cannot cross the API contract",()=>{
  const p=createDefaultProgressState();
  p.collectedItems=Array.from({length:3000},(_,i)=>i+"x".repeat(120));
  assert.throws(()=>validateProgress(p),ContractError);
  const bad=JSON.parse(JSON.stringify(createDefaultProgressState()));
  Object.defineProperty(bad.keybinds,"__proto__",{value:{polluted:true},enumerable:true});
  assert.throws(()=>validateProgress(bad),ContractError);
  assert.equal({}.polluted,undefined);
});
