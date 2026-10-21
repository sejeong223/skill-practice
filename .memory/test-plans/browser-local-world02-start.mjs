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
const tab = (await fetch("http://127.0.0.1:9228/json/list").then(response => response.json()))
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
  const result = await call("Runtime.evaluate", { expression, returnByValue:true, awaitPromise:true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result?.value;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const game = `(() => {
  const mount=document.querySelector('canvas')?.parentElement;
  const key=mount&&Object.keys(mount).find(name=>name.startsWith('__reactFiber$'));
  let fiber=key?mount[key]:null,game;
  while(fiber&&!game){for(let hook=fiber.memoizedState;hook;hook=hook.next){
    if(hook.memoizedState?.current?.scene?.getScene){game=hook.memoizedState.current;break;}
  }fiber=fiber.return;}
  return game;
})()`;
const state = `(() => {
  const g=${game}; const p=g?.registry.get('progressState');
  return g ? {active:g.scene.getScenes(true).map(scene=>scene.scene.key),
    stage:g.scene.getScene('StageScene')?.stageId,
    progress:p&&{playerName:p.playerName,onboardingCompleted:p.onboardingCompleted,
      selectedWorldId:p.selectedWorldId,clearedStages:p.clearedStages,
      unlockedSkills:p.unlockedSkills,seenCutsceneIds:p.seenCutsceneIds,
      bankedCoins:p.bankedCoins,deathsTotal:p.deathsTotal,ownedToolIds:p.ownedToolIds},
    worldSelectButton:!!document.querySelector('[aria-label="월드 선택"]'),
    worldSelectDialog:!!document.querySelector('.world-select-dialog')
  } : null;
})()`;
async function getState() { return evaluate(state); }
async function until(predicate, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const now = await getState();
    if (predicate(now)) return now;
    await sleep(50);
  }
  throw new Error(`${label}: ${JSON.stringify(await getState())}`);
}
function assert(condition, label) { if (!condition) throw new Error(label); }
async function screenshot(name) {
  const result = await call("Page.captureScreenshot", {format:"png",captureBeyondViewport:false});
  fs.writeFileSync(path.join(root,".memory/test-plans/assets",name),Buffer.from(result.data,"base64"));
}
async function navigateWithSave(progress) {
  const envelope = progress && {schemaVersion:3,updatedAt:new Date().toISOString(),progress};
  const source = progress
    ? `if(location.hostname==='localhost')localStorage.setItem(${JSON.stringify(PROGRESS_STORAGE_KEY)},${JSON.stringify(JSON.stringify(envelope))})`
    : `if(location.hostname==='localhost')localStorage.removeItem(${JSON.stringify(PROGRESS_STORAGE_KEY)})`;
  const injection = await call("Page.addScriptToEvaluateOnNewDocument", {source});
  try {
    await call("Page.navigate", {url:"http://localhost:3001"});
    await sleep(900);
  } finally {
    await call("Page.removeScriptToEvaluateOnNewDocument", {identifier:injection.identifier});
  }
}

try {
  await call("Page.enable"); await call("Runtime.enable"); await call("Network.enable");
  await call("Emulation.setDeviceMetricsOverride", {width:1280,height:720,deviceScaleFactor:1,mobile:false});

  await navigateWithSave(null);
  const first = await until(s=>s?.active.includes("World02EntranceScene"), "fresh save world 2 entrance");
  assert(first.progress.onboardingCompleted && first.progress.selectedWorldId === "world-02", "Fresh save did not prepare world 2 progress");
  assert(first.progress.clearedStages.includes("world-01-stage-boss") && first.progress.unlockedSkills.includes("bark"), "World 1 clear markers missing");
  console.log("freshEntrance", JSON.stringify(first));
  await screenshot("2026-10-21-local-world02-start-entrance.png");
  await evaluate(`(${game})?.scene.getScene('World02EntranceScene').finish(false)`);
  const firstStage = await until(s=>s?.active.includes("StageScene") && s.stage === "world-02-stage-1" && s.worldSelectButton, "fresh save stage 1");
  console.log("freshStage", JSON.stringify(firstStage));

  const saved = createDefaultProgressState("초코");
  saved.onboardingCompleted = true;
  saved.selectedWorldId = "world-01";
  saved.clearedStages = ["world-01-stage-1", "world-02-stage-1"];
  saved.seenCutsceneIds = ["intro-home", "world-02-intro"];
  saved.bankedCoins = 37;
  saved.deathsTotal = 5;
  saved.ownedToolIds.push("squeaky-ball");
  await navigateWithSave(saved);
  const restored = await until(s=>s?.active.includes("StageScene") && s.stage === "world-02-stage-1" && s.worldSelectButton, "saved world 1 stage 1");
  assert(restored.progress.playerName === "초코" && restored.progress.bankedCoins === 37 && restored.progress.deathsTotal === 5, "Saved name, money, or deaths changed");
  assert(restored.progress.ownedToolIds.includes("squeaky-ball"), "Saved equipment changed");
  assert(!restored.active.includes("World02EntranceScene"), "Seen world 2 intro replayed");
  console.log("savedWorld01", JSON.stringify(restored));
  await screenshot("2026-10-21-local-world02-start-saved.png");
  await evaluate(`document.querySelector('[aria-label="월드 선택"]')?.click()`);
  const dialog = await until(s=>s?.worldSelectDialog, "world selector");
  assert(dialog.active.includes("StageScene"), "World selector replaced the stage");
  await screenshot("2026-10-21-local-world02-start-world-select.png");
  await evaluate(`document.querySelector('.world-select-option')?.click()`);
  await sleep(100);
  await evaluate(`document.querySelector('.world-select-checkpoint-option')?.click()`);
  const replay = await until(s=>s?.active.includes("StageScene") && s.stage === "world-01-stage-1", "world 1 replay");
  assert(replay.progress.selectedWorldId === "world-01", "World 1 replay did not update the selected world");
  console.log("world01Replay", JSON.stringify({stage:replay.stage,selectedWorldId:replay.progress.selectedWorldId}));
  assert(errors.length === 0 && missingAssets.length === 0, `Browser errors: ${JSON.stringify({errors,missingAssets})}`);
  console.log("PASS", JSON.stringify({errors,missingAssets}));
} finally {
  await call("Emulation.clearDeviceMetricsOverride").catch(()=>{});
  ws.close();
}
