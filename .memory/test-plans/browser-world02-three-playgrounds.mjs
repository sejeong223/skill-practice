import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { createDefaultProgressState } = require(path.join(root, 'src/game/core/constants.ts'));
const { PROGRESS_STORAGE_KEY } = require(path.join(root, 'src/game/persistence/saveTypes.ts'));

const tab = (await fetch('http://127.0.0.1:9229/json/list').then(response => response.json()))
  .find(item => item.type === 'page');
if (!tab) throw new Error('Dedicated Chrome page is missing');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let serial = 0;
const pending = new Map();
const errors = [];
const missingAssets = [];
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params?.exceptionDetails?.text);
  if (message.method === 'Network.responseReceived' && message.params?.response?.status === 404 &&
      message.params.response.url.includes('/assets/')) missingAssets.push(message.params.response.url);
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
  else waiter.resolve(message.result);
};
function call(method, params = {}) {
  const id = ++serial;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(`${result.exceptionDetails.text}: ${expression.slice(0, 100)}`);
  return result.result?.value;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, label) => { if (!condition) throw new Error(label); };
const scene = `(() => {
  const mount = document.querySelector('canvas')?.parentElement;
  const key = mount && Object.keys(mount).find(name => name.startsWith('__reactFiber$'));
  let fiber = key ? mount[key] : null, game;
  while (fiber && !game) {
    for (let hook = fiber.memoizedState; hook; hook = hook.next) {
      if (hook.memoizedState?.current?.scene?.getScene) { game = hook.memoizedState.current; break; }
    }
    fiber = fiber.return;
  }
  return game?.scene?.getScene('StageScene');
})()`;
const state = `(() => {
  const s = ${scene};
  return s ? {
    stage:s.stageId, status:s.runtime?.getStatus(), seed:s.runtime?.runtimeState.randomSeed,
    scenes:s.game?.scene?.scenes?.map(item=>({key:item.scene.key,active:item.scene.isActive(),error:item.loadError})),
    location:location.href, storageKeys:Object.keys(localStorage),
    registryProgress:s.registry.get('progressState') && {onboarding:s.registry.get('progressState').onboardingCompleted,selected:s.registry.get('progressState').selectedWorldId},
    runSeed:s.registry.get('world02RunSeed'), travel:s.registry.get('world02TravelState'),
    x:s.player?.x, checkpoint:s.runtime?.runtimeState.checkpointId,
    bank:s.progress?.bankedCoins, deaths:s.progress?.deathsTotal,
    cleared:[...(s.progress?.clearedStages ?? [])],
    obstacles:s.world02Obstacles?.sprites?.map(({definition,image})=>({id:definition.id,kind:definition.kind,x:definition.x,key:image.texture.key})),
    pigeons:s.world02PigeonDrops?.definitions?.map(({dropX})=>dropX),
    coins:s.runtime?.getEntities('coin')?.map(({id,entity})=>({id,active:entity.active})),
  } : null;
})()`;
async function getState() { return evaluate(state); }
async function until(predicate, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const current = await getState();
    if (predicate(current)) return current;
    await sleep(40);
  }
  throw new Error(`${label}: ${JSON.stringify(await getState())}`);
}
async function teleport(x, y = 440) {
  await evaluate(`(() => { const s=${scene}; s.player.resetTo({x:${x},y:${y}}); s.player.setVelocity(0,0); })()`);
}
async function advance(target) {
  await teleport(3920);
  return until(s => s?.stage === target && (target.endsWith('boss') || s.status === 'play'), `advance to ${target}`);
}
async function backtrack(target) {
  await teleport(65);
  await call('Input.dispatchKeyEvent', { type:'keyDown', key:'ArrowLeft', code:'ArrowLeft', windowsVirtualKeyCode:37 });
  try { return await until(s => s?.stage === target && s.status === 'play', `backtrack to ${target}`); }
  finally { await call('Input.dispatchKeyEvent', { type:'keyUp', key:'ArrowLeft', code:'ArrowLeft', windowsVirtualKeyCode:37 }); }
}
async function screenshot(name) {
  const shot = await call('Page.captureScreenshot', { format:'png', captureBeyondViewport:false });
  fs.writeFileSync(path.join(root, `.memory/test-plans/assets/${name}.png`), Buffer.from(shot.data, 'base64'));
}
async function pigeonInterval(stageId) {
  const first = (await getState()).pigeons[0];
  await evaluate(`(() => { const s=${scene}; window.__spawnTimes=[]; const system=s.world02PigeonDrops;
    const original=system.spawnFlight.bind(system); system.spawnFlight=(pass)=>{window.__spawnTimes.push(s.time.now);original(pass);}; })()`);
  await teleport(first - 445);
  const start = Date.now();
  while (Date.now() - start < 7000) {
    const times = await evaluate('window.__spawnTimes');
    if (times?.length >= 2) {
      const gap = times[1] - times[0];
      assert(Math.abs(gap - 3000) < 120, `${stageId}: pigeon interval ${gap}`);
      return gap;
    }
    await sleep(40);
  }
  throw new Error(`${stageId}: second pigeon did not spawn`);
}

try {
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Emulation.setDeviceMetricsOverride', { width:1280, height:720, deviceScaleFactor:1, mobile:false });
  const progress = createDefaultProgressState('Playground test corgi');
  progress.onboardingCompleted = true;
  progress.selectedWorldId = 'world-02';
  progress.clearedStages = ['world-01-stage-boss'];
  progress.seenCutsceneIds = ['intro-home', 'world-02-intro', 'world-02-boss-intro'];
  const envelope = { schemaVersion:3, updatedAt:new Date().toISOString(), progress };
  const injection = await call('Page.addScriptToEvaluateOnNewDocument', {
    source:`if (location.hostname === 'localhost') localStorage.setItem(${JSON.stringify(PROGRESS_STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(envelope))})`,
  });
  try {
    await call('Page.navigate', { url:process.env.WORLD02_BASE_URL ?? 'http://localhost:3002' });
    const initial = await until(s => s?.scenes?.some(item => item.active), 'game boot');
    if (initial.scenes.some(item => item.key === 'IntroScene' && item.active)) {
      // Development mode intentionally replays the intro; start the requested test stage in that mode.
      await evaluate(`(() => { const s=${scene}; s.registry.get('progressState').onboardingCompleted=true;
        s.scene.start('StageScene',{stageId:'world-02-stage-1',playerName:'Playground test corgi'}); })()`);
    }
    await until(s => s?.stage === 'world-02-stage-1' && s.status === 'play', 'initial world 2 stage');
  } finally {
    await call('Page.removeScriptToEvaluateOnNewDocument', { identifier:injection.identifier });
  }
  const route = ['world-02-stage-1'];
  const second = await advance('world-02-stage-2'); route.push(second.stage);
  assert(second.obstacles.length === 8 && second.pigeons.length === 3, 'Map 2 hazards missing');
  for (const kind of ['crushed-cider-can','crushed-fanta-can','empty-cheetos-bag','sleeping-orange-cat','sleeping-tuxedo-cat']) {
    assert(second.obstacles.some(obstacle => obstacle.kind === kind), `Map 2 ${kind} missing`);
  }
  const secondLayout = second.obstacles.map(({kind,x})=>[kind,x]);
  await screenshot('2026-10-23-world02-map2-integration');
  const map2Gap = await pigeonInterval(second.stage);
  await evaluate(`(${scene}).activateCheckpoint('world-02-stage-2-checkpoint')`);
  const coin = (await getState()).coins.find(item => item.active);
  if (coin) await evaluate(`(${scene}).runtime.collectCoin(${JSON.stringify(coin.id)})`);
  const bank = (await getState()).bank;
  const third = await advance('world-02-stage-3'); route.push(third.stage);
  assert(third.obstacles.length === 8 && third.pigeons.length === 3, 'Map 3 hazards missing');
  assert(third.obstacles.map(({kind,x})=>[kind,x]).some((item,index)=>JSON.stringify(item)!==JSON.stringify(secondLayout[index])),
    'Map 2 and 3 layouts match');
  await screenshot('2026-10-23-world02-map3-integration');
  const map3Gap = await pigeonInterval(third.stage);
  await evaluate(`(${scene}).activateCheckpoint('world-02-stage-3-checkpoint')`);
  const cat = third.obstacles.find(obstacle => obstacle.kind === 'sleeping-orange-cat');
  const deaths = (await getState()).deaths;
  await teleport(cat.x, 504);
  const afterCat = await until(s => s?.deaths === deaths + 1, 'cat scratch and death');
  assert(afterCat.checkpoint === 'world-02-stage-3-checkpoint', 'Map 3 checkpoint did not restore after death');
  assert(afterCat.seed === third.seed, 'Map 3 seed changed after death');
  assert(!afterCat.cleared.includes('world-02-stage-3'), 'Death unexpectedly cleared Map 3');
  const bankBeforeReturn = afterCat.bank;
  const returnedSecond = await backtrack('world-02-stage-2'); route.push(returnedSecond.stage);
  assert(returnedSecond.x > 3600, 'Right side entry missing on Map 2');
  assert(returnedSecond.checkpoint === 'world-02-stage-2-checkpoint', 'Map 2 checkpoint missing after return');
  assert(returnedSecond.bank === bankBeforeReturn && returnedSecond.seed === second.seed,
    `Map 2 coin or seed changed on return: ${JSON.stringify({bank,bankBeforeReturn,returnedBank:returnedSecond.bank,seed:second.seed,returnedSeed:returnedSecond.seed})}`);
  assert(JSON.stringify(returnedSecond.cleared) === JSON.stringify(afterCat.cleared), 'Backtracking changed cleared stages');
  assert(JSON.stringify(returnedSecond.obstacles.map(({kind,x})=>[kind,x])) === JSON.stringify(secondLayout), 'Map 2 layout changed');
  if (coin) assert(returnedSecond.coins.find(item => item.id === coin.id)?.active === false, 'Collected coin reappeared');
  const returnedFirst = await backtrack('world-02-stage-1'); route.push(returnedFirst.stage);
  assert(returnedFirst.x > 3600 && returnedFirst.bank === returnedSecond.bank, 'Map 1 return or coin balance failed');
  const secondAgain = await advance('world-02-stage-2'); route.push(secondAgain.stage);
  assert(secondAgain.checkpoint === 'world-02-stage-2-checkpoint' && secondAgain.seed === second.seed, 'Map 2 visit state lost');
  const thirdAgain = await advance('world-02-stage-3'); route.push(thirdAgain.stage);
  assert(thirdAgain.checkpoint === 'world-02-stage-3-checkpoint' && thirdAgain.seed === third.seed, 'Map 3 visit state lost');
  const boss = await advance('world-02-stage-boss'); route.push(boss.stage);
  assert(!route.includes('world-02-stage-4'), 'Obsolete Map 4 entered');
  const previousSeed = boss.runSeed;
  await evaluate(`(${scene}).eventBus.emit('world-selection-requested',{worldId:'world-02'})`);
  const freshRun = await until(s => s?.stage === 'world-02-stage-1' && s.status === 'play', 'fresh world selection');
  assert(!freshRun.travel && freshRun.runSeed !== previousSeed, 'New World 2 selection reused visit state');
  route.push(freshRun.stage);
  assert(errors.length === 0 && missingAssets.length === 0, JSON.stringify({ errors, missingAssets }));
  console.log('PASS', JSON.stringify({ route, map2Gap, map3Gap, bank, deaths:afterCat.deaths,
    freshSeed: freshRun.runSeed, errors, missingAssets }));
} catch (error) {
  console.error('Browser diagnostics', JSON.stringify({ errors, missingAssets }));
  throw error;
} finally {
  await call('Emulation.clearDeviceMetricsOverride').catch(() => {});
  ws.close();
}
