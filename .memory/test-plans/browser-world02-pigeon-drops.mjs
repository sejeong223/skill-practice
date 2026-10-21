import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.join(root, ".memory/test-plans/assets");
const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { createDefaultProgressState } = require(path.join(root, "src/game/core/constants.ts"));
const { PROGRESS_STORAGE_KEY } = require(path.join(root, "src/game/persistence/saveTypes.ts"));
const tab = (await fetch("http://127.0.0.1:9227/json/list").then(r => r.json())).find(item => item.type === "page");
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
  if (!pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
  if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
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
    stage:s.stageId, status:s.runtime?.getStatus(), attempt:s.runtime?.runtimeState?.attempt,
    checkpoint:s.runtime?.runtimeState?.checkpointId, deaths:s.progress?.deathsTotal, lastDeath:window.__pigeonLastDeath,
    player:s.player && {x:s.player.x,y:s.player.y,bottom:s.player.body?.bottom},
    cameraX:s.cameras.main.scrollX,
    passes:s.world02PigeonDrops?.passes?.map(p=>({id:p.definition.id,status:p.status,
      bird:p.bird && {x:p.bird.x,y:p.bird.y,frame:p.bird.frame.name},
      warning:!!p.warning?.active,dropping:p.dropping && {x:p.dropping.x,y:p.dropping.y,bottom:p.dropping.body?.bottom},
      splat:!!p.splat?.active}))
  } : null;
})()`;
async function getState() { return evaluate(state); }
async function until(predicate, label, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const now = await getState();
    if (predicate(now)) return now;
    await sleep(20);
  }
  throw new Error(`${label}: ${JSON.stringify(await getState())}`);
}
function assert(condition, label) { if (!condition) throw new Error(label); }
async function screenshot(name) {
  const result = await call("Page.captureScreenshot", { format:"png", captureBeyondViewport:false });
  fs.writeFileSync(path.join(output, name), Buffer.from(result.data,"base64"));
}
async function teleport(x, y = 460) {
  await evaluate(`(() => { const s=${scene}; s.player.resetTo({x:${x},y:${y}}); s.player.setVelocity(0,0); })()`);
}
async function waitStage(stageId) {
  for (let i = 0; i < 150; i++) {
    const now = await getState();
    if (now?.stage === stageId && now.status === "play") return now;
    await evaluate(`([...document.querySelectorAll('button')].find(b=>b.textContent?.includes('건너뛰기')))?.click()`);
    await sleep(100);
  }
  throw new Error(`Stage ${stageId} unavailable: ${JSON.stringify(await getState())}`);
}
async function pause(paused) { await evaluate(`(${scene})?.eventBus.emit('pause-requested',{paused:${paused}})`); }

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
  await call("Page.navigate", {url:"http://localhost:3001"});
  const initial = await waitStage("world-02-stage-1");
  await call("Page.removeScriptToEvaluateOnNewDocument", {identifier:injection.identifier});
  assert(initial.passes?.length === 3, "Three pigeon passes must exist");
  console.log("initial", JSON.stringify(initial));

  // First pass: inspect right-to-left flight, then safely avoid the fall.
  await teleport(850);
  let flying = await until(s=>s?.passes?.[0].status === "flying", "first flight");
  const firstBirdX = flying.passes[0].bird.x;
  await sleep(250);
  flying = await getState();
  assert(flying.passes[0].bird.x < firstBirdX, "Pigeon did not fly right to left");
  console.log("flight", JSON.stringify(flying.passes[0]));
  await teleport(1188);
  const warned = await until(s=>s?.passes?.[0].warning, "first warning");
  console.log("warning", JSON.stringify(warned.passes[0]));
  await screenshot("2026-10-21-world02-pigeon-warning.png");
  const released = await until(s=>s?.passes?.[0].dropping, "first droplet");
  console.log("dropping", JSON.stringify(released.passes[0]));
  await pause(true);
  const pausedDroplet = await until(s=>s?.status === "paused", "droplet pause");
  await screenshot("2026-10-21-world02-pigeon-dropping-paused.png");
  await sleep(300);
  assert((await getState()).passes[0].dropping.y === pausedDroplet.passes[0].dropping.y, "Paused droplet moved");
  await pause(false);
  await until(s=>s?.status === "play", "droplet resume");
  const splat = await until(s=>s?.passes?.[0].splat, "first splat");
  console.log("splat", JSON.stringify(splat.passes[0]));
  await pause(true);
  await until(s=>s?.status === "paused", "splat pause");
  await screenshot("2026-10-21-world02-pigeon-splat.png");
  await sleep(350);
  assert((await getState()).passes[0].splat, "Paused splat expired");
  await pause(false);
  await until(s=>s?.status === "play", "splat resume");
  await teleport(1280);
  await sleep(90);
  assert((await getState()).deaths === initial.deaths, "Splat harmed the player");
  await until(s=>s?.passes?.[0].status === "finished", "first finish");
  assert((await getState()).deaths === initial.deaths, "Safe avoidance caused death");

  // Second pass: both the game pause and the shop freeze the bird.
  await teleport(1550);
  await until(s=>s?.passes?.[1].status === "flying", "second flight");
  await pause(true);
  const paused = await until(s=>s?.status === "paused", "pause state");
  await sleep(350);
  const pausedAfter = await getState();
  assert(pausedAfter.passes[1].bird.x === paused.passes[1].bird.x, "Pause moved pigeon");
  await pause(false);
  await until(s=>s?.status === "play", "resume state");
  await evaluate(`document.querySelector('[aria-label="상점 열기"]')?.click()`);
  const shopPaused = await until(s=>s?.status === "paused", "shop pause");
  await sleep(350);
  const shopAfter = await getState();
  assert(shopAfter.passes[1].bird.x === shopPaused.passes[1].bird.x, "Shop pause moved pigeon");
  await evaluate(`document.querySelector('[aria-label="상점 닫기"]')?.click()`);
  await until(s=>s?.status === "play", "shop resume");
  await teleport(1888);
  await until(s=>s?.passes?.[1].warning, "second warning");
  await call("Emulation.setDeviceMetricsOverride", {width:390,height:844,deviceScaleFactor:1,mobile:true});
  await screenshot("2026-10-21-world02-pigeon-mobile.png");
  await until(s=>s?.passes?.[1].dropping, "second droplet on mobile");
  await screenshot("2026-10-21-world02-pigeon-mobile-dropping.png");
  await call("Emulation.setDeviceMetricsOverride", {width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await until(s=>s?.passes?.[1].status === "finished", "second finish");
  assert((await getState()).deaths === initial.deaths, "Second safe avoidance caused death");

  // Checkpoint should reactivate the third pass after an actual droplet collision.
  await evaluate(`(${scene})?.activateCheckpoint('world-02-stage-1-checkpoint')`);
  const checked = await getState();
  assert(checked.checkpoint === "world-02-stage-1-checkpoint", "Checkpoint not activated");
  await teleport(2600);
  await until(s=>s?.passes?.[2].warning, "third warning");
  await teleport(3040);
  const beforeHit = await until(s=>s?.passes?.[2].dropping, "third droplet");
  console.log("beforeHit", JSON.stringify(beforeHit));
  const dead = await until(s=>s?.deaths === initial.deaths + 1, "droplet contact death", 5000);
  console.log("afterHit", JSON.stringify(dead));
  assert(Math.abs(dead.player.x - 2496) < 80, "Death did not return to checkpoint");
  assert(dead.passes[0].status === "finished" && dead.passes[1].status === "finished" && dead.passes[2].status === "armed", "Checkpoint pass reset is incorrect");
  await sleep(1800);
  assert((await getState()).deaths === initial.deaths + 1, "Droplet caused duplicate death");
  await screenshot("2026-10-21-world02-pigeon-after-checkpoint.png");

  // Reload starts the world 2 stage fresh under the existing save policy.
  await call("Page.reload", {ignoreCache:true});
  await sleep(1200);
  const reloaded = await waitStage("world-02-stage-1");
  console.log("reloaded", JSON.stringify(reloaded));
  assert(reloaded.passes.every(p=>p.status === "armed" && !p.bird && !p.dropping && !p.warning), "Reload retained pigeon objects");
  await evaluate(`(() => { const s=${scene}; const old=s.gameplayEventBus.emit.bind(s.gameplayEventBus); s.gameplayEventBus.emit=(type,payload)=>{ if(type==='death-requested') window.__pigeonLastDeath={x:s.player.x,y:s.player.y,cause:payload.cause}; return old(type,payload); }; })()`);
  const route = [420,760,1100,1280,1460,1810,1980,2160,2850,3040,3220].map(target=>({target,x:target===2160?2066:target-104,drop:[1280,1980,3040].includes(target)}));
  const deathsBeforeRun = reloaded.deaths;
  await call("Input.dispatchKeyEvent", {type:"keyDown",key:"ArrowRight",code:"ArrowRight",windowsVirtualKeyCode:39});
  try {
    for (const {target,x,drop} of route) {
      const beforeJump = await until(s=>s?.stage === "world-02-stage-1" && s.player.x >= x || s?.stage !== "world-02-stage-1" || s?.deaths !== deathsBeforeRun, `run to ${x}`, 10000);
      assert(beforeJump.stage === "world-02-stage-1" && beforeJump.deaths === deathsBeforeRun, `Run failed before x=${x}: ${JSON.stringify(beforeJump)}`);
      if (drop) {
        await call("Input.dispatchKeyEvent", {type:"keyUp",key:"ArrowRight",code:"ArrowRight",windowsVirtualKeyCode:39});
        const passIndex = [1280,1980,3040].indexOf(target);
        const waited = await until(s=>s?.passes?.[passIndex].status === "finished" || s?.deaths !== deathsBeforeRun, `wait for drop ${passIndex}`, 6000);
        assert(waited.deaths === deathsBeforeRun, `Waiting caused death: ${JSON.stringify(waited)}`);
        console.log("avoided", x, JSON.stringify({player:waited.player,pass:waited.passes[passIndex].status}));
        await call("Input.dispatchKeyEvent", {type:"keyDown",key:"ArrowRight",code:"ArrowRight",windowsVirtualKeyCode:39});
        continue;
      }
      await call("Input.dispatchKeyEvent", {type:"keyDown",key:" ",code:"Space",windowsVirtualKeyCode:32});
      await sleep(75);
      const inJump = await getState();
      await call("Input.dispatchKeyEvent", {type:"keyUp",key:" ",code:"Space",windowsVirtualKeyCode:32});
      console.log("jump", x, JSON.stringify({before:beforeJump.player,after:inJump.player,passes:beforeJump.passes.map(p=>p.status)}));
    }
    const end = await until(s=>s?.stage === "world-02-stage-2" || s?.deaths !== deathsBeforeRun, "stage exit", 10000);
    assert(end.stage === "world-02-stage-2" && end.deaths === deathsBeforeRun, `Full run failed: ${JSON.stringify(end)}`);
    console.log("fullRun", JSON.stringify({stage:end.stage,deaths:end.deaths,jumps:8,avoidedDrops:3}));
    await screenshot("2026-10-21-world02-pigeon-stage-exit.png");
  } finally {
    await call("Input.dispatchKeyEvent", {type:"keyUp",key:"ArrowRight",code:"ArrowRight",windowsVirtualKeyCode:39});
  }
  await evaluate(`(${scene})?.eventBus.emit('world-selection-requested',{worldId:'world-01',point:'start'})`);
  const worldOne = await waitStage("world-01-stage-1");
  assert(worldOne.passes === undefined, "World 1 retained pigeon system");
  assert(errors.length === 0 && missingAssets.length === 0, `Browser errors: ${JSON.stringify({errors,missingAssets})}`);
  console.log("PASS", JSON.stringify({deaths:dead.deaths,checkpoint:dead.checkpoint,errors,missingAssets}));
} finally {
  await call("Emulation.clearDeviceMetricsOverride").catch(()=>{});
  ws.close();
}
