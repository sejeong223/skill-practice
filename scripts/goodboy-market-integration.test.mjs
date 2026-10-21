import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { createDefaultProgressState, createRuntimeStageState } = require("../src/game/core/constants.ts");
const { MARKET_PRODUCTS, MARKET_CATEGORIES } = require("../src/game/data/marketCatalog.ts");
const { GameEventBus } = require("../src/game/bridge/GameEventBus.ts");
const { EconomySystem } = require("../src/game/systems/EconomySystem.ts");
const { AutoSaveCoordinator } = require("../src/game/persistence/AutoSaveCoordinator.ts");
const { ProgressStore } = require("../src/game/persistence/ProgressStore.ts");

test("four market pages map every priced product to a real, unique image", () => {
  assert.deepEqual(MARKET_CATEGORIES, ["weapon", "shield", "outfit", "accessory"]);
  assert.deepEqual(MARKET_CATEGORIES.map(category => MARKET_PRODUCTS.filter(item => item.category === category).length), [5, 4, 5, 5]);
  assert.equal(new Set(MARKET_PRODUCTS.map(item => item.id)).size, 19);
  for (const product of MARKET_PRODUCTS) {
    assert.ok(Number.isInteger(product.price) && product.price > 0);
    assert.ok(product.nameKo && product.advantageKo);
    const filepath = path.resolve("public", product.iconUrl.slice(1));
    assert.ok(fs.existsSync(filepath), product.iconUrl);
    assert.ok(fs.statSync(filepath).size > 200, product.iconUrl);
  }
});

test("coins from both worlds buy an outfit and shield, then equipment survives reload", () => {
  const storage = { data: new Map(), getItem(key) { return this.data.get(key) ?? null; },
    setItem(key, value) { this.data.set(key, value); }, removeItem(key) { this.data.delete(key); } };
  const store = new ProgressStore(storage);
  const progress = createDefaultProgressState("통합 검증 코기");
  const runtime = createRuntimeStageState("world-01-stage-1");
  const bus = new GameEventBus();
  const save = new AutoSaveCoordinator(store, progress, bus);
  const economy = new EconomySystem(progress, runtime, bus);
  const coinUpdates = [];
  bus.on("coin-changed", payload => coinUpdates.push(payload.bankedCoins));
  assert.equal(economy.collectCoin("world-01-stage-1", 18), true);
  runtime.stageId = "world-02-stage-1";
  assert.equal(economy.collectCoin("world-02-stage-1", 16), true);
  assert.deepEqual(coinUpdates, [18, 34]);
  assert.equal(economy.purchaseMarketProduct("pink-caterpillar-suit").ok, true);
  assert.equal(economy.purchaseMarketProduct("cushion-pad").ok, true);
  progress.equippedOutfitId = "pink-caterpillar-suit";
  progress.equippedDefenseToolId = "cushion-pad";
  bus.emit("cosmetic-change-requested", { outfitId: "pink-caterpillar-suit" });
  bus.emit("equipment-change-requested", { defenseToolId: "cushion-pad" });
  save.flush();
  const restored = store.load();
  assert.equal(restored.bankedCoins, 12);
  assert.ok(restored.ownedCosmeticIds.includes("pink-caterpillar-suit"));
  assert.ok(restored.ownedToolIds.includes("cushion-pad"));
  assert.equal(restored.equippedOutfitId, "pink-caterpillar-suit");
  assert.equal(restored.equippedDefenseToolId, "cushion-pad");
  assert.deepEqual(economy.purchaseMarketProduct("pink-caterpillar-suit"), { ok: false, reason: "already-owned" });
  assert.equal(progress.bankedCoins, 12);
  save.destroy();
});
