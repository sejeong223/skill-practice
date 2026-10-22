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
const { migrateSave, sanitizeCustomOutfits } = require("../src/game/persistence/migrations.ts");
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
  assert.equal(loaded.version, 4);
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
  assert.deepEqual(loaded.customOutfits, []);
  assert.equal(loaded.equippedCustomOutfitId, null);
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

test("저장 키를 유지하며 스키마 4 envelope로 왕복하고 미래 버전은 거부한다", () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const store = new ProgressStore(storage);
  const progress = createDefaultProgressState();
  progress.ownedCosmeticIds.push("banana-peel-suit");
  progress.equippedOutfitId = "banana-peel-suit";
  store.save(progress);
  assert.equal(SAVE_SCHEMA_VERSION, 4);
  assert.equal(JSON.parse(data.get(PROGRESS_STORAGE_KEY)).schemaVersion, 4);
  assert.equal(store.load().equippedOutfitId, "banana-peel-suit");
  assert.deepEqual(migrateSave({ schemaVersion: 5, progress }).ownedCosmeticIds, []);
});

test("구버전 저장의 코인·장비·체크포인트를 유지하며 사용자 옷은 새로 시작한다", () => {
  const progress = createDefaultProgressState("옛날 코기");
  progress.bankedCoins = 42;
  progress.clearedStages = ["world-01-stage-1"];
  progress.world01CheckpointStageId = "world-01-stage-4";
  progress.ownedToolIds.push("squeaky-ball");
  progress.ownedCosmeticIds.push("bee-bodysuit");
  progress.equippedOutfitId = "bee-bodysuit";
  progress.seenCutsceneIds.push("intro-home");
  progress.customOutfits = [{ id: "custom-outfit-1", cells: Array(56 * 32).fill("#ff0000"), updatedAt: new Date().toISOString() }];
  progress.equippedCustomOutfitId = "custom-outfit-1";
  const loaded = migrateSave({ schemaVersion: 3, progress });
  assert.equal(loaded.version, 4);
  assert.equal(loaded.bankedCoins, 42);
  assert.deepEqual(loaded.clearedStages, ["world-01-stage-1"]);
  assert.equal(loaded.world01CheckpointStageId, "world-01-stage-4");
  assert.ok(loaded.ownedToolIds.includes("squeaky-ball"));
  assert.equal(loaded.equippedOutfitId, "bee-bodysuit");
  assert.deepEqual(loaded.seenCutsceneIds, ["intro-home"]);
  assert.deepEqual(loaded.customOutfits, []);
  assert.equal(loaded.equippedCustomOutfitId, null);
});

test("사용자 옷은 세 슬롯만 남기고 잘못된 개별 디자인만 제외한다", () => {
  const stamp = "2026-10-22T00:00:00.000Z";
  const design = (id, color = "#A1b2C3") => ({ id, cells: Array(56 * 32).fill(color), updatedAt: stamp });
  const safe = sanitizeCustomOutfits([
    design("custom-outfit-1", "#123456"), design("custom-outfit-2"),
    design("custom-outfit-3"), design("custom-outfit-4"),
    design("custom-outfit-1", "#ABCDEF"),
    { ...design("custom-outfit-2"), cells: ["#ABCDEF"] },
    design("custom-outfit-3", "red"),
    { ...design("custom-outfit-2"), updatedAt: "yesterday" },
  ]);
  assert.deepEqual(safe.map(item => item.id), ["custom-outfit-1", "custom-outfit-2", "custom-outfit-3"]);
  assert.equal(safe[0].cells[0], "#ABCDEF");
  const progress = createDefaultProgressState();
  progress.ownedCosmeticIds.push("bee-bodysuit");
  progress.equippedOutfitId = "bee-bodysuit";
  progress.customOutfits = [...safe, design("custom-outfit-4")];
  progress.equippedCustomOutfitId = "custom-outfit-2";
  const restored = migrateSave({ schemaVersion: 4, progress });
  assert.equal(restored.customOutfits.length, 3);
  assert.equal(restored.equippedCustomOutfitId, "custom-outfit-2");
  assert.equal(restored.equippedOutfitId, null);
  assert.equal(migrateSave({ schemaVersion: 4, progress: { ...progress, equippedCustomOutfitId: "custom-outfit-4" } }).equippedCustomOutfitId, null);
  assert.equal(migrateSave({ schemaVersion: 4, progress: { ...progress, customOutfits: [design("custom-outfit-3", "not-a-color")] } }).bankedCoins, progress.bankedCoins);
});

test("사용자 옷 픽셀과 장착 상태가 저장 후 다시 복원된다", () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const store = new ProgressStore(storage);
  const progress = createDefaultProgressState();
  progress.customOutfits = [{ id: "custom-outfit-3", cells: Array(56 * 32).fill(null), updatedAt: "2026-10-22T00:00:00.000Z" }];
  progress.customOutfits[0].cells[10] = "#fF0066";
  progress.equippedCustomOutfitId = "custom-outfit-3";
  store.save(progress);
  const restored = store.load();
  assert.equal(restored.customOutfits[0].cells[10], "#fF0066");
  assert.equal(restored.equippedCustomOutfitId, "custom-outfit-3");
  assert.equal(restored.equippedOutfitId, null);
});

test("외형을 벗고 저장해도 소유권과 코인은 남아 다시 착용할 수 있다", () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const store = new ProgressStore(storage);
  const progress = createDefaultProgressState();
  progress.bankedCoins = 27;
  progress.ownedCosmeticIds = ["bee-bodysuit", "prince-crown"];
  progress.equippedOutfitId = "bee-bodysuit";
  progress.equippedAccessoryId = "prince-crown";
  store.save(progress);
  progress.equippedOutfitId = null;
  progress.equippedAccessoryId = null;
  store.save(progress);
  const restored = store.load();
  assert.equal(restored.equippedOutfitId, null);
  assert.equal(restored.equippedAccessoryId, null);
  assert.deepEqual(restored.ownedCosmeticIds, ["bee-bodysuit", "prince-crown"]);
  assert.equal(restored.bankedCoins, 27);
  assert.equal(restored.equippedAttackToolId, progress.equippedAttackToolId);
  assert.equal(restored.equippedDefenseToolId, progress.equippedDefenseToolId);
  restored.equippedOutfitId = "bee-bodysuit";
  store.save(restored);
  assert.equal(store.load().equippedOutfitId, "bee-bodysuit");
});
