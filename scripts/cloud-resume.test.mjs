import assert from "node:assert/strict";
import test from "node:test";
import Module,{createRequire} from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { activeAccount } from "./cloud-test-support.mjs";
import { buildCloudEntry, cloudEntryRoute, toCloudCheckpoint, restoreCloudCheckpoint, resumeForStage, resumeForSelection,
 CLOUD_ENTRY_KEY,CLOUD_RESUME_KEY,CLOUD_CHECKPOINT_KEY,CLOUD_RUNTIME_KEY,CLOUD_PENDING_CHECKPOINT_KEY } from "../src/game/cloud/resume.ts";
import { GameCloudBridge } from "../src/game/cloud/GameCloudBridge.ts";
import { GameEventBus } from "../src/game/bridge/GameEventBus.ts";
import { createDefaultProgressState, createRuntimeStageState } from "../src/game/core/constants.ts";
import { STAGE_DEFINITIONS } from "../src/game/data/worlds.ts";
import { CHECKPOINT_STAGES, milestoneFor, worldOf } from "../src/game/cloud/progression.ts";
import { MapRuleRegistry } from "../src/game/maps/MapRuleRegistry.ts";
import { StageRandom } from "../src/game/random/StageRandom.ts";
import { EconomySystem } from "../src/game/systems/EconomySystem.ts";
import { CheckpointSystem } from "../src/game/systems/CheckpointSystem.ts";
import { GameplayEventBus } from "../src/game/core/events.ts";
import { saveProgress } from "../api/src/services/save.ts";
import { bootstrapAccount } from "../api/src/services/account.ts";
const checkpoint=(stageId="world-01-stage-2",seed=7)=>toCloudCheckpoint({checkpointId:stageId+"-checkpoint",stageId,x:500,y:440,facing:-1,randomSeed:seed,mapSnapshotVersion:2},1000);
const resume=(stageId="world-01-stage-1",cp=null)=>({worldId:worldOf(stageId),stageId,checkpoint:cp,worldSeed:cp?.randomSeed??7,world02Travel:{},completed:false});
test("all 17 real checkpoints round-trip and resume uses current world CP, even from boss",async()=>{
 const {bootstrap}=await activeAccount();bootstrap.current.progress.onboardingCompleted=true;
 for(const id of CHECKPOINT_STAGES){const cp=checkpoint(id);bootstrap.current.resume=resume(id,cp);bootstrap.current.activeStageId=worldOf(id)+"-stage-boss";
  const entry=buildCloudEntry(JSON.parse(JSON.stringify(bootstrap))),route=cloudEntryRoute(entry);assert.equal(route.sceneKey,"StageScene");assert.equal(route.data.stageId,id);assert.equal(route.data.resumeCheckpointId,cp.checkpointId);
  const restored=restoreCloudCheckpoint(cp,{x:600,y:504},20);assert.equal(restored.x,600);assert.equal(restored.y,504);assert.equal(restored.facing,-1);assert.equal(cp.x,500);
 }
});
test("root onboarding, unseen world introductions, no-CP world starts, and final ending route correctly",async()=>{
 const {bootstrap}=await activeAccount();assert.equal(cloudEntryRoute(buildCloudEntry(bootstrap)).sceneKey,"IntroScene");bootstrap.current.progress.onboardingCompleted=true;
 for(const [world,scene] of [["world-02","World02EntranceScene"],["world-03","World03EntranceScene"],["world-04","World04EntranceScene"]]){
  bootstrap.current.resume=resume(world+"-stage-1");bootstrap.current.activeStageId=world+"-stage-boss";assert.equal(cloudEntryRoute(buildCloudEntry(bootstrap)).sceneKey,scene);
  bootstrap.current.progress.seenCutsceneIds.push(world+"-intro");assert.equal(cloudEntryRoute(buildCloudEntry(bootstrap)).data.stageId,world+"-stage-1");
 }
 bootstrap.current.resume={...resume("world-05-stage-1"),completed:true};bootstrap.current.activeStageId="world-05-stage-boss";
 assert.equal(cloudEntryRoute(buildCloudEntry(bootstrap)).sceneKey,"ending");
});
test("cross-world entry clears checkpoint and visits while ordinary/boss/backtracking entry preserves them",()=>{
 const cp=checkpoint("world-02-stage-3"),previous=resume(cp.stageId,cp);previous.world02Travel={"world-02-stage-1":{seed:15,checkpointSnapshot:null},"world-02-stage-3":{seed:7,checkpointSnapshot:null}};
 for(const id of ["world-02-stage-boss","world-02-stage-2","world-02-stage-1"]){const next=resumeForStage(previous,id,15,previous.world02Travel);assert.deepEqual(next.checkpoint,cp);assert.deepEqual(next.world02Travel,previous.world02Travel);}
 const next=resumeForStage(previous,"world-03-stage-1",21,{});assert.equal(next.checkpoint,null);assert.equal(next.worldSeed,21);assert.deepEqual(next.world02Travel,{});
});
test("world selection creates pending replay CP but boss choice retains the last real CP",()=>{
 const previous=resume("world-01-stage-2",checkpoint());const boss=resumeForSelection(previous,{worldId:"world-01",point:"boss"});assert.deepEqual(boss.resume,previous);
 const cp=resumeForSelection(previous,{worldId:"world-01",point:"checkpoint-2"});assert.equal(cp.resume.checkpoint,null);assert.equal(cp.pendingCheckpointId,"world-01-stage-4-checkpoint");
 const world2=resumeForSelection(previous,{worldId:"world-02"});assert.equal(world2.resume.stageId,"world-02-stage-1");assert.equal(world2.pendingCheckpointId,null);
});
test("actual W1 map snapshots preserve elapsed gimmick time, normalize snack death, and reject unknown content",()=>{
 const stage=STAGE_DEFINITIONS.find(s=>s.id==="world-01-stage-2"),cp=checkpoint(stage.id),map=stage.map;
 const registry=new MapRuleRegistry(map.objectDefinitions,new StageRandom(7));registry.registerRules(map.chainRules);
 const snack=map.gimmicks.find(g=>g.kind.startsWith("fake-bone-")),timed=map.gimmicks.find(g=>!g.kind.startsWith("fake-bone-"));assert.ok(snack&&timed);
 cp.mapSnapshot={...registry.createSnapshot(cp.checkpointId,7),gimmickStates:Object.fromEntries([snack,timed].map(g=>[g.id,{gimmickId:g.id,status:"triggered",startedAt:800,counterpresses:1,snapshotSeed:7}]))};
 const before=structuredClone(cp),restored=restoreCloudCheckpoint(cp,{x:1520,y:520},20);
 assert.equal(restored.mapSnapshot.gimmickStates[snack.id].status,"escaped");assert.equal(restored.mapSnapshot.gimmickStates[snack.id].startedAt,null);
 assert.equal(restored.mapSnapshot.gimmickStates[timed.id].startedAt,-180);assert.deepEqual(cp,before);
 assert.equal(toCloudCheckpoint(restored,20).mapSnapshot.gimmickStates[timed.id].startedAt,-180);
 const unknown=structuredClone(cp);unknown.mapSnapshot.objectStates["not-in-map"]={active:true,x:0,y:0,collision:false};assert.throws(()=>restoreCloudCheckpoint(unknown,{x:0,y:0},0));
 assert.throws(()=>restoreCloudCheckpoint({...cp,contentVersion:2},{x:0,y:0},0));
});
test("structure snapshots precede same-tick auxiliary changes without sending the stage-clear coin intermediate state",async()=>{
 const progress=createDefaultProgressState(),bus=new GameEventBus(),runtime=createRuntimeStageState("world-01-stage-1",1),seen=[];
 const bridge=new GameCloudBridge(bus,()=>progress,()=>({seed:1,world02Travel:{}}),(event,p)=>seen.push({event,progress:p}));
 bus.emit("stage-started",{stageId:runtime.stageId,attempt:1});const economy=new EconomySystem(progress,runtime,bus);economy.commitStageClear();
 bus.emit("stage-completed",{stageId:runtime.stageId,nextStageId:"world-01-stage-2",bankedCoins:0});await Promise.resolve();
 assert.deepEqual(seen.map(r=>r.event.kind),["stage-enter","stage-complete"]);
 progress.deathsTotal=1;progress.deathsByStage[runtime.stageId]=1;bus.emit("death-count-updated",{stageId:runtime.stageId,deathsTotal:1});await Promise.resolve();
 assert.equal(seen.at(-1).event.kind,"state");assert.equal(seen[1].progress.deathsTotal,0);bridge.destroy();
});
test("CP then death takes separate snapshots; restored CP has no score candidate and subscriptions never duplicate",async()=>{
 const p=createDefaultProgressState(),bus=new GameEventBus(),seen=[],runtime={seed:7,world02Travel:{}};
 const bridge=new GameCloudBridge(bus,()=>p,()=>runtime,(e,p)=>seen.push({e,p}),"world-01-stage-2");
 bus.emit("checkpoint-activated",{stageId:"world-01-stage-2",checkpointId:checkpoint().checkpointId,origin:"reached",snapshot:checkpoint()});
 p.deathsTotal=1;p.deathsByStage["world-01-stage-2"]=1;bus.emit("death-count-updated",{stageId:"world-01-stage-2",deathsTotal:1});await Promise.resolve();assert.equal(seen[0].p.deathsTotal,0);assert.equal(seen[1].p.deathsTotal,1);
 const replacement=new GameCloudBridge(bus,()=>p,()=>runtime,(e,p)=>seen.push({e,p}));bus.emit("checkpoint-activated",{stageId:"world-01-stage-2",checkpointId:checkpoint().checkpointId,origin:"restored",snapshot:checkpoint()});
 assert.equal(seen.length,3);assert.equal(milestoneFor(seen.at(-1).e),null);replacement.requestState();replacement.destroy();await Promise.resolve();assert.equal(seen.length,3);bridge.destroy();
});
test("bridge snapshots pass actual save transition checks including commitStageClear ordering",async()=>{
 const c=await activeAccount(),p=structuredClone(c.bootstrap.current.progress),bus=new GameEventBus(),observed=[];
 const bridge=new GameCloudBridge(bus,()=>p,()=>({seed:1,world02Travel:{}}),(event,progress)=>observed.push({event,progress}));
 bus.emit("stage-started",{stageId:"world-01-stage-1",attempt:1});new EconomySystem(p,createRuntimeStageState("world-01-stage-1",1),bus).commitStageClear();
 bus.emit("stage-completed",{stageId:"world-01-stage-1",nextStageId:"world-01-stage-2",bankedCoins:0});bus.emit("stage-started",{stageId:"world-01-stage-2",attempt:1});await Promise.resolve();
 for(const o of observed){const b=await bootstrapAccount(c.id,c.repo,c.now);await saveProgress(c.id,{schemaVersion:1,requestId:crypto.randomUUID(),...c.lease,runId:b.current.runId,expectedVersion:b.current.version,sequence:b.current.lastSequence+1,...o},c.repo,c.now);}
 assert.equal((await bootstrapAccount(c.id,c.repo,c.now)).current.activeStageId,"world-01-stage-2");bridge.destroy();
});

// Exercise real scene methods with lightweight rendering ports, without launching a browser.
const require=createRequire(import.meta.url),load=Module._load;
require.extensions[".ts"]=(module,filename)=>module._compile(ts.transpileModule(readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},fileName:filename}).outputText,filename);
const phaser={Scene:class{},Math:{Vector2:class{constructor(x,y){this.x=x;this.y=y;}}}};
let StageScene,PreloadScene;
try{
 Module._load=function(name,parent,main){
  if(name==="phaser")return phaser;
  if(parent?.filename.endsWith("StageScene.ts")&&![/cloud\/resume$/,/core\/constants$/,/data\/world02Travel$/,/systems\/world01Respawn$/].some(p=>p.test(name)))return new Proxy({},{get:()=>class{}});
  return load.call(this,name,parent,main);
 };
 ({StageScene}=require("../src/game/scenes/StageScene.ts"));({PreloadScene}=require("../src/game/scenes/PreloadScene.ts"));
}finally{Module._load=load;}
const registry=entries=>{const values=new Map(entries);return{get:k=>values.get(k),set:(k,v)=>values.set(k,v),remove:k=>values.delete(k)};};
test("real Preload create prioritizes cloud entry over development and emits final ending only",async()=>{
 const {bootstrap}=await activeAccount();bootstrap.current.progress.onboardingCompleted=true;bootstrap.current.resume=resume("world-04-stage-1");bootstrap.current.activeStageId="world-04-stage-1";
 const entry=buildCloudEntry(bootstrap),scene=new PreloadScene(),starts=[],events=[];scene.registry=registry([[CLOUD_ENTRY_KEY,entry],["progressState",entry.progress],["gameEventBus",{emit:(...e)=>events.push(e)}]]);scene.scene={start:(...a)=>starts.push(a),stop:()=>starts.push(["stop"])};
 scene.create();assert.equal(starts[0][0],"World04EntranceScene");entry.resume={...resume("world-05-stage-1"),completed:true};scene.create();assert.deepEqual(events,[["ending-finished",{cutsceneId:"ending-homecoming"}]]);assert.equal(starts.at(-1)[0],"stop");
});
test("real restoreCheckpoint uses map respawn, preserves snapshot, and publishes restored origin without rank",()=>{
 const cp=checkpoint(),scene=Object.create(StageScene.prototype),bus=new GameEventBus(),seen=[];bus.on("checkpoint-activated",p=>seen.push(p));
 Object.assign(scene,{stageId:cp.stageId,time:{now:20},eventBus:bus,registry:registry([[CLOUD_ENTRY_KEY,{}],[CLOUD_CHECKPOINT_KEY,cp],[CLOUD_RESUME_KEY,resume(cp.stageId,cp)]]),
  player:{resetTo(p){this.position=p;},setFlipX(v){this.flipX=v;}},getCheckpointSpawn:()=>({x:1520,y:520}),resetWorld04Attempt(){}});
 scene.checkpointSystem=new CheckpointSystem(scene.player,new GameplayEventBus(),cp.stageId,createRuntimeStageState(cp.stageId,7));
 scene.restoreCheckpoint(cp.checkpointId);scene.publishCheckpoint("restored");assert.deepEqual({...scene.player.position},{x:1520,y:520});assert.equal(scene.player.flipX,true);assert.equal(seen[0].origin,"restored");assert.equal(cp.x,500);assert.deepEqual(scene.registry.get(CLOUD_RESUME_KEY).checkpoint,cp);
 scene.registry.set(CLOUD_CHECKPOINT_KEY,null);assert.throws(()=>scene.restoreCheckpoint(cp.checkpointId));
 scene.registry.set(CLOUD_PENDING_CHECKPOINT_KEY,cp.checkpointId);scene.restoreCheckpoint(cp.checkpointId);scene.publishCheckpoint("restored");assert.equal(scene.registry.get(CLOUD_PENDING_CHECKPOINT_KEY),undefined);
});
test("real cloud runtime update retains last checkpoint during boss entry and resets it on next world",()=>{
 const cp=checkpoint(),scene=Object.create(StageScene.prototype);Object.assign(scene,{stageId:"world-01-stage-boss",registry:registry([[CLOUD_RESUME_KEY,resume(cp.stageId,cp)]]),eventBus:new GameEventBus()});
 scene.updateCloudRuntime(15);assert.deepEqual(scene.registry.get(CLOUD_CHECKPOINT_KEY),cp);assert.equal(scene.registry.get(CLOUD_RUNTIME_KEY).seed,15);
 scene.stageId="world-02-stage-1";scene.updateCloudRuntime(21);assert.equal(scene.registry.get(CLOUD_CHECKPOINT_KEY),null);assert.equal(scene.registry.get(CLOUD_RESUME_KEY).worldSeed,21);
});
