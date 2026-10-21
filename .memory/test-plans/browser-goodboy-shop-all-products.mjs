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
const { MARKET_PRODUCTS, MARKET_CATEGORIES } = require(path.join(root, "src/game/data/marketCatalog.ts"));
const { SHOP_CATEGORY_LABELS } = require(path.join(root, "src/game/data/shopDialogue.ts"));
const tab = (await fetch("http://127.0.0.1:9225/json/list").then(r => r.json())).find(item => item.type === "page");
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let serial = 0;
const pending = new Map();
const errors = [];
ws.onmessage = event => {
  const msg = JSON.parse(event.data);
  if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.text);
  if (!pending.has(msg.id)) return;
  const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
  if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result);
};
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(selector) {
  for (let i = 0; i < 100; i += 1) {
    if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return;
    await sleep(150);
  }
  throw new Error(`Missing ${selector}`);
}
async function screenshot(filename) {
  const result = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(root, ".memory/test-plans/assets", filename), Buffer.from(result.data, "base64"));
}

try {
  await call("Page.enable"); await call("Runtime.enable");
  const progress = createDefaultProgressState("통합 검증 코기");
  progress.onboardingCompleted = true;
  progress.clearedStages = ["world-01-stage-boss"];
  progress.selectedWorldId = "world-02";
  progress.seenCutsceneIds = ["intro-home", "world-02-intro"];
  progress.bankedCoins = 1000;
  const envelope = { schemaVersion: 3, updatedAt: new Date().toISOString(), progress };
  const injection = await call("Page.addScriptToEvaluateOnNewDocument", { source: `if (location.hostname === 'localhost') localStorage.setItem(${JSON.stringify(PROGRESS_STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(envelope))})` });
  await call("Page.navigate", { url: "http://localhost:3001" });
  await waitFor('[aria-label="상점 열기"]');
  await sleep(1800);
  await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
  await evaluate(`document.querySelector('[aria-label="상점 열기"]').click()`);
  await waitFor(".goodboy-shop-dialog");
  const purchased = [];
  for (const category of MARKET_CATEGORIES) {
    const label = SHOP_CATEGORY_LABELS[category];
    const count = MARKET_PRODUCTS.filter(item => item.category === category).length;
    await evaluate(`([...document.querySelectorAll('.goodboy-shop-categories button')].find(b => b.textContent === ${JSON.stringify(label)}))?.click()`);
    await sleep(100);
    for (let index = 0; index < count; index += 1) {
      const product = MARKET_PRODUCTS.find(item => item.category === category && MARKET_PRODUCTS.filter(p => p.category === category).indexOf(item) === index);
      const details = await evaluate(`(() => ({ name:document.querySelector('.goodboy-shop-product h3')?.textContent, price:document.querySelector('.goodboy-shop-product-info strong')?.textContent, image:document.querySelector('.goodboy-shop-item-portrait img')?.naturalWidth, button:document.querySelector('.goodboy-shop-action')?.textContent }))()`);
      if (details.name !== product.nameKo || details.price !== `${product.price} 코인` || details.image !== 64 || details.button !== "구매") throw new Error(JSON.stringify({ product: product.id, details }));
      await evaluate(`document.querySelector('.goodboy-shop-action').click()`);
      await sleep(80);
      purchased.push(product.id);
      if (index < count - 1) {
        await evaluate(`document.querySelector('[aria-label="다음 상품"]').click()`);
        await sleep(70);
      }
    }
  }
  const expected = 1000 - MARKET_PRODUCTS.reduce((sum, item) => sum + item.price, 0);
  const after = await evaluate(`({ balance:document.querySelector('.goodboy-shop-header-actions strong')?.textContent, save:JSON.parse(localStorage.getItem(${JSON.stringify(PROGRESS_STORAGE_KEY)}))?.progress })`);
  if (after.save.bankedCoins !== expected || after.save.ownedToolIds.length < 9 || after.save.ownedCosmeticIds.length !== 10) throw new Error(JSON.stringify({expected,after}));
  await screenshot("2026-10-21-goodboy-shop-all-purchased.png");
  await evaluate(`document.querySelector('.goodboy-shop-close').click()`);
  await call("Page.reload", { ignoreCache: true });
  await waitFor('[aria-label="상점 열기"]');
  await sleep(1800);
  await evaluate(`document.querySelector('[aria-label="상점 열기"]').click()`);
  await waitFor(".goodboy-shop-dialog");
  const restored = await evaluate(`({ balance:document.querySelector('.goodboy-shop-header-actions strong')?.textContent, item:document.querySelector('.goodboy-shop-product-info span')?.textContent, action:document.querySelector('.goodboy-shop-action')?.textContent })`);
  if (!restored.balance.includes(String(expected)) || restored.action !== "장착") throw new Error(JSON.stringify({expected,restored}));
  console.log(JSON.stringify({ purchased: purchased.length, expectedBalance: expected, restored, errors }));
} finally { ws.close(); }
