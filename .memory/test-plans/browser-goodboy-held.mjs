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
  await sleep(1500);
  for (const [index, [attackId, defenseId, worldId]] of [
    ["rolled-newspaper", "umbrella", "world-02"],
    ["squeaky-ball", "cushion-pad", "world-02"],
    ["plastic-frisbee", "yellow-pot-lid", "world-01"],
  ].entries()) {
    const progress = createDefaultProgressState("장비 확인 코기");
    progress.onboardingCompleted = true;
    progress.clearedStages = ["world-01-stage-boss"];
    progress.selectedWorldId = worldId;
    progress.unlockedSkills = ["bark"];
    progress.ownedToolIds = ["rabbit-slipper", "upside-down-bowl", attackId, defenseId];
    progress.equippedAttackToolId = attackId;
    progress.equippedDefenseToolId = defenseId;
    progress.seenCutsceneIds = ["intro-home", "world-02-intro"];
    const envelope = { schemaVersion: 3, updatedAt: new Date().toISOString(), progress };
    const injection = await call("Page.addScriptToEvaluateOnNewDocument", {
      source: `if (location.hostname === 'localhost') localStorage.setItem(${JSON.stringify(PROGRESS_STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(envelope))})`,
    });
    await call("Page.reload", { ignoreCache: true });
    await sleep(5500);
    await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
    await capture([
      "2026-10-21-goodboy-held-newspaper-umbrella.png",
      "2026-10-21-goodboy-held-ball-cushion.png",
      "2026-10-21-goodboy-held-world01.png",
    ][index]);
    if (index === 0) {
      await key("keyDown", "j", "KeyJ", 74);
      await sleep(90);
      await capture("2026-10-21-goodboy-held-attack.png");
      await key("keyUp", "j", "KeyJ", 74);
      await key("keyDown", "ArrowRight", "ArrowRight", 39);
      await sleep(620);
      await key("keyUp", "ArrowRight", "ArrowRight", 39);
      await key("keyDown", "ArrowLeft", "ArrowLeft", 37);
      await sleep(170);
      await capture("2026-10-21-goodboy-held-left.png");
      await key("keyUp", "ArrowLeft", "ArrowLeft", 37);
    }
  }
} finally {
  ws.close();
}
