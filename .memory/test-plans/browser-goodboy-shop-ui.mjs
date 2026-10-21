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
const pageErrors = [];
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") pageErrors.push(message.params?.exceptionDetails?.text);
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
async function waitFor(selector, timeoutMs = 7000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
    await sleep(200);
  }
  throw new Error(`Missing ${selector}: ${JSON.stringify(await evaluate("({url:location.href,title:document.title,body:document.body?.innerText?.slice(0,900)})"))}`);
}
async function seed(balance, width = 1280, height = 720) {
  const progress = createDefaultProgressState("상점 검증 코기");
  progress.onboardingCompleted = true;
  progress.clearedStages = ["world-01-stage-boss"];
  progress.selectedWorldId = "world-02";
  progress.seenCutsceneIds = ["intro-home", "world-02-intro"];
  progress.unlockedSkills = ["bark"];
  progress.bankedCoins = balance;
  const envelope = { schemaVersion: 3, updatedAt: new Date().toISOString(), progress };
  await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  const injection = await call("Page.addScriptToEvaluateOnNewDocument", {
    source: `if (location.hostname === 'localhost') localStorage.setItem(${JSON.stringify(PROGRESS_STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(envelope))})`,
  });
  await call("Page.reload", { ignoreCache: true });
  await waitFor('[aria-label="상점 열기"]');
  await sleep(2000);
  await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
}
async function chooseCategory(label) {
  await evaluate(`(() => { const b = [...document.querySelectorAll('.goodboy-shop-categories button')].find(x => x.textContent === ${JSON.stringify(label)}); b?.click(); return Boolean(b); })()`);
  await sleep(100);
}
async function openShop() {
  await evaluate(`document.querySelector('[aria-label="상점 열기"]')?.click()`);
  await waitFor('.goodboy-shop-dialog');
  await sleep(150);
}
const stageState = `(() => {
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
  return scene ? { status: scene.runtime?.getStatus(), x: scene.player?.x,
    balance: scene.progress.bankedCoins, attack: scene.progress.equippedAttackToolId,
    defense: scene.progress.equippedDefenseToolId, outfit: scene.progress.equippedOutfitId,
    accessory: scene.progress.equippedAccessoryId } : null;
})()`;

try {
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Page.navigate", { url: "http://localhost:3001" });
  await sleep(1400);
  await seed(100);
  const before = await evaluate(stageState);
  await openShop();
  await capture("2026-10-21-goodboy-shop-desktop.png");
  console.log("opened", JSON.stringify({ before, state: await evaluate(stageState), dialog: await evaluate(`document.querySelector('.goodboy-shop-dialog')?.getAttribute('aria-modal')`) }));
  const next = await evaluate(`(() => { document.querySelector('[aria-label="다음 상품"]').click(); return document.querySelector('.goodboy-shop-product h3')?.textContent })()`);
  const previous = await evaluate(`(() => { document.querySelector('[aria-label="이전 상품"]').click(); return document.querySelector('.goodboy-shop-product h3')?.textContent })()`);
  console.log("arrows", next, previous);
  await chooseCategory("의상류");
  await evaluate(`document.querySelector('.goodboy-shop-action').click()`);
  await sleep(200);
  await chooseCategory("장신구류");
  await evaluate(`document.querySelector('[aria-label="이전 상품"]').click()`);
  await sleep(80);
  await evaluate(`document.querySelector('.goodboy-shop-action').click()`);
  await sleep(200);
  await chooseCategory("무기류");
  await evaluate(`document.querySelector('.goodboy-shop-action').click()`);
  await sleep(200);
  await chooseCategory("방패류");
  await evaluate(`document.querySelector('.goodboy-shop-action').click()`);
  await sleep(250);
  console.log("purchased", JSON.stringify({ state: await evaluate(stageState), action: await evaluate(`document.querySelector('.goodboy-shop-action')?.textContent`) }));
  await capture("2026-10-21-goodboy-shop-purchased.png");
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await sleep(350);
  console.log("closed", JSON.stringify({ state: await evaluate(stageState), modal: await evaluate(`Boolean(document.querySelector('.goodboy-shop-dialog'))`), pausedOverlay: await evaluate(`Boolean(document.querySelector('.pause-overlay'))`) }));
  await capture("2026-10-21-goodboy-shop-equipped.png");

  await seed(0);
  await openShop();
  await evaluate(`document.querySelector('.goodboy-shop-action').click()`);
  await sleep(150);
  console.log("insufficient", JSON.stringify({ dialogue: await evaluate(`document.querySelector('.goodboy-shop-dialogue')?.textContent`), state: await evaluate(stageState) }));
  await capture("2026-10-21-goodboy-shop-insufficient.png");

  await seed(100, 720, 405);
  await openShop();
  await capture("2026-10-21-goodboy-shop-mobile.png");
  const mobile = await evaluate(`(() => {
    const names = ['.shop-open-button','.pause-button','.reset-progress-button','.world-select-button'];
    const rects = names.map(name => { const r = document.querySelector(name)?.getBoundingClientRect(); return r && { name, left:r.left, right:r.right, top:r.top, bottom:r.bottom }; }).filter(Boolean);
    return { rects, dialog: document.querySelector('.goodboy-shop-dialog')?.getBoundingClientRect().toJSON(), viewport: { width:innerWidth,height:innerHeight } };
  })()`);
  console.log("mobile", JSON.stringify(mobile));
  console.log("pageErrors", JSON.stringify(pageErrors));
} finally { ws.close(); }
