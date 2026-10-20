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
ws.onmessage = event => {
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
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function capture(name) {
  const result = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(path.join(root, ".memory/test-plans/assets", name), Buffer.from(result.data, "base64"));
}
async function key(type, name, code, virtualCode) {
  await call("Input.dispatchKeyEvent", { type, key: name, code, windowsVirtualKeyCode: virtualCode });
}

try {
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await call("Page.navigate", { url: "http://localhost:3000" });
  await sleep(1400);
  for (const toolId of ["rolled-newspaper", "pink-backscratcher", "squeaky-ball", "drumstick-boomerang", "plastic-frisbee"]) {
    const progress = createDefaultProgressState("전투 검증 코기");
    progress.onboardingCompleted = true;
    progress.clearedStages = ["world-01-stage-boss"];
    progress.selectedWorldId = "world-01";
    progress.world01BossReplayActive = true;
    progress.seenCutsceneIds = ["intro-home", "world-01-boss-intro"];
    progress.unlockedSkills = ["bark"];
    progress.ownedToolIds = ["rabbit-slipper", "upside-down-bowl", toolId];
    progress.equippedAttackToolId = toolId;
    const envelope = { schemaVersion: 3, updatedAt: new Date().toISOString(), progress };
    const injection = await call("Page.addScriptToEvaluateOnNewDocument", {
      source: `if (location.hostname === 'localhost') localStorage.setItem(${JSON.stringify(PROGRESS_STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(envelope))})`,
    });
    await call("Page.reload", { ignoreCache: true });
    await sleep(5000);
    await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
    await key("keyDown", "ArrowRight", "ArrowRight", 39);
    await sleep(4250);
    await key("keyUp", "ArrowRight", "ArrowRight", 39);
    await capture(`2026-10-21-boss-${toolId}-before.png`);
    await key("keyDown", "j", "KeyJ", 74);
    await sleep(toolId === "rolled-newspaper" || toolId === "pink-backscratcher" ? 130 : 400);
    await key("keyUp", "j", "KeyJ", 74);
    await capture(`2026-10-21-boss-${toolId}-hit.png`);
    console.log(toolId);
  }
} finally { ws.close(); }
