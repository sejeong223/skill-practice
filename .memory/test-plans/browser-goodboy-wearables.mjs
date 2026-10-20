import fs from "node:fs";
import { writeFile } from "node:fs/promises";
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
if (!tab) throw new Error("Headless Chrome page not found");
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let serial = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
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
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result?.value;
}
async function capture(name) {
  const result = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(path.join(root, ".memory/test-plans/assets", name), Buffer.from(result.data, "base64"));
}

try {
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await call("Page.navigate", { url: "http://localhost:3000" });
  await sleep(2500);

  for (const [index, [outfitId, accessoryId]] of [
    ["bee-bodysuit", "prince-crown"], ["hotdog-outfit", "birthday-party-hat"],
  ].entries()) {
    const progress = createDefaultProgressState("미리보기 코기");
    progress.onboardingCompleted = true;
    progress.clearedStages = ["world-01-stage-boss"];
    progress.selectedWorldId = "world-02";
    progress.unlockedSkills = ["bark"];
    progress.ownedCosmeticIds = [outfitId, accessoryId];
    progress.equippedOutfitId = outfitId;
    progress.equippedAccessoryId = accessoryId;
    progress.seenCutsceneIds = ["intro-home", "world-02-intro"];
    const envelope = { schemaVersion: 3, updatedAt: new Date().toISOString(), progress };
    // The previous React tree flushes its progress during beforeunload. Seed
    // storage at the start of the new document, after that flush completes.
    const injection = await call("Page.addScriptToEvaluateOnNewDocument", {
      source: `if (location.hostname === 'localhost') localStorage.setItem(${JSON.stringify(PROGRESS_STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(envelope))})`,
    });
    await call("Page.reload", { ignoreCache: true });
    await sleep(6000);
    await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
    const state = await evaluate(`({canvas: Boolean(document.querySelector('canvas')), title: document.title, overlay: Boolean(document.querySelector('.cutscene-overlay')), text: document.body.innerText.slice(0, 160)})`);
    console.log(JSON.stringify({ index, state }));
    await capture(index === 0 ? "2026-10-20-goodboy-wearables-browser-bee-crown.png" : "2026-10-20-goodboy-wearables-browser-hotdog-hat.png");
    if (index === 0) {
      await call("Input.dispatchKeyEvent", { type: "keyDown", key: "l", code: "KeyL", windowsVirtualKeyCode: 76 });
      await sleep(100);
      await capture("2026-10-20-goodboy-wearables-browser-bark.png");
      await call("Input.dispatchKeyEvent", { type: "keyUp", key: "l", code: "KeyL", windowsVirtualKeyCode: 76 });
      await call("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
      await sleep(450);
      await call("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
      await sleep(120);
      await capture("2026-10-20-goodboy-wearables-browser-jump.png");
      await call("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
      await call("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
      await call("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 });
      await sleep(140);
      await capture("2026-10-20-goodboy-wearables-browser-left.png");
      await call("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 });
    }
  }
} finally {
  ws.close();
}
