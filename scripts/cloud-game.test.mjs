import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import Module, { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createElement as h, StrictMode } from "react";
import { installDom } from "./cloud-dom-support.mjs";
import { activeAccount } from "./cloud-test-support.mjs";
import { bootstrapAccount } from "../api/src/services/account.ts";
import { acquireSession, heartbeatSession, releaseSession } from "../api/src/services/session.ts";
import { saveProgress, resetProgress } from "../api/src/services/save.ts";
import { ApiError } from "../api/src/errors.ts";
import { ApiClientError } from "../src/game/persistence/cloud/GameApiClient.ts";
import { CloudGameController } from "../src/game/persistence/cloud/CloudGameController.ts";
import { AccountCache } from "../src/game/persistence/cloud/AccountCache.ts";
import { CloudSaveCoordinator } from "../src/game/persistence/cloud/CloudSaveCoordinator.ts";
import { claimTabSession } from "../src/game/persistence/cloud/tabSession.ts";
import { GameEventBus } from "../src/game/bridge/GameEventBus.ts";
import { CloudPauseController } from "../src/game/bridge/CloudPauseController.ts";
import { CutsceneTimeline } from "../src/game/cutscenes/CutsceneTimeline.ts";

const dom = installDom();
const {render,screen,act,cleanup}=await import("@testing-library/react");
test.afterEach(()=>cleanup());test.after(()=>dom.window.close());
class Storage {
 data=new Map();writes=[];
 getItem(k){return this.data.get(k)??null;}
 setItem(k,v){this.data.set(k,v);this.writes.push(k);}
 removeItem(k){this.data.delete(k);}
}
const drain=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
async function fixture(t,options={}) {
 const c=await activeAccount(),storage=new Storage(),calls=[];
 const wrap=(name,fn)=>async(...args)=>{calls.push(name);try{return await fn(...args);}catch(e){if(e instanceof ApiError)throw new ApiClientError(e.status,e.code,e.message);throw e;}};
 const api={bootstrap:wrap("bootstrap",()=>bootstrapAccount(c.id,c.repo,c.now)),acquire:wrap("acquire",r=>acquireSession(c.id,r,c.repo,c.now)),
  heartbeat:wrap("heartbeat",r=>heartbeatSession(c.id,r,c.repo,c.now)),release:wrap("release",r=>releaseSession(c.id,r,c.repo,c.now)),
  save:wrap("save",r=>saveProgress(c.id,r,c.repo,c.now)),reset:wrap("reset",r=>resetProgress(c.id,r,c.repo,c.now))};
 const cache=new AccountCache(storage),claim=async()=>({sessionId:c.sessionId,release(){calls.push("unlock");}});
 const controller=new CloudGameController(api,cache,claim,Date.now,null);t.after(()=>controller.dispose());
 return {...c,api,cache,storage,calls,claim,controller,...options};
}
const event={kind:"state",stageId:"world-01-stage-1"};
test("bootstrap failure mounts no game and never writes a default or legacy save",async t=>{
 const c=await fixture(t);c.api.bootstrap=async()=>{throw new ApiClientError(503,"UNAVAILABLE","offline");};await c.controller.start();
 assert.equal(c.controller.getSnapshot().phase,"error");assert.equal(c.controller.getSnapshot().cloud,null);assert.equal(c.storage.writes.length,0);assert.ok(!c.calls.includes("acquire"));
});
test("new cloud account starts at W1 only after acquire AND heartbeat",async t=>{
 const c=await fixture(t);let resume;const heartbeat=c.api.heartbeat;c.api.heartbeat=async r=>{await new Promise(resolve=>{resume=resolve;});return heartbeat(r);};
 const opening=c.controller.start();await drain();assert.equal(c.controller.getSnapshot().cloud,null);resume();await opening;
 const state=c.controller.getSnapshot();assert.equal(state.phase,"ready");assert.equal(state.cloud.bootstrap.current.resume.stageId,"world-01-stage-1");
 assert.equal(state.cloud.bus.pauseReasons.isPaused(),false);assert.deepEqual(c.calls.slice(0,3),["bootstrap","acquire","heartbeat"]);
});
test("reload recovers exact lost-response save before acquiring a new version",async t=>{
 const c=await fixture(t);const original=c.api.save;let request;
 c.api.save=async r=>{request=structuredClone(r);await original(r);throw new Error("response lost");};
 const saves=new CloudSaveCoordinator({api:c.api,cache:c.cache,bootstrap:c.bootstrap,sessionId:c.sessionId,onStatus(){},onAck(){},now:Date.now});
 const p=structuredClone(c.bootstrap.current.progress);p.playerName="다시 만난 코기";saves.observe(event,p);await assert.rejects(saves.flush());saves.dispose();
 c.calls.length=0;c.api.save=async r=>{assert.deepEqual(r,request);return original(r);};await c.controller.start();
 assert.equal(c.controller.getSnapshot().phase,"ready");assert.ok(c.calls.indexOf("save")<c.calls.indexOf("acquire"));
 assert.equal(c.controller.getSnapshot().cloud.bootstrap.current.progress.playerName,p.playerName);
});
test("takeover is explicit; the old writer is paused on its next heartbeat",async t=>{
 const c=await fixture(t),other=crypto.randomUUID();await c.api.acquire({requestId:crypto.randomUUID(),sessionId:other,takeover:true});
 await c.controller.start();assert.equal(c.controller.getSnapshot().phase,"takeover");assert.equal((await c.api.bootstrap()).lease.sessionId,other);
 await c.controller.start(true);assert.equal(c.controller.getSnapshot().phase,"ready");
 await c.api.acquire({requestId:crypto.randomUUID(),sessionId:crypto.randomUUID(),takeover:true});
 await assert.rejects(c.controller.getSnapshot().cloud.sessions.ensureValid());assert.equal(c.controller.getSnapshot().status,"session-lost");assert.ok(c.controller.getSnapshot().cloud.bus.pauseReasons.has("session-lost"));
});
test("renewed lease alone cannot unpause a pending save; terminal restore conflict survives heartbeat",async t=>{
 const c=await fixture(t);await c.controller.start();const cloud=c.controller.getSnapshot().cloud,original=c.api.save;let release;
 c.api.save=async r=>{await new Promise(resolve=>{release=resolve;});return original(r);};
 cloud.bus.pauseReasons.set("manual",true);c.controller.observe(event,cloud.bootstrap.current.progress);const saving=cloud.saves.flush();await drain();
 const heartbeat=c.api.heartbeat;c.api.heartbeat=async()=>{throw new ApiClientError(503,"UNAVAILABLE","lost");};await assert.rejects(cloud.sessions.ensureValid());
 c.api.heartbeat=heartbeat;await cloud.sessions.ensureValid();assert.equal(c.controller.getSnapshot().status,"reconnecting");assert.ok(cloud.bus.pauseReasons.has("save-error"));
 release();await saving;assert.equal(c.controller.getSnapshot().status,"idle");assert.ok(cloud.bus.pauseReasons.has("manual"));
 cloud.bus.emit("cloud-resume-error",{message:"invalid content"});await cloud.sessions.ensureValid();assert.equal(c.controller.getSnapshot().status,"conflict");assert.ok(cloud.bus.pauseReasons.has("conflict"));
});
test("reset failure retains game/run; recovered receipt switches to exactly one new run",async t=>{
 const c=await fixture(t);await c.controller.start();const before=c.controller.getSnapshot().cloud,reset=c.api.reset;let fail=true;
 c.api.reset=async r=>{const result=await reset(r);if(fail)throw new Error("lost");return result;};
 await assert.rejects(c.controller.reset());assert.equal(c.controller.getSnapshot().cloud,before);assert.ok(before.bus.pauseReasons.has("reset"));
 fail=false;await new Promise(r=>setTimeout(r,1300));await c.controller.retry();
 assert.notEqual(c.controller.getSnapshot().cloud.bootstrap.current.runId,before.bootstrap.current.runId);
 assert.equal(c.controller.getSnapshot().cloud.bootstrap.current.version,before.bootstrap.current.version+1);assert.equal(before.bus.pauseReasons.has("reset"),false);
});
test("late old-account bootstrap cannot acquire, mount, write, or release a newer session",async t=>{
 const c=await fixture(t);let resolve;c.api.bootstrap=()=>new Promise(r=>{resolve=r;});const start=c.controller.start();await drain();c.controller.dispose();resolve(c.bootstrap);await start;
 assert.equal(c.controller.getSnapshot().cloud,null);assert.deepEqual(c.calls,[]);assert.equal(c.storage.writes.length,0);
});
test("StrictMode setup/cleanup does not make a duplicate acquire",async t=>{
 const c=await fixture(t);const cancelled=c.controller.start();c.controller.dispose();
 const live=new CloudGameController(c.api,c.cache,c.claim,Date.now,null);t.after(()=>live.dispose());await Promise.all([cancelled,live.start()]);
 assert.equal(c.calls.filter(x=>x==="acquire").length,1);assert.equal(live.getSnapshot().phase,"ready");
});
test("logout flushes pending snapshots before releasing its captured lease",async t=>{
 const c=await fixture(t);await c.controller.start();const p=c.controller.getSnapshot().cloud.bootstrap.current.progress;
 c.controller.observe(event,{...p,playerName:"저장 후 나가기"});c.calls.length=0;await c.controller.logout();
 assert.ok(c.calls.indexOf("save")<c.calls.indexOf("release"));assert.equal(c.controller.getSnapshot().phase,"closed");assert.equal((await c.api.bootstrap()).current.progress.playerName,"저장 후 나가기");
});
test("tab clone gets a new UUID while reload reuses its unlocked UUID; no locks always gets fresh UUID",async()=>{
 const held=new Set(),locks={async request(name,_opts,cb){if(held.has(name))return cb(null);held.add(name);try{return await cb({name});}finally{held.delete(name);}}};
 const storage=new Storage(),first=await claimTabSession("player",storage,locks),clone=new Storage();clone.data=new Map(storage.data);
 const second=await claimTabSession("player",clone,locks);assert.notEqual(first.sessionId,second.sessionId);
 first.release();await drain();const reload=await claimTabSession("player",storage,locks);assert.equal(first.sessionId,reload.sessionId);
 const fallback=await claimTabSession("player",storage,undefined);assert.notEqual(fallback.sessionId,reload.sessionId);
 second.release();reload.release();fallback.release();await drain();assert.equal(held.size,0);
});
function scene(active=true) {
 const events=new EventEmitter(),s={input:{enabled:true}};let status=active?"active":"paused";
 s.sys={events,scene:s,isActive:()=>status==="active",isPaused:()=>status==="paused",pause(){status="paused";},resume(){status="active";events.emit("resume");}};
 return s;
}
test("force pause survives menu close, Escape, stage start and death timeout; only owned scenes resume",async()=>{
 const bus=new GameEventBus(),a=scene(),prepaused=scene(false),game={events:new EventEmitter(),scene:{scenes:[a,prepaused]}};
 const controller=new CloudPauseController(game,bus);bus.pauseReasons.set("manual",true);bus.pauseReasons.set("shop",true);bus.pauseReasons.set("save-error",true);
 assert.ok(a.sys.isPaused());assert.equal(a.input.enabled,false);
 bus.pauseReasons.set("shop",false);bus.emit("pause-requested",{paused:false});bus.emit("stage-started",{stageId:event.stageId,attempt:1});bus.setDeathOverlayVisible(false);
 assert.ok(a.sys.isPaused());assert.ok(bus.pauseReasons.has("save-error"));
 const newly=scene();game.scene.scenes.push(newly);game.events.emit("prestep");assert.ok(newly.sys.isPaused());
 bus.pauseReasons.set("manual",true);bus.pauseReasons.set("save-error",false);assert.ok(a.sys.isActive());assert.equal(a.input.enabled,true);assert.ok(prepaused.sys.isPaused());assert.ok(bus.pauseReasons.has("manual"));
 controller.destroy();assert.equal(game.events.listenerCount("prestep"),0);
});
test("native cutscene timer preserves remaining duration and ignores advance/skip while paused",async t=>{
 t.mock.timers.enable({apis:["Date","setTimeout"],now:1000});const timeline=new CutsceneTimeline(),seen=[];
 const done=timeline.play([{id:"one",durationMs:1000},{id:"two",durationMs:500}],b=>seen.push(b.id),true);
 t.mock.timers.tick(400);timeline.pause();timeline.advance();timeline.skip();t.mock.timers.tick(10000);assert.deepEqual(seen,["one"]);
 timeline.resume();t.mock.timers.tick(599);assert.equal(seen.length,1);t.mock.timers.tick(1);assert.deepEqual(seen,["one","two"]);t.mock.timers.tick(500);await done;
 timeline.pause();const later=timeline.play([{id:"later",durationMs:200}],b=>seen.push(b.id));assert.equal(seen.length,2);timeline.resume();t.mock.timers.tick(0);assert.equal(seen.at(-1),"later");t.mock.timers.tick(200);await later;
});

// Use actual React entry and GameShell. Replace the renderer and unrelated visual
// components with DOM ports, not browser automation or source-string assertions.
const require=createRequire(import.meta.url),load=Module._load,root=process.cwd();
for(const extension of [".ts",".tsx"]) require.extensions[extension]=(module,filename)=>module._compile(ts.transpileModule(readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
let GameEntry,CloudEntrySession,GameShell,StageScene,AuthProvider,LoginGate,AuthController,latestPhaser,latestOverlay,phaserMounts=0;
try {
 Module._load=function(name,parent,main){
  if(name.startsWith("@/"))name=path.join(root,"src",name.slice(2));
  if(name==="phaser")return {Scene:class{}};
  if(parent?.filename.endsWith("StageScene.ts"))return new Proxy({},{get:()=>class{}});
  if(parent?.filename.endsWith("GameShell.tsx")&&name==="./PhaserGame")return {PhaserGame:props=>{latestPhaser=props;phaserMounts++;return h("div",{"data-testid":"phaser"});}};
  if(parent?.filename.endsWith("GameShell.tsx")&&name==="./GameOverlay")return {GameOverlay:props=>{latestOverlay=props;return h("button",{onClick:props.onResetProgress},"진행 초기화 열기");}};
  if(parent?.filename.endsWith("GameShell.tsx")&&/^\.\//.test(name)&&!["./ResetProgressDialog","./GameEventBridge","./CutsceneOverlay"].includes(name))return new Proxy({},{get:()=>()=>null});
  return load.call(this,name,parent,main);
 };
 ({GameEntry,CloudEntrySession}=require("../src/components/game/GameEntry.tsx"));({GameShell}=require("../src/components/game/GameShell.tsx"));({StageScene}=require("../src/game/scenes/StageScene.ts"));
 ({AuthProvider}=require("../src/auth/AuthProvider.tsx"));({LoginGate}=require("../src/components/game/LoginGate.tsx"));({AuthController}=require("../src/auth/AuthController.ts"));
}finally{Module._load=load;}
const mockAuth=()=>new AuthController(()=>({tenantId:"11111111-1111-4111-8111-111111111111",webClientId:"22222222-2222-4222-8222-222222222222",apiClientId:"33333333-3333-4333-8333-333333333333",redirectUri:"http://localhost:3000/"}),async()=>({getActiveAccount:()=>null}));
test("signed-out React gate creates zero Phaser instances in StrictMode",async()=>{
 phaserMounts=0;render(h(StrictMode,null,h(AuthProvider,{controller:mockAuth()},h(LoginGate,null,h(GameShell,{mode:"local",initialStageId:"world-04-stage-1"})))));
 await screen.findByRole("button",{name:"Microsoft 계정으로 로그인"});assert.equal(phaserMounts,0);
});
test("actual React connection waits through bootstrap, shows retry on 503, then mounts a single session in StrictMode",async t=>{
 const c=await fixture(t);await c.api.release(c.lease);window.localStorage.clear();window.sessionStorage.clear();phaserMounts=0;
 const controller=mockAuth();controller.clientLoader=async()=>({getActiveAccount:()=>({homeAccountId:"home",tenantId:"11111111-1111-4111-8111-111111111111"}),acquireTokenSilent:async()=>({accessToken:"ACCESS"})});
 let fail=true;t.mock.method(globalThis,"fetch",async(url,options)=>{
  const action=String(url).split("/").at(-1),input=options.body?JSON.parse(options.body):undefined;
  if(fail)return new Response(JSON.stringify({error:{code:"UNAVAILABLE",message:"잠시 후 다시 시도해 주세요.",retryAfterMs:0}}),{status:503});
  return new Response(JSON.stringify(await c.api[action](input)),{status:200});
 });
 render(h(StrictMode,null,h(AuthProvider,{controller},h(LoginGate,null,h(CloudEntrySession)))));
 await screen.findByRole("button",{name:"다시 시도"});assert.equal(phaserMounts,0);assert.equal(window.localStorage.length,0);
 fail=false;c.calls.length=0;await act(async()=>screen.getByRole("button",{name:"다시 시도"}).click());await screen.findByTestId("phaser");
 assert.equal(c.calls.filter(x=>x==="acquire").length,1);assert.equal(latestPhaser.cloudEntry.resume.stageId,"world-01-stage-1");
});
test("real StageScene refuses direct resume while another pause reason remains",()=>{
 const bus=new GameEventBus(),s=Object.create(StageScene.prototype);let status="play",physicsPaused=false;
 Object.assign(s,{eventBus:bus,runtime:{getStatus:()=>status,pause(){status="paused";},resume(){status="play";}},physics:{world:{pause(){physicsPaused=true;},resume(){physicsPaused=false;}}},cameras:{main:{shakeEffect:{reset(){}}}},publishBossFeedback(){}});
 bus.pauseReasons.set("save-error",true);s.setPaused(false);assert.equal(status,"paused");assert.ok(physicsPaused);
 bus.emit("pause-requested",{paused:false});s.setPaused(false);assert.equal(status,"paused");
 bus.pauseReasons.set("manual",true);bus.pauseReasons.set("save-error",false);s.setPaused(false);assert.equal(status,"paused");
 bus.pauseReasons.set("manual",false);s.setPaused(false);assert.equal(status,"play");assert.equal(physicsPaused,false);
});
test("local development entry keeps W4 convenience, uses isolated key, and calls no API",async t=>{
 const originalMode=process.env.NEXT_PUBLIC_GAME_MODE,originalNode=process.env.NODE_ENV;process.env.NODE_ENV="development";process.env.NEXT_PUBLIC_GAME_MODE="local-dev";
 t.after(()=>{if(originalMode===undefined)delete process.env.NEXT_PUBLIC_GAME_MODE;else process.env.NEXT_PUBLIC_GAME_MODE=originalMode;process.env.NODE_ENV=originalNode;});
 const calls=[];t.mock.method(globalThis,"fetch",async(...a)=>{calls.push(a);throw Error("unexpected API");});
 window.localStorage.clear();window.localStorage.setItem("legendary-rib-corgi:progress:v1","legacy unchanged");render(h(GameEntry));await screen.findByTestId("phaser");
 assert.equal(latestPhaser.cloudEntry,undefined);assert.equal(latestPhaser.progressState.clearedStages.includes("world-03-stage-boss"),true);assert.equal(latestOverlay.runtime.stageId,"world-04-stage-1");
 cleanup();assert.equal(calls.length,0);assert.equal(window.localStorage.getItem("legendary-rib-corgi:progress:v1"),"legacy unchanged");assert.ok(window.localStorage.getItem("legendary-rib-corgi:development:progress:v1"));
});
test("cloud shell uses account progress, error reset retains renderer, and closing manual pause cannot clear save error",async t=>{
 const c=await fixture(t);await c.controller.start();const cloud=c.controller.getSnapshot().cloud;cloud.bootstrap.current.progress.onboardingCompleted=true;
 const props={mode:"cloud",cloud,initialStageId:event.stageId,onCloudObservation:c.controller.observe,onCloudReset:async()=>{throw Error("offline");}};
 render(h(GameShell,props));await screen.findByTestId("phaser");assert.equal(latestPhaser.progressState.clearedStages.includes("world-03-stage-boss"),false);
 await act(async()=>{cloud.bus.emit("stage-started",{stageId:event.stageId,attempt:1});});
 await act(async()=>screen.getByRole("button",{name:"진행 초기화 열기"}).click());await act(async()=>screen.getByRole("button",{name:"초기화",exact:true}).click());
 assert.ok(screen.getByRole("alert"));assert.ok(screen.getByTestId("phaser"));assert.ok(cloud.bus.pauseReasons.has("reset"));
 c.api.save=async()=>{throw new ApiClientError(503,"UNAVAILABLE","offline");};
 await act(async()=>{c.controller.observe(event,latestPhaser.progressState);await assert.rejects(cloud.saves.flush());});
 await act(async()=>{cloud.bus.emit("pause-requested",{paused:false});cloud.bus.emit("stage-started",{stageId:event.stageId,attempt:2});cloud.bus.setDeathOverlayVisible(false);});
 assert.equal(latestOverlay.paused,true);assert.ok(cloud.bus.pauseReasons.has("save-error"));
 await act(async()=>{cloud.bus.emit("death",{stageId:event.stageId,cause:"fall",position:{x:0,y:0}});});assert.ok(cloud.bus.isDeathOverlayVisible());
 await act(async()=>new Promise(resolve=>setTimeout(resolve,920)));assert.equal(cloud.bus.isDeathOverlayVisible(),false);assert.equal(latestOverlay.paused,true);assert.ok(cloud.bus.pauseReasons.has("save-error"));
});
