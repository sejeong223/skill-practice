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
  await sleep(1400);
  const tools = process.argv.includes("--bowl") ? ["upside-down-bowl"] : process.argv.includes("--one")
    ? ["yellow-pot-lid"] : ["cushion-pad", "greasy-pizza-box", "umbrella", "yellow-pot-lid"];
  const finalBlock = process.argv.includes("--last") || process.argv.includes("--bowl");
  for (const toolId of tools) {
    const progress = createDefaultProgressState("방패 검증 코기");
    progress.onboardingCompleted = true;
    progress.clearedStages = ["world-01-stage-boss"];
    progress.selectedWorldId = "world-01";
    progress.world01BossReplayActive = true;
    progress.seenCutsceneIds = ["intro-home", "world-01-boss-intro"];
    progress.ownedToolIds = ["rabbit-slipper", "upside-down-bowl", toolId];
    progress.equippedDefenseToolId = toolId;
    const envelope = { schemaVersion: 3, updatedAt: new Date().toISOString(), progress };
    const injection = await call("Page.addScriptToEvaluateOnNewDocument", {
      source: `if (location.hostname === 'localhost') localStorage.setItem(${JSON.stringify(PROGRESS_STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(envelope))})`,
    });
    await call("Page.reload", { ignoreCache: true });
    await sleep(1900);
    await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
    let position;
    for (let attempt = 0; attempt < 15; attempt++) {
      position = await evaluate(`(() => {
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
      if (!game) return 'game-not-found';
      const scene = game.scene.getScene('StageScene');
      if (!scene?.player || !scene?.defenseToolSystem) return 'stage-not-ready';
      window.__goodboyShieldStage = scene;
      scene.player.setPosition(1100, 500);
      scene.player.body.reset(1100, 500);
      scene.player.setFlipX(false);
      ${finalBlock ? "scene.defenseToolSystem.remainingCharges = 1;" : ""}
      return { x: scene.player.x, toolId: scene.defenseToolSystem.getToolId(), charges: scene.defenseToolSystem.getRemainingCharges() };
      })()`);
      if (typeof position !== "string") break;
      await sleep(500);
    }
    console.log("position", toolId, JSON.stringify(position));
    if (typeof position === "string") throw new Error(position);
    await capture(`2026-10-21-boss-shield-${toolId}-${finalBlock ? "last-before" : "before"}.png`);
    if (finalBlock) {
      const block = await evaluate(`new Promise(resolve => {
        const stage = window.__goodboyShieldStage;
        const started = performance.now();
        const tick = () => {
          if (stage.defenseToolSystem.getRemainingCharges() === 0) {
            resolve({ hearts: stage.calicoBoss.state.corgiHearts, dogs: stage.strayDogEvent.getActiveDogs().length,
              playerX: stage.player.x, ringingVisible: stage.calicoBoss.ringingNotice?.visible,
              nextThrowIn: stage.calicoBoss.state.nextThrowAt - stage.calicoBoss.elapsed });
          } else if (performance.now() - started > 8000) resolve('block-timeout');
          else requestAnimationFrame(tick);
        };
        tick();
      })`);
      console.log("on-block", toolId, JSON.stringify(block));
      if (block === "block-timeout") throw new Error(`${toolId} was not struck`);
    } else await sleep(3500);
    await capture(`2026-10-21-boss-shield-${toolId}-${finalBlock ? "last-after" : "after"}.png`);
    const state = await evaluate(`(() => {
      const scene = window.__goodboyShieldStage;
      return { toolId: scene.defenseToolSystem.getToolId(), charges: scene.defenseToolSystem.getRemainingCharges(),
        hearts: scene.calicoBoss.state.corgiHearts, dogs: scene.strayDogEvent.getActiveDogs().length,
        playerX: scene.player.x, shieldVisible: scene.equipmentVisual?.shield?.visible,
        ringingVisible: scene.calicoBoss.ringingNotice?.visible,
        drawbacks: scene.progress.discoveredDrawbackIds };
    })()`);
    console.log("after", toolId, JSON.stringify(state));
  }
} finally { ws.close(); }
