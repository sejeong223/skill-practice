import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);

const { MARKET_CATEGORIES, MARKET_PRODUCTS, getMarketProduct } = require("../src/game/data/marketCatalog.ts");
const { TOOL_DEFINITIONS } = require("../src/game/data/tools.ts");
const { createDefaultProgressState } = require("../src/game/core/constants.ts");
const { migrateSave } = require("../src/game/persistence/migrations.ts");
const { ProgressStore } = require("../src/game/persistence/ProgressStore.ts");
const { SAVE_SCHEMA_VERSION, PROGRESS_STORAGE_KEY } = require("../src/game/persistence/saveTypes.ts");

test("상점 카탈로그는 요청한 19종 순서·가격·아이콘을 보유한다", () => {
  assert.deepEqual(MARKET_CATEGORIES, ["weapon", "shield", "outfit", "accessory"]);
  assert.deepEqual(MARKET_CATEGORIES.map(category => MARKET_PRODUCTS.filter(product => product.category === category).length), [5, 4, 5, 5]);
  assert.deepEqual(MARKET_PRODUCTS.map(product => product.price), [10, 13, 15, 18, 20, 10, 13, 15, 18, 12, 12, 14, 14, 20, 14, 14, 16, 18, 24]);
  assert.equal(new Set(MARKET_PRODUCTS.map(product => product.id)).size, 19);
  for (const product of MARKET_PRODUCTS) {
    assert.ok(product.price > 0);
    assert.equal(product.iconUrl, `/assets/pixel/shop/items/${product.id}.png`);
    assert.equal(getMarketProduct(product.id), product);
    if (product.category === "weapon" || product.category === "shield") {
      assert.equal(product.toolId, product.id);
      assert.equal(product.cosmeticId, undefined);
    } else {
      assert.equal(product.cosmeticId, product.id);
      assert.equal(product.toolId, undefined);
    }
  }
  assert.equal(getMarketProduct("cardboard-box"), undefined);
  assert.equal(TOOL_DEFINITIONS.find(tool => tool.id === "squeaky-ball").price, 10);
  assert.equal(TOOL_DEFINITIONS.find(tool => tool.id === "cushion-pad").price, 10);
});

test("스키마 2 저장은 코인·월드·체크포인트·과거 도구를 보존한다", () => {
  const progress = createDefaultProgressState("옛 코기");
  progress.bankedCoins = 37;
  progress.selectedWorldId = "world-01";
  progress.world01CheckpointStageId = "world-01-stage-4";
  progress.clearedStages = ["world-01-stage-1", "world-01-stage-boss"];
  progress.ownedToolIds = ["squeaky-ball", "cardboard-tube", "cardboard-box"];
  progress.equippedAttackToolId = "cardboard-tube";
  progress.equippedDefenseToolId = "cardboard-box";
  delete progress.ownedCosmeticIds;
  delete progress.equippedOutfitId;
  delete progress.equippedAccessoryId;
  const loaded = migrateSave({ schemaVersion: 2, progress });
  assert.equal(loaded.version, 3);
  assert.equal(loaded.bankedCoins, 37);
  assert.equal(loaded.selectedWorldId, "world-01");
  assert.equal(loaded.world01CheckpointStageId, "world-01-stage-4");
  assert.deepEqual(loaded.clearedStages, ["world-01-stage-1", "world-01-stage-boss"]);
  assert.ok(loaded.ownedToolIds.includes("cardboard-tube"));
  assert.ok(loaded.ownedToolIds.includes("cardboard-box"));
  assert.equal(loaded.equippedAttackToolId, "cardboard-tube");
  assert.equal(loaded.equippedDefenseToolId, "cardboard-box");
  assert.deepEqual(loaded.ownedCosmeticIds, []);
  assert.equal(loaded.equippedOutfitId, null);
  assert.equal(loaded.equippedAccessoryId, null);
});

test("스키마 3은 외형 소유·장착을 복원하고 잘못된 분류·미소유 ID를 버린다", () => {
  const progress = createDefaultProgressState();
  progress.ownedCosmeticIds = ["bee-bodysuit", "prince-crown", "bee-bodysuit", "strange-item"];
  progress.equippedOutfitId = "bee-bodysuit";
  progress.equippedAccessoryId = "prince-crown";
  const loaded = migrateSave({ schemaVersion: 3, progress });
  assert.deepEqual(loaded.ownedCosmeticIds, ["bee-bodysuit", "prince-crown"]);
  assert.equal(loaded.equippedOutfitId, "bee-bodysuit");
  assert.equal(loaded.equippedAccessoryId, "prince-crown");
  assert.equal(migrateSave({ schemaVersion: 3, progress: { ...progress, equippedOutfitId: "prince-crown", equippedAccessoryId: "pink-caterpillar-suit" } }).equippedOutfitId, null);
  assert.equal(migrateSave({ schemaVersion: 3, progress: { ...progress, equippedOutfitId: "hotdog-outfit" } }).equippedOutfitId, null);
  assert.deepEqual(migrateSave({ schemaVersion: 3, progress: { ...progress, ownedCosmeticIds: [12] } }).ownedCosmeticIds, []);
});

test("저장 키를 유지하며 스키마 3 envelope로 왕복하고 미래 버전은 거부한다", () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const store = new ProgressStore(storage);
  const progress = createDefaultProgressState();
  progress.ownedCosmeticIds.push("banana-peel-suit");
  progress.equippedOutfitId = "banana-peel-suit";
  store.save(progress);
  assert.equal(SAVE_SCHEMA_VERSION, 3);
  assert.equal(JSON.parse(data.get(PROGRESS_STORAGE_KEY)).schemaVersion, 3);
  assert.equal(store.load().equippedOutfitId, "banana-peel-suit");
  assert.deepEqual(migrateSave({ schemaVersion: 4, progress }).ownedCosmeticIds, []);
});
