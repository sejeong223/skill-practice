import assert from 'node:assert/strict';
import { existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { requireTS } from './world04-test-fixtures.mjs';
// Dedicated browser only. --stage 1..4 selects a complete route; --suite cases
// selects local regression fixtures (--case accepts comma-separated prefixes).
// --fps 30, --screenshots and --trace-inputs are optional. No gameplay writes
// occur after a complete route starts; local fixture preparation is explicit.
const { createDefaultProgressState } = requireTS('../src/game/core/constants.ts');
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const gameExpression = `(() => {
  const mount = document.querySelector('canvas')?.parentElement;
  let fiber = mount?.[Object.keys(mount).find(k => k.startsWith('__reactFiber$'))];
  while (fiber) { for (let h = fiber.memoizedState; h; h = h.next) if (h.memoizedState?.current?.scene?.getScene) return h.memoizedState.current; fiber = fiber.return; }
  return null;
})()`;
export const sceneExpression = `(${gameExpression})?.scene.getScene('StageScene')`;
const keyMap = { left: ['ArrowLeft', 'ArrowLeft', 37], right: ['ArrowRight', 'ArrowRight', 39], jump: [' ', 'Space', 32], dash: ['1', 'Digit1', 49], pause: ['Escape', 'Escape', 27] };

export async function connect(options) {
  let tabs;
  try { tabs = await fetch(`${options.cdp}/json/list`, { signal: AbortSignal.timeout(10000) }).then(r => r.json()); }
  catch (e) { throw new Error(`Cannot connect to dedicated CDP ${options.cdp}`, { cause: e }); }
  const tab = tabs.find(t => t.type === 'page' && t.url.startsWith(options.url));
  if (!tab) throw new Error(`Dedicated page missing: ${options.url} at ${options.cdp}`);
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const pending = new Map(), errors = [], missingAssets = [], held = new Set(); let serial = 0;
  ws.onmessage = event => {
    const m = JSON.parse(event.data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Network.responseReceived' && m.params.response.status === 404 && m.params.response.url.includes('/assets/')) missingAssets.push(m.params.response.url);
    const p = pending.get(m.id); if (!p) return; pending.delete(m.id); clearTimeout(p.timer);
    if (m.error) p.reject(new Error(JSON.stringify(m.error))); else p.resolve(m.result);
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial, timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result?.value;
  };
  const key = async (action, pressed) => {
    if (held.has(action) === pressed) return;
    const [key, code, windowsVirtualKeyCode] = keyMap[action];
    await call('Input.dispatchKeyEvent', { type: pressed ? 'keyDown' : 'keyUp', key, code, windowsVirtualKeyCode });
    if (pressed) held.add(action); else held.delete(action);
  };
  const release = async () => { for (const action of [...held]) await key(action, false); };
  const state = () => evaluate(`(() => { const s=${sceneExpression}; if (!s?.player) return null; const b=s.player.body; return {
    stage:s.stageId,status:s.runtime?.getStatus(),x:s.player.x,y:s.player.y,left:b.x,right:b.right,bottom:b.bottom,vx:b.velocity.x,vy:b.velocity.y,grounded:b.blocked.down||b.touching.down,
    deaths:s.progress.deathsTotal,checkpoint:s.runtime.runtimeState.checkpointId,attempt:s.runtime.runtimeState.attempt,frame:window.__w4updates??s.game.loop.frame,time:s.time.now,
    skills:s.progress.unlockedSkills,dashing:s.playerController.isDashing(),cooldown:s.skillSystem?.getRemainingCooldown('dash',s.skillElapsedMs),hazards:s.world04Hazards?.getDebugState(),overlay:s.eventBus.isDeathOverlayVisible(),
    timers:s.time._active.length+s.time._pendingInsertion.length,preUpdateListeners:s.events.listenerCount('preupdate'),banked:s.progress.bankedCoins,stageCoins:s.runtime.runtimeState.currentStageCoins,coins:s.runtime.getEntities('coin').length,colliders:s.physics.world.colliders.getActive().length,
    camera:{x:s.cameras.main.scrollX,width:s.cameras.main.width},launches:window.__w4launches,paused:s.physics.world.isPaused,lastDeath:window.__w4lastDeath,inputs:window.__w4inputs
  }; })()`);
  const until = async (predicate, label, timeout = 30000) => { const end = Date.now() + timeout; while (Date.now() < end) { const s = await state(); if (predicate(s)) return s; await sleep(16); } throw new Error(`${label}: ${JSON.stringify(await state())}`); };
  const shot = async name => { if(!options.screenshots)return null; const r = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); const file = path.join(os.tmpdir(), `world04-${name}.png`); writeFileSync(file, Buffer.from(r.data, 'base64')); return file; };
  await call('Runtime.enable'); await call('Page.enable'); await call('Network.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await call('Page.bringToFront');
  return { fps:options.fps??60, traceInputs:options.traceInputs??false, call, evaluate, key, release, state, until, shot, errors, missingAssets, close: async () => { await release(); ws.close(); } };
}

export async function prepareStage(c, stageId, prepareX = 96) {
  await c.release();
  const progress = createDefaultProgressState('World 4 verification');
  progress.onboardingCompleted = true;
  progress.clearedStages = ['world-01-stage-boss', 'world-02-stage-boss', 'world-03-stage-boss'];
  progress.unlockedSkills = ['bark', 'bite', 'dash'];
  progress.keybinds = { ...progress.keybinds, left: 'ArrowLeft', right: 'ArrowRight', jump: 'Space', dash: 'Digit1' };
  const deadline = Date.now() + 30000;
  while (!await c.evaluate(`(() => { const g=${gameExpression}; return !!g?.textures.exists('world-04-scrapyard-saw') && g.scene.getScenes(true).length>0 && g.scene.getScenes(true).every(s=>!['BootScene','PreloadScene'].includes(s.scene.key)); })()`)) { if (Date.now() > deadline) throw new Error('Game/assets not ready'); await sleep(100); }
  if(!c.fpsConfigured){
    if(c.fps===30)await c.evaluate(`(()=>{const l=(${gameExpression}).loop;l.sleep();l.forceSetTimeOut=true;l._target=1000/30;l.hasFpsLimit=false;l.smoothStep=false;l.wake(true);})()`);
    c.fpsConfigured=true;
  }
  if(!c.initialSettled){await sleep(500);c.initialSettled=true;}
  await c.until(s=>!s?.overlay,'previous death overlay finishes',3000);
  await c.evaluate(`(() => { const g=${gameExpression}; for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); const progress=g.registry.get('progressState'); Object.assign(progress,${JSON.stringify(progress)}); g.registry.set('progressState',progress); g.scene.start('StageScene',{stageId:${JSON.stringify(stageId)},seed:1,skipBossIntro:true}); })()`);
  await c.until(s => s?.stage === stageId && s.status === 'play', `start ${stageId}`);
  await c.evaluate(`(() => { const s=${sceneExpression}; s.eventBus.emit('cutscene-finished',{cutsceneId:'qa-preparation'}); s.player.resetTo(s.world04Layout?{x:${prepareX},y:504}:s.stageDefinition.spawn); s.player.setVelocity(0,0); s.world04Hazards?.resetForAttempt(${prepareX}); s.world04PreviousCenterX=${prepareX}; s.input.keyboard.resetKeys(); })()`);
  await c.evaluate(`(() => { const s=${sceneExpression}; window.__w4lastDeath=null; window.__w4inputs=[];window.__w4launches=0;s.player.on('player-jump-started',()=>window.__w4launches++); window.__w4updates=0;window.__w4keylog=[];window.__w4start=performance.now();
    const before=()=>window.__w4updates++;s.events.on('preupdate',before);s.events.once('shutdown',()=>s.events.off('preupdate',before));
    if(!window.__w4keyListener){window.__w4keyListener=e=>window.__w4keylog.push({atMs:Math.round(performance.now()-window.__w4start),code:e.code,pressed:e.type==='keydown'});document.addEventListener('keydown',window.__w4keyListener);document.addEventListener('keyup',window.__w4keyListener);} const emit=s.gameplayEventBus.emit.bind(s.gameplayEventBus); s.gameplayEventBus.emit=(type,p)=>{if(type==='death-requested') window.__w4lastDeath={...p,x:s.player.body.x,y:s.player.body.y,right:s.player.body.right,bottom:s.player.body.bottom,dash:s.playerController.isDashing(),hazard:s.world04Hazards?.getDebugState().find(h=>h.id===p.gimmickId),previous:s.world04Hazards?.air.previous}; return emit(type,p);}; const after=()=>{const i=s.inputManager?.getSnapshot(); if(i?.dashPressed) window.__w4inputs.push({time:s.time.now,x:s.player?.x,dashing:s.playerController?.isDashing(),cooldown:s.skillSystem?.getRemainingCooldown('dash',s.skillElapsedMs),keys:i});};s.events.on('postupdate',after);s.events.once('shutdown',()=>s.events.off('postupdate',after)); })()`);
  await sleep(70);
  return c.state();
}

export async function runRoute(c, stageId) {
  await prepareStage(c, stageId);
  const start = await c.state(), trace = [];
  const wait = async (predicate, label, timeout = 10000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const s = await c.state(); trace.push({ x: s.x, y: s.y, vx: s.vx, vy: s.vy, time: s.time, deaths: s.deaths, dash:s.dashing });
      if (trace.length > 40) trace.shift();
      if (s.deaths !== start.deaths) throw new Error(`${label}: death at ${JSON.stringify(trace.slice(-12))}`);
      if (predicate(s)) return s; await sleep(12);
    }
    throw new Error(`${label}: timeout ${JSON.stringify(await c.state())}`);
  };
  const right = async x => { await c.key('left', false); await c.key('right', true); return wait(s => s.x >= x, `right ${x}`); };
  const pulse = async action => { const frame = (await c.state()).frame; await c.key(action, true); await wait(s => s.frame >= frame + 2, `input ${action}`); await c.key(action, false); };
  const stop = async () => { await c.release(); await wait(s=>Math.abs(s.vx)<1 && s.grounded,'stop'); };
  const ready = async () => wait(s=>s.cooldown===0,'dash ready');
  const hazard = (s,cell,kind) => s.hazards.find(h=>h.id.includes(`-${cell}-`) && h.kind===kind);
  const jumpDash = async () => { await pulse('jump'); await wait(s=>s.y<475,'jump ascent'); await pulse('dash'); };
  const sawWindow = async cell => wait(s=>{const t=hazard(s,cell,'saw').elapsedMs%1800;return t>1200&&t<1280;},'saw returning');
  const tunnel = async (cableX) => {
    await right(920); await stop(); await ready();
    await right(cableX-64); await pulse('dash');
    await right(1300); await stop();
    await c.key('left',true); await wait(s=>s.x<=1312,'tunnel landing reposition'); await stop();
    await ready(); await sawWindow('B');
    await right(c.fps===30?1308:1328); await jumpDash(); await right(1512);
  };
  const retreat = async (cell, x) => {
    await right(x-56);
    await wait(s=>hazard(s,cell,'rise').state==='retreat','rise onset');
    await c.key('right',false); await c.key('left',true);
    await wait(s=>s.x<x-48,'retreat'); await stop();
    await wait(s=>hazard(s,cell,'rise').state==='spent','rise spent');
  };
  const plate = async (cell, x, earlyScrap=false) => {
    await right(x-52); await stop(); await ready();
    await c.key('right',true); await wait(s=>hazard(s,cell,'belt').elapsedMs>0,'belt clock'); await stop();
    await wait(s=>{const t=hazard(s,cell,'belt').elapsedMs%4800; return t>2420&&t<2850;},'forward belt');
    if (earlyScrap) {
      await right(x+60); await pulse('jump'); await right(x+130); await pulse('dash');
    } else if(c.fps===30) {
      await right(x+184); await pulse('jump'); await pulse('dash');
    } else {
      await right(x+184); await pulse('dash'); await pulse('jump');
    }
    await right(x+420);
  };
  const press = async (cell,x,extra) => {
    await right(x+184); await stop(); await ready();
    await wait(s=>hazard(s,cell,'press').elapsedMs%1960<80,'press open');
    await right(x+224); await pulse('dash');
    if (extra) {
      await right(x+408); await stop(); await ready(); await sawWindow(cell);
      await right(x+416); await jumpDash(); await right(x+552);
    } else await right(x+472);
  };
  const tireSwing = async () => {
    await right(384); await wait(s=>s.vy<-400,'tire launch');
    await right(520); await pulse('dash');
    await right(728); await stop(); await ready();
    await wait(s=>hazard(s,'A','swing').rects[0].x<550,'swing away');
    await right(736); await pulse('jump'); await wait(s=>s.y<420,'platform jump'); await pulse('dash');
    await right(880);
  };
  const sawScrap = async () => {
    await right(3210); await stop(); await ready();
    await wait(s=>{const t=hazard(s,'E','saw').elapsedMs%1800;return t>900&&t<980;},'last saw returning');
    await right(3304); await ready(); await jumpDash();
    await right(3696);
  };
  const approach = async (number) => {
    if (number>=2) {
      await right(number===4?2200:2164); await stop(); await ready();
      if (number>=3) await wait(s=>{const t=s.hazards.find(h=>h.id.endsWith('approach-saw')).elapsedMs%1800;return t>1350&&t<1410;},'approach saw returning');
      await right(2216); await jumpDash();
    }
    await right(2608);
    assert.ok((await c.state()).checkpoint, 'crossing activates checkpoint');
  };
  const number=Number(stageId.slice(-1));
  try {
    if (number===1) {
      await right(348); await pulse('jump');
      await wait(s=>s.x>=568&&s.vy<-400,'tire bounce');
      await wait(s=>s.y<385,'bounce ascent'); await pulse('dash');
      await tunnel(1216);
      await right(1620); await wait(s=>s.x>=1664&&s.vy<-400,'second tire');
      await right(1824); await pulse('dash'); await right(1912); await stop(); await ready(); await sawWindow('C');
      await right(1992); await jumpDash();
      await approach(number); await retreat('D',2896);
      await right(2984); await pulse('jump');
      await plate('E',3232);
    } else if (number===2) {
      await tireSwing(); await tunnel(1230); await press('C',1600,true);
      await approach(number); await retreat('D',2896);
      await right(2984); await pulse('jump'); await sawScrap();
    } else if (number===3) {
      await right(332); await stop();
      await wait(s=>{const t=hazard(s,'A','crane').elapsedMs%5200;return t>1400&&t<1460;},'crane lift');
      await c.key('right',true); await jumpDash(); await right(464); await stop();
      await wait(s=>{const t=hazard(s,'A','crane').elapsedMs%5200;return t>3750&&t<3850;},'crane return lift');
      await right(712); await pulse('dash'); await right(860);
      await plate('B',944); await press('C',1600,true); await approach(number);
      await right(2920); await stop(); await ready();
      await right(2956); await jumpDash(); await sawScrap();
    } else {
      await tireSwing(); await tunnel(1230); await retreat('C',1696);
      await right(1928); await stop();
      await wait(s=>{const t=hazard(s,'C','crane').elapsedMs%5200;return t>1100&&t<1180;},'crane lifting');
      await right(2160); await approach(number);
      await press('D',2736,false); await plate('E',3232,true);
    }
    await c.shot(`${stageId}-exit-${c.fps}fps`);
    await c.key('right',true);
    const finish=await wait(s=>s.status==='completed','exit',10000);
    await c.release();
    await c.until(s=>s.stage!==stageId,'next stage',5000);
    const inputs=await c.evaluate('window.__w4keylog');
    return { stageId, through:'exit', fps:c.fps, observedFps:Math.round((finish.frame-start.frame)*1000/(finish.time-start.time)), deaths:finish.deaths, checkpoint:finish.checkpoint, nextStage:(await c.state()).stage, inputCount:inputs.length, ...(c.traceInputs?{inputs}:{}) };
  } catch (e) { await c.release(); const s=await c.state(); console.error('ROUTE STATE', JSON.stringify({lastDeath:s.lastDeath,inputs:s.inputs,x:s.x,y:s.y}), 'errors', c.errors); await c.shot(`${stageId}-failure`); throw e; }
}

export async function runCases(c, filter='') {
  const results=[];
  const selected=name=>!filter||filter.split(',').some(prefix=>name.startsWith(prefix));
  const h=(s,cell,kind)=>s.hazards.find(h=>h.id.includes(`-${cell}-`)&&h.kind===kind);
  const pulse=async action=>{const frame=(await c.state()).frame;await c.key(action,true);await c.until(s=>s.frame>=frame+2,`pulse ${action}`);await c.key(action,false);};
  const wait=async (predicate,label,timeout=10000)=>c.until(s=>{assert.equal(s.deaths,0,`${label}: ${JSON.stringify(s.lastDeath)}`);return predicate(s);},label,timeout);
  const right=async x=>{await c.key('left',false);await c.key('right',true);return wait(s=>s.x>=x,`right ${x}`);};
  const left=async x=>{await c.key('right',false);await c.key('left',true);return wait(s=>s.x<=x,`left ${x}`);};
  const stop=async()=>{await c.release();return wait(s=>Math.abs(s.vx)<1&&s.grounded,'stop');};
  const death=async(kind,spawn=96)=>{
    const s=await c.until(s=>s.deaths>0,`death ${kind}`,6000);await c.release();
    assert.equal(s.deaths,1);assert.ok(s.lastDeath?.gimmickId.includes(kind),JSON.stringify(s.lastDeath));
    assert.equal(s.x,spawn);await c.until(s=>!s.overlay,'death overlay finishes',3000);assert.equal((await c.state()).deaths,1);
    return s;
  };
  const freeze=async()=>{
    await pulse('pause');await c.until(s=>s.status==='paused','pause');await c.release();
    const visual=()=>c.evaluate(`(()=>{const s=${sceneExpression},o=s.world04Hazards;return [o.terrain,o.ground,o.air].flatMap(child=>child.entries.flatMap(e=>[...(e.images??[]),e.bridgeImage,e.frontImage,e.rearImage].filter(Boolean).map(i=>[i.x,i.y,i.visible,i.alpha,i.rotation,i.frame?.name])));})()`);
    const a=await c.state(),v=await visual();await sleep(1000);const b=await c.state();
    assert.deepEqual(b.hazards,a.hazards);assert.deepEqual(await visual(),v);assert.equal(b.x,a.x);assert.equal(b.y,a.y);
    await pulse('pause');await c.until(s=>s.status==='play','resume');
  };
  const run=async(name,stage,x,fn)=>{
    if(!selected(name))return;
    await prepareStage(c,stage,x);const start=await c.state();
    try{const evidence=await fn();await c.release();const end=await c.state();results.push({name,stage,deaths:end.deaths,elapsedMs:Math.round(end.time-start.time),...evidence});console.log('CASE',name,'pass');}
    catch(e){await c.release();console.error('CASE FAIL',name,JSON.stringify(await c.state()));await c.shot(`${name}-failure`);throw e;}
  };
  for(const mode of ['stay','forward','jump','dash']) await run(`rise-${mode}-dies`,'world-04-stage-1',2800,async()=>{
    await right(2900);await wait(s=>h(s,'D','rise').state==='retreat','rise onset');
    if(mode==='stay')await c.release();
    if(mode==='jump')await pulse('jump');
    if(mode==='dash')await pulse('dash');
    const s=await death('-rise-');assert.equal(h(s,'D','rise').state,'armed');return {reset:true};
  });
  await run('rise-retreat-pause-one-shot','world-04-stage-1',2800,async()=>{
    assert.equal(h(await c.state(),'D','rise').state,'armed');
    assert.equal(await c.evaluate(`${sceneExpression}.world04Hazards.terrain.entries.find(e=>e.definition.kind==='rise').frontImage.visible`),false);
    await right(2900);await wait(s=>h(s,'D','rise').state==='retreat','rise onset');
    await freeze();await left(2840);await stop();
    await wait(s=>h(s,'D','rise').state==='strike','strike');await freeze();
    await wait(s=>h(s,'D','rise').state==='lowering','lowering');await freeze();
    await wait(s=>h(s,'D','rise').state==='spent','spent');
    await right(2960);await left(2820);await right(2960);await stop();
    assert.equal(h(await c.state(),'D','rise').state,'spent');return {pauses:3,oneShot:true};
  });
  for(const mode of ['walk','jump','dash']) await run(`tunnel-${mode}`,'world-04-stage-1',900,async()=>{
    await right(1152);
    if(mode==='jump')await pulse('jump');
    if(mode==='dash')await pulse('dash');
    if(mode!=='dash'){await death('-cable-');return {expected:'death'};}
    await right(1296);await stop();assert.equal((await c.state()).deaths,0);return {expected:'pass'};
  });
  for(const mode of ['fall','jump']) await run(`collapse-${mode}`,'world-04-stage-1',1740,async()=>{
    // Local case preparation: a player waiting in cell C for 5.4s. Full routes
    // never set clocks or move the player after starting their input sequence.
    await c.evaluate(`(()=>{const a=${sceneExpression}.world04Hazards.air;for(const e of a.entries.filter(e=>e.definition.id.includes('-C-')))e.clock={...e.clock,started:true,elapsedMs:5400};a.update(0);})()`);
    await c.key('right',true);await wait(s=>h(s,'C','collapse').state!=='armed','floor opens');
    const enabled=await c.evaluate(`${sceneExpression}.world04Hazards.terrain.entries.find(e=>e.definition.kind==='collapse').bridge.body.enable`);
    assert.equal(enabled,false);
    if(mode==='fall'){await death('-fall');return {bridgeRemoved:true};}
    await right(1816);await pulse('jump');await right(1844);await pulse('dash');await right(1952);await c.release();
    await wait(s=>s.grounded,'land');return {bridgeRemoved:true};
  });
  await run('saw-tire-without-dash-dies','world-04-stage-1',96,async()=>{
    await right(348);await pulse('jump');await wait(s=>s.x>=568&&s.vy<-400,'tire launches');
    const velocity=(await c.state()).vy;await death('-saw-');return {launchVy:velocity};
  });
  await run('swing-without-dash-dies','world-04-stage-2',96,async()=>{
    await right(384);await wait(s=>s.vy<-400,'tire launches');await death('-swing-');
  });
  for(const [kind,x,y,cell] of [['saw',532,260,'A'],['swing',1846,373,'C']])await run(`corner-${kind}`,'world-04-stage-1',96,async()=>{
    // A local transparent-corner fixture, before any input; no invulnerability.
    await c.evaluate(`(()=>{const s=${sceneExpression};s.player.resetTo({x:${x},y:${y}});s.player.setVelocity(0,0);s.world04Hazards.resetForAttempt(${x});s.world04PreviousCenterX=${x};})()`);
    const a=await c.state(),box=h(a,cell,kind).rects[0];
    assert.ok(a.right>box.x&&a.left<box.x+box.width&&a.bottom>box.y&&a.bottom-40<box.y+box.height);
    assert.equal(a.dashing,false);await c.key('left',true);await wait(s=>s.x<x-4,'leave transparent corner');await c.release();return {boundingBoxContact:true};
  });
  await run('crane-physical-beats-dash','world-04-stage-3',494,async()=>{
    await c.key('right',true);await pulse('dash');const s=await death('-crane-');assert.equal(s.lastDeath.dash,true);
  });
  await run('press-physical-beats-dash','world-04-stage-2',1560,async()=>{
    await right(1784);await stop();await wait(s=>{const t=h(s,'C','press').elapsedMs%1960;return t>1200&&t<1300;},'press closed');
    await c.key('right',true);await pulse('dash');const s=await death('-press-');assert.equal(s.lastDeath.dash,true);
  });
  await run('gate-closing-crushes','world-04-stage-3',900,async()=>{
    await right(1032);await pulse('dash');await c.release();await death('-plate-gate-');
  });
  await run('gate-pause-rearm','world-04-stage-3',900,async()=>{
    await right(1012);await stop();assert.equal(h(await c.state(),'B','plate-gate').state,'open');await freeze();
    await wait(s=>h(s,'B','plate-gate').state==='rearming','gate timeout');
    await left(960);await stop();await wait(s=>h(s,'B','plate-gate').state==='closed','gate rearmed');
    await right(1008);await c.release();assert.equal(h(await c.state(),'B','plate-gate').state,'open');return {reopened:true,pauses:1};
  });
  await run('checkpoint-air-dash-and-respawn','world-04-stage-1',2410,async()=>{
    await right(2456);await pulse('jump');await pulse('dash');const s=await wait(s=>s.checkpoint,'checkpoint');
    assert.equal(s.grounded,false);assert.equal(s.dashing,true);await right(2916);await death('-rise-',2496);return {airDash:true};
  });
  await run('coins-and-repeat-death','world-04-stage-1',96,async()=>{
    await right(380);const before=await c.state();assert.ok(before.banked>0);await death('-scrap-');
    const after=await c.state();assert.equal(after.banked,before.banked);return {banked:after.banked,deathsOnce:true};
  });
  await run('surface-oil-braking','world-04-stage-1',940,async()=>{
    await right(1040);await c.release();const a=await c.state();const b=await wait(s=>Math.abs(s.vx)<1,'oil stops');
    const drift=b.x-a.x;assert.ok(drift>50&&drift<110,`oil drift ${drift}`);return {drift};
  });
  await run('surface-dry-braking','world-04-stage-1',2300,async()=>{
    await right(2350);await c.release();const a=await c.state();const b=await wait(s=>Math.abs(s.vx)<1,'dry stops');
    const drift=b.x-a.x;assert.ok(drift<30,`dry drift ${drift}`);return {drift};
  });
  for(const reverse of [false,true])await run(`surface-belt-${reverse?'forward':'backward'}`,'world-04-stage-2',1560,async()=>{
    if(reverse){await right(1570);await stop();await wait(s=>h(s,'C','belt').elapsedMs>2420,'belt reversed');}
    await right(1700);const ground=(await c.state()).vx;assert.ok(Math.abs(ground-(reverse?330:150))<5,`belt vx ${ground}`);
    await pulse('jump');await wait(s=>s.y<490&&s.vx===240,'off belt');return {groundVx:ground,airVx:240};
  });
  await run('surface-tire-rearms-after-leaving','world-04-stage-1',1660,async()=>{
    await right(1668);await c.release();await wait(s=>s.launches===1,'first launch');await wait(s=>s.grounded,'same pad landing');
    await sleep(250);assert.equal((await c.state()).launches,1);await right(1752);await stop();await left(1728);
    assert.equal((await c.state()).launches,2);return {launches:2};
  });
  await run('viewport-checkpoint','world-04-stage-1',2430,async()=>{
    await sleep(250);const wide=await c.shot('checkpoint-wide');
    await c.call('Emulation.setDeviceMetricsOverride',{width:768,height:720,deviceScaleFactor:1,mobile:false});await sleep(300);
    const narrow=await c.shot('checkpoint-narrow');assert.equal((await c.state()).deaths,0);
    await c.call('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});return {wide,narrow};
  });
  for(const stage of ['world-01-stage-1','world-02-stage-1','world-03-stage-1','world-04-stage-boss'])await run(`regression-${stage}`,stage,96,async()=>{
    assert.equal(await c.evaluate(`Boolean(${sceneExpression}.world04Hazards)`),false);
    const a=await c.state();await c.key('right',true);await sleep(200);await c.release();const b=await c.state();
    assert.ok(b.x>a.x+5);assert.equal(b.deaths,0);return {moved:b.x-a.x};
  });
  if(selected('lifecycle')){
    const counts=[],timers=[],listeners=[];
    for(let i=0;i<3;i++){await prepareStage(c,'world-04-stage-1');const s=await c.state();counts.push(s.colliders);timers.push(s.timers);listeners.push(s.preUpdateListeners);}
    for(const samples of [counts,timers,listeners])assert.equal(new Set(samples).size,1);results.push({name:'lifecycle',colliders:counts,timers,listeners});
  }
  return results;
}

export async function main(options) {
  options={fps:60,suite:'all',stage:null,caseFilter:'',screenshots:false,launch:false,traceInputs:false,...options};
  if(![30,60].includes(options.fps))throw new Error('--fps must be 30 or 60');
  if(!['all','routes','cases'].includes(options.suite))throw new Error('--suite must be all, routes or cases');
  if(options.stage!==null&&![1,2,3,4].includes(options.stage))throw new Error('--stage must be 1..4');
  for(const value of [options.url,options.cdp])if(!value||!['http:','https:'].includes(new URL(value).protocol))throw new Error('Expected an HTTP URL and CDP endpoint');
  let child, c;
  try {
    if (options.launch) {
      let portInUse=false;
      try{portInUse=(await fetch(`${options.cdp}/json/version`,{signal:AbortSignal.timeout(500)})).ok;}catch{}
      if(portInUse)throw new Error(`Dedicated CDP port is already in use: ${options.cdp}. Choose another --cdp port.`);
      const candidates = [options.chromePath, path.join(process.env.PROGRAMFILES ?? '', 'Google/Chrome/Application/chrome.exe'), path.join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe')].filter(Boolean);
      const executable = candidates.find(existsSync); if (!executable) throw new Error('Chrome not found; specify --chrome');
      const profile = mkdtempSync(path.join(os.tmpdir(), 'world04-chrome-'));
      child = spawn(executable, ['--headless=new', `--remote-debugging-port=${new URL(options.cdp).port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required', '--window-size=1280,720', options.url], { windowsHide: true, stdio: 'ignore' });
      await sleep(1500);
    }
    c = await connect(options);
    const results = [];
    if(options.suite!=='cases')for (let i = options.stage ?? 1; i <= (options.stage ?? 4); i++)results.push(await runRoute(c, `world-04-stage-${i}`));
    if(options.suite!=='routes'){
      const cases=await runCases(c,options.caseFilter);assert.ok(cases.length,'No matching cases');results.push(...cases);
    }
    assert.deepEqual(c.errors, []); assert.deepEqual(c.missingAssets, []);
    console.log(JSON.stringify({ results, errors: c.errors, missingAssets: c.missingAssets }));
  } finally { try{await c?.close();}finally{child?.kill();} }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = key => { const i = process.argv.indexOf(key); if (i < 0) return null; const value = process.argv[i + 1]; if (!value || value.startsWith('--')) throw new Error(`Missing value: ${key}`); return value; };
  await main({ url: arg('--url') ?? 'http://127.0.0.1:3000', cdp: arg('--cdp') ?? 'http://127.0.0.1:9229', launch: process.argv.includes('--launch'), screenshots: process.argv.includes('--screenshots'), chromePath: arg('--chrome'), stage: arg('--stage') ? Number(arg('--stage')) : null, suite: arg('--suite') ?? (arg('--stage')?'routes':'all'), caseFilter: arg('--case') ?? '', fps: Number(arg('--fps') ?? 60), traceInputs: process.argv.includes('--trace-inputs') });
}
