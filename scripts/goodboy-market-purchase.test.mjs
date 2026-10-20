import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);

const { createDefaultProgressState, createRuntimeStageState } = require("../src/game/core/constants.ts");
const { MARKET_PRODUCTS } = require("../src/game/data/marketCatalog.ts");
const { GameEventBus } = require("../src/game/bridge/GameEventBus.ts");
const { EconomySystem } = require("../src/game/systems/EconomySystem.ts");
const { AutoSaveCoordinator } = require("../src/game/persistence/AutoSaveCoordinator.ts");
const { ProgressStore } = require("../src/game/persistence/ProgressStore.ts");

function setup(balance = 1000, stageId = "world-01-stage-1") {
  const storage = { data: new Map(), getItem(key) { return this.data.get(key) ?? null; },
    setItem(key, value) { this.data.set(key, value); }, removeItem(key) { this.data.delete(key); } };
  const store = new ProgressStore(storage);
  const progress = createDefaultProgressState();
  progress.bankedCoins = balance;
  const runtime = createRuntimeStageState(stageId);
  const bus = new GameEventBus();
  const save = new AutoSaveCoordinator(store, progress, bus);
  const economy = new EconomySystem(progress, runtime, bus);
  return { progress, runtime, bus, save, store, economy };
}

test("월드 1과 월드 2 코인은 같은 지갑으로 적립되고 구매 후 즉시 저장된다", () => {
  const s = setup(0);
  assert.equal(s.economy.collectCoin("world-01-stage-1", 8), true);
  s.runtime.stageId = "world-02-stage-1";
  assert.equal(s.economy.collectCoin("world-02-stage-1", 7), true);
  assert.equal(s.progress.bankedCoins, 15);
  assert.equal(s.store.load().bankedCoins, 15);
  const result = s.economy.purchaseMarketProduct("squeaky-ball");
  assert.deepEqual(result, { ok: true, itemId: "squeaky-ball", category: "weapon", bankedCoins: 5 });
  assert.equal(s.store.load().bankedCoins, 5);
  assert.ok(s.store.load().ownedToolIds.includes("squeaky-ball"));
  s.save.destroy();
});

test("19종을 각자 명시된 가격에 한 번씩만 구매하고 의상도 저장한다", () => {
  const s = setup();
  let expectedBalance = 1000;
  let purchases = 0;
  s.bus.on("market-item-purchased", () => purchases++);
  for (const product of MARKET_PRODUCTS) {
    expectedBalance -= product.price;
    assert.deepEqual(s.economy.purchaseMarketProduct(product.id), {
      ok: true, itemId: product.id, category: product.category, bankedCoins: expectedBalance,
    });
    assert.equal(s.progress.bankedCoins, expectedBalance);
    assert.ok(s.store.load()[product.cosmeticId ? "ownedCosmeticIds" : "ownedToolIds"].includes(product.id));
    assert.deepEqual(s.economy.purchaseMarketProduct(product.id), { ok: false, reason: "already-owned" });
  }
  assert.equal(purchases, 19);
  assert.equal(s.store.load().bankedCoins, expectedBalance);
  s.save.destroy();
});

test("코인 부족·알 수 없는 상품·기본 장비 재구매는 무변경이다", () => {
  const s = setup(9);
  let events = 0;
  s.bus.on("market-item-purchased", () => events++);
  s.bus.on("coin-changed", () => events++);
  assert.deepEqual(s.economy.purchaseMarketProduct("squeaky-ball"), { ok: false, reason: "insufficient-coins" });
  assert.deepEqual(s.economy.purchaseMarketProduct("rabbit-slipper"), { ok: false, reason: "unknown-item" });
  assert.deepEqual(s.economy.purchaseMarketProduct("no-item"), { ok: false, reason: "unknown-item" });
  assert.equal(s.economy.purchaseTool("cardboard-tube"), false);
  assert.equal(s.progress.bankedCoins, 9);
  assert.equal(events, 0);
  assert.equal(s.economy.purchaseTool("squeaky-ball"), false);
  s.economy.collectCoin(s.runtime.stageId);
  assert.equal(s.economy.purchaseTool("squeaky-ball"), true);
  assert.equal(s.economy.purchaseTool("squeaky-ball"), false);
  assert.equal(s.progress.bankedCoins, 0);
  s.save.destroy();
});
