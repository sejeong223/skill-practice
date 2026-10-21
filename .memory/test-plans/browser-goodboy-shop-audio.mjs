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
const tab = (await fetch("http://127.0.0.1:9224/json/list").then(r => r.json())).find(item => item.type === "page");
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let serial = 0;
const pending = new Map();
const errors = [];
ws.onmessage = event => {
  const data = JSON.parse(event.data);
  if (data.method === "Runtime.exceptionThrown") errors.push(data.params.exceptionDetails.text);
  if (!pending.has(data.id)) return;
  const { resolve, reject } = pending.get(data.id);
  pending.delete(data.id);
  if (data.error) reject(new Error(JSON.stringify(data.error)));
  else resolve(data.result);
};
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++serial;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function click(selector) {
  const point = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
  await call("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await call("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}
const sceneState = `(() => {
  const mount = document.querySelector('canvas')?.parentElement;
  const key = mount && Object.keys(mount).find(name => name.startsWith('__reactFiber$'));
  let fiber = key ? mount[key] : null;
  let game;
  while (fiber && !game) {
    for (let hook = fiber.memoizedState; hook; hook = hook.next) {
      if (hook.memoizedState?.current?.scene?.getScene) { game = hook.memoizedState.current; break; }
    }
    fiber = fiber.return;
  }
  const scene = game?.scene?.getScene('StageScene');
  return { status:scene?.runtime?.getStatus(), song:scene?.audioManager?.musicKey,
    gameMusicPaused:scene?.audioManager?.paused, gameSongInstance:!!scene?.audioManager?.musicGain,
    shopAudio:(window.__shopAudio ?? []).map(a => ({file:a.src.split('/').at(-1),paused:a.paused,time:a.currentTime,loop:a.loop})) };
})()`;

try {
  await call("Page.enable");
  await call("Runtime.enable");
  const scenarios = process.env.GOODBOY_BOSS_ONLY === "1" ? [["world-01", true]] : [["world-02", false], ["world-01", false], ["world-01", true]];
  for (const [world, bossReplay] of scenarios) {
    const progress = createDefaultProgressState("오디오 검증 코기");
    progress.onboardingCompleted = true;
    progress.clearedStages = ["world-01-stage-boss"];
    progress.selectedWorldId = world;
    progress.world01BossReplayActive = bossReplay;
    progress.seenCutsceneIds = ["intro-home", "world-02-intro", "world-01-boss-intro"];
    const envelope = { schemaVersion: 3, updatedAt: new Date().toISOString(), progress };
    const injection = await call("Page.addScriptToEvaluateOnNewDocument", { source: `
      if(location.hostname === 'localhost') localStorage.setItem(${JSON.stringify(PROGRESS_STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(envelope))});
      const NativeAudio = window.Audio;
      window.__shopAudio = [];
      window.Audio = function(src) { const audio = new NativeAudio(src); window.__shopAudio.push(audio); return audio; };
    ` });
    await call("Page.navigate", { url: "http://localhost:3001" });
    for (let i = 0; i < 80 && !(await evaluate(`Boolean(document.querySelector('[aria-label="상점 열기"]'))`)); i += 1) await sleep(200);
    for (let i = 0; i < 160 && (await evaluate(sceneState)).status !== "play"; i += 1) {
      await evaluate(`([...document.querySelectorAll('button')].find(b => b.textContent?.includes('건너뛰기')))?.click()`);
      await sleep(200);
    }
    await sleep(400);
    const scenario = bossReplay ? "world-01-boss" : world;
    console.log(scenario, "before", JSON.stringify(await evaluate(sceneState)));
    for (let count = 0; count < 3; count += 1) {
      await click('[aria-label="상점 열기"]');
      await sleep(360);
      console.log(scenario, "inside", count + 1, JSON.stringify(await evaluate(sceneState)));
      await click('.goodboy-shop-close');
      await sleep(300);
      console.log(scenario, "outside", count + 1, JSON.stringify(await evaluate(sceneState)));
    }
    await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
  }
  console.log("errors", JSON.stringify(errors));
} finally {
  ws.close();
}
