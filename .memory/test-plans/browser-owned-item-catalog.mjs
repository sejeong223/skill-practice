import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
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
if (!tab) throw new Error("Chrome CDP page not found");
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
async function waitFor(selector, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
    await sleep(150);
  }
  throw new Error(`Missing ${selector}: ${await evaluate("document.body?.innerText?.slice(0,500)")}`);
}
async function click(selector) {
  assert.equal(await evaluate(`(() => { const button = document.querySelector(${JSON.stringify(selector)}); button?.click(); return Boolean(button); })()`), true, selector);
}
async function category(label, selector) {
  assert.equal(await evaluate(`(() => { const button = [...document.querySelectorAll(${JSON.stringify(selector)})].find(x => x.textContent.trim().startsWith(${JSON.stringify(label)})); button?.click(); return Boolean(button); })()`), true, label);
}
async function cardAction(name) {
  assert.equal(await evaluate(`(() => { const card = [...document.querySelectorAll('.owned-catalog-card')].find(x => x.querySelector('h3')?.textContent === ${JSON.stringify(name)}); const button = card?.querySelector('button'); if (!button || button.disabled) return false; button.click(); return true; })()`), true, name);
}
async function saved() {
  return evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(PROGRESS_STORAGE_KEY)}))?.progress`);
}
async function escape() {
  await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
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
  return scene ? { status: scene.runtime?.getStatus(), x: scene.player?.x, attack: scene.progress.equippedAttackToolId,
    defense: scene.progress.equippedDefenseToolId, outfit: scene.progress.equippedOutfitId,
    accessory: scene.progress.equippedAccessoryId, combatTool: scene.combatSystem?.getAttackToolId(),
    defenseTool: scene.defenseToolSystem?.toolId } : null;
})()`;
async function waitForPlay() {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    if ((await evaluate(stageState))?.status === "play") return;
    await sleep(150);
  }
  throw new Error(`Stage did not resume: ${JSON.stringify(await evaluate(stageState))}`);
}

try {
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await call("Page.navigate", { url: "http://localhost:3001" });
  await sleep(1200);
  const progress = createDefaultProgressState("카탈로그 검증 코기");
  progress.onboardingCompleted = true;
  progress.clearedStages = ["world-01-stage-boss"];
  progress.selectedWorldId = "world-02";
  progress.seenCutsceneIds = ["intro-home", "world-02-intro"];
  progress.unlockedSkills = ["bark"];
  progress.bankedCoins = 100;
  progress.ownedToolIds.push("cardboard-tube", "cardboard-box");
  progress.ownedCosmeticIds.push("prince-crown");
  const envelope = { schemaVersion: 3, updatedAt: new Date().toISOString(), progress };
  const injection = await call("Page.addScriptToEvaluateOnNewDocument", {
    source: `if (location.hostname === 'localhost') localStorage.setItem(${JSON.stringify(PROGRESS_STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(envelope))})`,
  });
  await call("Page.reload", { ignoreCache: true });
  await waitFor('[aria-label="보유 아이템 카탈로그 열기"]');
  await waitForPlay();
  await sleep(300);
  await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });

  await click('[aria-label="상점 열기"]');
  await waitFor(".goodboy-shop-dialog");
  await category("의상류", ".goodboy-shop-categories button");
  await click(".goodboy-shop-action");
  assert.equal((await saved()).equippedOutfitId, "pink-caterpillar-suit");
  assert.equal(await evaluate("document.querySelector('.goodboy-shop-action')?.textContent.trim()"), "벗기");
  await click(".goodboy-shop-action");
  assert.equal((await saved()).equippedOutfitId, null);
  assert.ok((await saved()).ownedCosmeticIds.includes("pink-caterpillar-suit"));
  assert.equal((await saved()).bankedCoins, 88);
  await escape();
  await sleep(120);

  await click('[aria-label="보유 아이템 카탈로그 열기"]');
  await waitFor(".owned-catalog-dialog");
  assert.equal(await evaluate("document.activeElement?.getAttribute('aria-label')"), "카탈로그 닫기");
  assert.equal(await evaluate("document.querySelector('.owned-catalog-dialog')?.getAttribute('aria-modal')"), "true");
  assert.equal(await evaluate(`(() => { const last = [...document.querySelectorAll('.owned-catalog-dialog button:not(:disabled)')].at(-1); last.focus(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); return document.activeElement?.getAttribute('aria-label'); })()`), "카탈로그 닫기");
  assert.equal(await evaluate(`(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })); return document.activeElement?.textContent.trim(); })()`), "장착");
  assert.equal((await evaluate(stageState)).status, "paused");
  assert.equal(await evaluate("Boolean(document.querySelector('.goodboy-shop-dialog'))"), false);
  assert.equal(await evaluate("Boolean(document.querySelector('.owned-catalog-card h3')?.textContent.includes('토끼 슬리퍼'))"), true);
  assert.equal(await evaluate("[...document.querySelectorAll('.owned-catalog-card')].some(x => x.textContent.includes('종이관') && !x.querySelector('img'))"), true);
  await cardAction("종이관");
  await category("방패류", ".owned-catalog-categories button");
  await cardAction("종이 상자");
  await category("의상류", ".owned-catalog-categories button");
  await cardAction("핑크 애벌레 수트");
  await category("장신구류", ".owned-catalog-categories button");
  await cardAction("왕자님 왕관");
  assert.deepEqual([...(await saved()).ownedToolIds].filter(id => id === "cardboard-tube"), ["cardboard-tube"]);
  assert.equal((await saved()).bankedCoins, 88);
  assert.equal((await saved()).equippedAttackToolId, "cardboard-tube");
  assert.equal((await saved()).equippedDefenseToolId, "cardboard-box");
  assert.equal((await saved()).equippedOutfitId, "pink-caterpillar-suit");
  assert.equal((await saved()).equippedAccessoryId, "prince-crown");
  assert.equal((await evaluate(stageState)).outfit, "pink-caterpillar-suit");
  await escape();
  await sleep(180);
  assert.equal(await evaluate("Boolean(document.querySelector('.owned-catalog-dialog'))"), false);
  assert.equal(await evaluate("document.activeElement?.getAttribute('aria-label')"), "보유 아이템 카탈로그 열기");
  assert.equal((await evaluate(stageState)).status, "play");
  assert.equal(await evaluate("Boolean(document.querySelector('.pause-overlay'))"), false);

  await call("Page.reload", { ignoreCache: true });
  await waitFor('[aria-label="보유 아이템 카탈로그 열기"]');
  await waitForPlay();
  assert.equal((await saved()).equippedOutfitId, "pink-caterpillar-suit");
  assert.equal((await saved()).equippedAttackToolId, "cardboard-tube");

  for (const [width, height] of [[720, 405], [480, 360]]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await sleep(100);
    const layout = await evaluate(`(() => {
      const selectors = ['.catalog-open-button','.shop-open-button','.pause-button','.reset-progress-button','.world-select-button'];
      const buttons = selectors.map(name => document.querySelector(name)?.getBoundingClientRect().toJSON()).filter(Boolean);
      return { buttons, hud: document.querySelector('.game-hud')?.getBoundingClientRect().toJSON(), width: innerWidth };
    })()`);
    assert.ok(layout.buttons.every(rect => rect.left >= 0 && rect.right <= width), `${width}: buttons in viewport`);
    assert.ok(layout.hud.right <= layout.buttons[0].left, `${width}: HUD does not cover catalog button`);
    for (let index = 1; index < layout.buttons.length; index++) {
      assert.ok(layout.buttons[index].left >= layout.buttons[index - 1].right, `${width}: top buttons do not overlap`);
    }
    await click('[aria-label="보유 아이템 카탈로그 열기"]');
    await waitFor(".owned-catalog-dialog");
    await category("의상류", ".owned-catalog-categories button");
    const dialog = await evaluate("document.querySelector('.owned-catalog-dialog').getBoundingClientRect().toJSON()");
    assert.ok(dialog.left >= 0 && dialog.right <= width && dialog.top >= 0 && dialog.bottom <= height, `${width}: dialog fits`);
    await escape();
    await sleep(100);
  }
  await call("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  assert.equal(await evaluate(`(() => {
    const mount = document.querySelector('canvas')?.parentElement;
    let fiber = mount && mount[Object.keys(mount).find(name => name.startsWith('__reactFiber$'))];
    while (fiber) {
      for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const game = hook.memoizedState?.current;
        if (game?.scene?.getScene) {
          const scene = game.scene.getScene('StageScene');
          scene.progress.seenCutsceneIds.push('world-01-boss-intro');
          scene.scene.start('StageScene', { stageId: 'world-01-stage-boss', seed: 1 });
          return true;
        }
      }
      fiber = fiber.return;
    }
    return false;
  })()`), true);
  await waitFor(".boss-hearts");
  await waitForPlay();
  await click('[aria-label="보유 아이템 카탈로그 열기"]');
  await waitFor(".owned-catalog-dialog");
  await cardAction("토끼 슬리퍼");
  await category("방패류", ".owned-catalog-categories button");
  await cardAction("뒤집힌 밥그릇");
  assert.equal((await evaluate(stageState)).combatTool, "rabbit-slipper");
  assert.equal((await evaluate(stageState)).defenseTool, "upside-down-bowl");
  await escape();
  await sleep(100);
  assert.deepEqual(pageErrors, []);
  console.log("카탈로그 브라우저 검증 통과: 구매·벗기·재착용·저장·보스 장비·일시정지·초점·720/480px");
} finally {
  ws.close();
}
