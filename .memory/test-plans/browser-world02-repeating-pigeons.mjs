import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { createDefaultProgressState } = require(path.join(root, "src/game/core/constants.ts"));
const { PROGRESS_STORAGE_KEY } = require(path.join(root, "src/game/persistence/saveTypes.ts"));
const tab = (await fetch("http://127.0.0.1:9229/json/list").then(response => response.json()))
  .find(item => item.type === "page");
if (!tab) throw new Error("Dedicated Chrome page is missing");
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

let serial = 0;
const pending = new Map();
const errors = [];
const missingAssets = [];
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params?.exceptionDetails?.text);
  if (message.method === "Network.responseReceived" && message.params?.response?.status === 404 && message.params.response.url.includes("/assets/")) {
    missingAssets.push(message.params.response.url);
  }
  const waiting = pending.get(message.id);
  if (!waiting) return;
  pending.delete(message.id);
  if (message.error) waiting.reject(new Error(JSON.stringify(message.error)));
  else waiting.resolve(message.result);
};
function call(method, params = {}) {
  const id = ++serial;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
}
async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result?.value;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
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
    stage:s.stageId, status:s.runtime?.getStatus(), deaths:s.progress?.deathsTotal,
    checkpoint:s.runtime?.runtimeState?.checkpointId,
    player:s.player && {x:s.player.x,y:s.player.y},
    spawnTimes:window.__pigeonSpawnTimes,
    dropTimes:window.__pigeonDropTimes,
    flights:s.world02PigeonDrops?.flights?.map(f=>({
      bird:f.bird && {x:f.bird.x,y:f.bird.y},
      drops:f.drops.map(d=>({x:d.x,status:d.status,hasWarning:Object.hasOwn(d,'warning'),
        falling:!!d.sprite?.active,splat:!!d.splat?.active}))
    }))
  } : null;
})()`;
async function getState() { return evaluate(state); }
async function until(predicate, label, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const now = await getState();
    if (predicate(now)) return now;
    await sleep(30);
  }
  throw new Error(`${label}: ${JSON.stringify(await getState())}`);
}
function assert(condition, label) { if (!condition) throw new Error(label); }
async function teleport(x, y = 460) {
  await evaluate(`(() => { const s=${scene}; s.player.resetTo({x:${x},y:${y}}); s.player.setVelocity(0,0); })()`);
}
async function screenshot(name) {
  if (process.env.WORLD02_CAPTURE_SCREENSHOTS === "0") return;
  const shot = await call("Page.captureScreenshot", { format:"png", captureBeyondViewport:false });
  fs.writeFileSync(path.join(root, `.memory/test-plans/assets/${name}.png`), Buffer.from(shot.data, "base64"));
}

try {
  await call("Page.enable"); await call("Runtime.enable"); await call("Network.enable");
  await call("Emulation.setDeviceMetricsOverride", { width:1280,height:720,deviceScaleFactor:1,mobile:false });
  const progress = createDefaultProgressState("Pigeon test corgi");
  progress.onboardingCompleted = true;
  progress.selectedWorldId = "world-02";
  progress.clearedStages = ["world-01-stage-boss"];
  progress.seenCutsceneIds = ["intro-home", "world-02-intro"];
  const envelope = { schemaVersion:3, updatedAt:new Date().toISOString(), progress };
  const injection = await call("Page.addScriptToEvaluateOnNewDocument", {
    source:`if (location.hostname === 'localhost') localStorage.setItem(${JSON.stringify(PROGRESS_STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(envelope))})`,
  });
  try {
    await call("Page.navigate", {url:"http://localhost:3001"});
    await until(s => s?.stage === "world-02-stage-1" && s.status === "play" && s.flights, "world 2 stage");
  } finally {
    await call("Page.removeScriptToEvaluateOnNewDocument", {identifier:injection.identifier});
  }
  await evaluate(`(() => {
    const s=${scene}; const system=s.world02PigeonDrops;
    window.__pigeonSpawnTimes=[];
    window.__pigeonDropTimes=[];
    const original=system.spawnFlight.bind(system);
    system.spawnFlight=(definition)=>{window.__pigeonSpawnTimes.push(s.time.now); original(definition);};
    const originalRelease=system.releaseDropping.bind(system);
    system.releaseDropping=(flight,drop)=>{
      window.__pigeonDropTimes.push({x:drop.x,time:s.time.now});
      originalRelease(flight,drop);
    };
  })()`);
  const initial = await getState();
  assert(initial.flights.length === 0, "Bird appeared before trigger");
  await teleport(670);
  await sleep(120);
  await screenshot("2026-10-21-world02-snack-bag-ground");
  await teleport(96);
  await teleport(850);
  const first = await until(s => s?.spawnTimes?.length === 1, "first pigeon");
  assert(first.flights[0].bird, "First pigeon missing");
  const threeDrops = await until(s => s?.flights?.[0]?.drops.every(d => d.status !== "pending"), "three drops");
  assert(threeDrops.flights[0].drops.map(d => d.x).join() === "1364,1280,1196", "Drop order or locations changed");
  assert(threeDrops.flights[0].drops.every(d => !d.hasWarning), "Ground warning marker was created");
  const firstThreeDrops = threeDrops.dropTimes.slice(0, 3);
  assert(firstThreeDrops.map(({x}) => x).join() === "1364,1280,1196", "First pigeon drop order changed");
  const dropGaps = firstThreeDrops.slice(1).map(({time}, index) => time - firstThreeDrops[index].time);
  assert(dropGaps.every(gap => Math.abs(gap - 84 / 102 * 1000) < 100), `Pigeon drop gaps are ${dropGaps}`);
  const repeated = await until(s => s?.spawnTimes?.length >= 2, "second pigeon");
  const gap = repeated.spawnTimes[1] - repeated.spawnTimes[0];
  assert(Math.abs(gap - 2000) < 100, `Pigeon interval is ${gap}ms`);
  await screenshot("2026-10-21-world02-repeating-pigeons");

  await evaluate(`(${scene})?.eventBus.emit('pause-requested',{paused:true})`);
  const paused = await until(s => s?.status === "paused", "pause");
  const pausedCount = paused.spawnTimes.length;
  const pausedBirdX = paused.flights.at(-1)?.bird?.x;
  await sleep(2200);
  const stillPaused = await getState();
  assert(stillPaused.spawnTimes.length === pausedCount && stillPaused.flights.at(-1)?.bird?.x === pausedBirdX,
    "Pigeon moved or respawned during pause");
  await evaluate(`(${scene})?.eventBus.emit('pause-requested',{paused:false})`);
  await until(s => s?.status === "play" && s.spawnTimes.length >= 3, "third pigeon after resume", 5000);

  await teleport(2050);
  await sleep(120);
  await screenshot("2026-10-21-world02-smaller-cat");
  await evaluate(`(${scene})?.activateCheckpoint('world-02-stage-1-checkpoint')`);
  await teleport(2496);
  await evaluate(`(${scene})?.world02PigeonDrops.resetForAttempt(2496)`);
  await teleport(3040);
  const deathsBefore = (await getState()).deaths;
  const dead = await until(s => s?.deaths === deathsBefore + 1, "pigeon dropping death", 6000);
  assert(Math.abs(dead.player.x - 2496) < 80, "Death did not resume at checkpoint");
  assert(dead.checkpoint === "world-02-stage-1-checkpoint", "Checkpoint was lost");
  assert(errors.length === 0 && missingAssets.length === 0, `Browser errors: ${JSON.stringify({errors,missingAssets})}`);
  console.log("PASS", JSON.stringify({dropXs:threeDrops.flights[0].drops.map(d => d.x), dropGaps, gap, spawns:pausedCount + 1,
    deaths:dead.deaths, checkpoint:dead.checkpoint, errors, missingAssets}));
} finally {
  await call("Emulation.clearDeviceMetricsOverride").catch(() => {});
  ws.close();
}
