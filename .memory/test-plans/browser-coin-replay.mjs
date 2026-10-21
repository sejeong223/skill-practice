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
const tab = (await fetch("http://127.0.0.1:9226/json/list").then(r => r.json())).find(item => item.type === "page");
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let serial = 0;
const pending = new Map();
const errors = [];
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params?.exceptionDetails?.text);
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
  const coin = s?.runtime?.getEntities('coin')?.[0];
  return s ? { stage:s.stageId,status:s.runtime?.getStatus(),attempt:s.runtime?.runtimeState?.attempt,
    balance:s.progress?.bankedCoins,ledger:s.progress?.collectedCoinIds,
    coin:coin && {id:coin.id,active:coin.entity.active,visible:coin.entity.visible,body:coin.entity.body?.enable,x:coin.entity.x,y:coin.entity.y} } : null;
})()`;
async function waitStage(stageId) {
  for (let i = 0; i < 160; i += 1) {
    const current = await evaluate(state);
    if (current?.stage === stageId && current.status === "play") return current;
    await evaluate(`([...document.querySelectorAll('button')].find(b => b.textContent?.includes('건너뛰기')))?.click()`);
    await sleep(200);
  }
  throw new Error(`Stage did not enter play: ${stageId} ${JSON.stringify(await evaluate(state))}`);
}
async function screenshot(name) {
  const result = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(root, ".memory/test-plans/assets", name), Buffer.from(result.data, "base64"));
}
function assertState(condition, message) { if (!condition) throw new Error(message); }

try {
  await call("Page.enable"); await call("Runtime.enable");
  const progress = createDefaultProgressState("코인 검증 코기");
  progress.onboardingCompleted = true;
  progress.selectedWorldId = "world-01";
  progress.clearedStages = ["world-01-stage-boss"];
  progress.seenCutsceneIds = ["intro-home", "world-01-intro", "world-01-boss-intro"];
  const envelope = { schemaVersion: 3, updatedAt: new Date().toISOString(), progress };
  const injection = await call("Page.addScriptToEvaluateOnNewDocument", {
    source: `if (location.hostname === 'localhost') localStorage.setItem(${JSON.stringify(PROGRESS_STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(envelope))})`,
  });
  await call("Page.navigate", { url: "http://localhost:3001" });
  let before = await waitStage("world-01-stage-1");
  await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
  console.log("before", JSON.stringify(before));
  assertState(before.coin?.active, "First bone coin missing");
  await evaluate(`(() => { const s=${scene}; const c=s.runtime.getEntities('coin')[0].entity; s.player.setPosition(c.x,c.y); s.player.body.updateFromGameObject(); })()`);
  for (let i = 0; i < 30 && (await evaluate(state))?.balance !== 1; i += 1) await sleep(100);
  const collected = await evaluate(state);
  console.log("collected", JSON.stringify(collected));
  assertState(collected.balance === 1 && collected.coin.active === false && collected.ledger.length === 1, "Coin collection failed");
  await evaluate(`(() => { const s=${scene}; s.gameplayEventBus.emit('death-requested',{stageId:s.stageId,cause:'scripted',checkpointId:null,now:s.time.now}); })()`);
  await sleep(1000);
  const dead = await waitStage("world-01-stage-1");
  console.log("afterDeath", JSON.stringify(dead));
  assertState(dead.balance === 1 && dead.coin.active === false, "Collected coin respawned after death");
  await screenshot("2026-10-21-coin-after-death.png");
  await call("Page.reload", { ignoreCache: true });
  const restored = await waitStage("world-01-stage-1");
  console.log("afterReload", JSON.stringify(restored));
  assertState(restored.balance === 1 && restored.coin.active === false && restored.ledger.length === 1, "Coin respawned after reload");
  await evaluate(`(() => { const s=${scene}; s.eventBus.emit('world-selection-requested',{worldId:'world-01',point:'boss'}); })()`);
  await waitStage("world-01-stage-boss");
  await evaluate(`(() => { const s=${scene}; s.runtime.complete(); })()`);
  const cleared = await evaluate(state);
  console.log("afterBossCompletion", JSON.stringify(cleared));
  assertState(cleared.balance === 1 && cleared.ledger.length === 0, "Boss completion did not reset world ledger");
  await evaluate(`(() => { const s=${scene}; s.eventBus.emit('world-selection-requested',{worldId:'world-01',point:'start'}); })()`);
  const replay = await waitStage("world-01-stage-1");
  console.log("replay", JSON.stringify(replay));
  assertState(replay.coin.active && replay.balance === 1, "Replay coin was not restored");
  await screenshot("2026-10-21-coin-after-world-clear.png");
  await evaluate(`(() => { const s=${scene}; const c=s.runtime.getEntities('coin')[0].entity; s.player.setPosition(c.x,c.y); s.player.body.updateFromGameObject(); })()`);
  for (let i = 0; i < 30 && (await evaluate(state))?.balance !== 2; i += 1) await sleep(100);
  const replayCollected = await evaluate(state);
  console.log("recollected", JSON.stringify(replayCollected));
  assertState(replayCollected.balance === 2 && replayCollected.ledger.length === 1, "Replay coin did not pay once");

  const world02Progress = createDefaultProgressState("월드 2 코인 검증 코기");
  world02Progress.onboardingCompleted = true;
  world02Progress.selectedWorldId = "world-02";
  world02Progress.clearedStages = ["world-01-stage-boss"];
  world02Progress.seenCutsceneIds = ["intro-home", "world-02-intro"];
  const world02Envelope = { schemaVersion: 3, updatedAt: new Date().toISOString(), progress: world02Progress };
  const world02Injection = await call("Page.addScriptToEvaluateOnNewDocument", {
    source: `if (location.hostname === 'localhost') localStorage.setItem(${JSON.stringify(PROGRESS_STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(world02Envelope))})`,
  });
  await call("Page.navigate", { url: "http://localhost:3001" });
  const world02Before = await waitStage("world-02-stage-1");
  await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: world02Injection.identifier });
  console.log("world02Before", JSON.stringify(world02Before));
  assertState(world02Before.coin?.active, "World 2 coin missing");
  await evaluate(`(() => { const s=${scene}; const c=s.runtime.getEntities('coin')[0].entity; s.player.setPosition(c.x,c.y); s.player.body.updateFromGameObject(); })()`);
  for (let i = 0; i < 30 && (await evaluate(state))?.balance !== 1; i += 1) await sleep(100);
  const world02Collected = await evaluate(state);
  assertState(world02Collected.balance === 1 && world02Collected.coin.active === false, "World 2 pickup failed");
  await evaluate(`(() => { const s=${scene}; s.gameplayEventBus.emit('death-requested',{stageId:s.stageId,cause:'scripted',checkpointId:null,now:s.time.now}); })()`);
  await sleep(1000);
  const world02Dead = await waitStage("world-02-stage-1");
  console.log("world02AfterDeath", JSON.stringify(world02Dead));
  assertState(world02Dead.balance === 1 && world02Dead.coin.active === false, "World 2 coin respawned after death");
  console.log("errors", JSON.stringify(errors));
} finally { ws.close(); }
