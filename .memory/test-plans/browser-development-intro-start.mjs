import assert from "node:assert/strict";
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
const tabs = await fetch("http://127.0.0.1:9223/json/list").then(response => response.json());
const tab = tabs.find(item => item.type === "page");
assert.ok(tab, "Chrome CDP page");
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let serial = 0;
const pending = new Map();
const errors = [];
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params?.exceptionDetails?.text);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(JSON.stringify(message.error)));
  else resolve(message.result);
};
function call(method, params = {}) {
  const id = ++serial;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result?.value;
}
async function waitForIntro() {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    if (await evaluate("Boolean(document.querySelector('.cutscene-overlay:not(.cutscene-overlay--world02) [aria-label=\"컷신 자막\"]'))")) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`첫 인트로를 찾지 못함: ${await evaluate("document.body?.innerText?.slice(0,500)")}`);
}

try {
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Page.navigate", { url: "http://localhost:3001" });
  const original = createDefaultProgressState("기존 저장 코기");
  original.onboardingCompleted = true;
  original.selectedWorldId = "world-02";
  original.seenCutsceneIds = ["intro-home", "world-02-intro"];
  original.clearedStages = ["world-01-stage-boss"];
  original.bankedCoins = 37;
  const envelope = { schemaVersion: 3, updatedAt: new Date().toISOString(), progress: original };
  const injection = await call("Page.addScriptToEvaluateOnNewDocument", {
    source: `if (location.hostname === 'localhost') localStorage.setItem(${JSON.stringify(PROGRESS_STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(envelope))})`,
  });
  await call("Page.reload", { ignoreCache: true });
  await waitForIntro();
  try { await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier }); } catch { /* Page reload may clear CDP scripts. */ }
  assert.equal(await evaluate("Boolean(document.querySelector('.game-hud'))"), false);
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(PROGRESS_STORAGE_KEY)})).progress.bankedCoins`), 37);
  assert.ok((await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(PROGRESS_STORAGE_KEY)})).progress.clearedStages`)).includes("world-01-stage-boss"));

  const sceneExpression = `(method => {
    const mount = document.querySelector('canvas')?.parentElement;
    let fiber = mount && mount[Object.keys(mount).find(name => name.startsWith('__reactFiber$'))];
    while (fiber) {
      for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const game = hook.memoizedState?.current;
        if (game?.scene?.getScene) {
          const intro = game.scene.getScene('IntroScene');
          if (method === 'finish') { intro.finishCutscene(); return true; }
          const stage = game.scene.getScene('StageScene');
          return stage.scene.isActive() ? stage.stageId : null;
        }
      }
      fiber = fiber.return;
    }
    return null;
  })`;
  assert.equal(await evaluate(`${sceneExpression}('finish')`), true);
  const started = Date.now();
  while (Date.now() - started < 5000 && !await evaluate("Boolean(document.querySelector('.intro-title-card'))")) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(await evaluate("Boolean(document.querySelector('.intro-title-card'))"), true);
  await evaluate("document.querySelector('.intro-title-card button').click()");
  await evaluate("document.querySelector('.intro-name-card form button').click()");
  const stageStarted = Date.now();
  while (Date.now() - stageStarted < 5000 && await evaluate(`${sceneExpression}('stage')`) !== "world-01-stage-1") {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(await evaluate(`${sceneExpression}('stage')`), "world-01-stage-1");
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(PROGRESS_STORAGE_KEY)})).progress.bankedCoins`), 37);
  assert.ok((await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(PROGRESS_STORAGE_KEY)})).progress.clearedStages`)).includes("world-01-stage-boss"));
  assert.deepEqual(errors, []);
  console.log("개발 브라우저 시작 검증 통과: 기존 월드 2 저장에서 첫 인트로→월드 1 첫 스테이지, 코인·클리어 기록 보존");
} finally {
  ws.close();
}
