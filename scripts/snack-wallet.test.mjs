import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
  }).outputText, filename);
const { createDefaultProgressState, createRuntimeStageState } = require("../src/game/core/constants.ts");
const { GameEventBus } = require("../src/game/bridge/GameEventBus.ts");
const { EconomySystem } = require("../src/game/systems/EconomySystem.ts");
const { AutoSaveCoordinator } = require("../src/game/persistence/AutoSaveCoordinator.ts");
const { ProgressStore } = require("../src/game/persistence/ProgressStore.ts");
const { PROGRESS_STORAGE_KEY } = require("../src/game/persistence/saveTypes.ts");
const { TOOL_DEFINITIONS } = require("../src/game/data/tools.ts");

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
  removeItem(key) { this.data.delete(key); }
}

function setup(balance = 10, storage = new MemoryStorage()) {
  const store = new ProgressStore(storage);
  const progress = createDefaultProgressState("기존 코기");
  progress.bankedCoins = balance;
  progress.onboardingCompleted = true;
  progress.deathsTotal = 7;
  const runtime = createRuntimeStageState("world-01-stage-1");
  const bus = new GameEventBus();
  const economy = new EconomySystem(progress, runtime, bus);
  const save = new AutoSaveCoordinator(store, progress, bus);
  return { progress, runtime, bus, economy, store, save, storage };
}

test("획득 즉시 저장하고 사망·재접속·클리어 때 잔액을 유지한다", () => {
  const s = setup();
  const payloads = [];
  s.bus.on("coin-changed", p => payloads.push(p));
  for (let i = 0; i < 3; i++) assert.equal(s.economy.collectCoin(s.runtime.stageId), true);
  assert.equal(s.progress.bankedCoins, 13);
  assert.equal(s.runtime.currentStageCoins, 3);
  assert.equal(s.store.load().bankedCoins, 13); // No timer wait: synchronous save.
  assert.equal(payloads.length, 3);
  assert.equal(payloads.at(-1).bankedCoins, 13);
  s.economy.handleDeath();
  assert.equal(s.runtime.currentStageCoins, 0);
  assert.equal(s.progress.bankedCoins, 13);
  s.economy.collectCoin(s.runtime.stageId);
  s.save.destroy();
  const restored = s.store.load();
  const save = new AutoSaveCoordinator(s.store, restored, s.bus);
  const economy = new EconomySystem(restored, s.runtime, s.bus);
  assert.equal(restored.bankedCoins, 14);
  assert.equal(restored.playerName, "기존 코기");
  assert.equal(restored.deathsTotal, 7);
  assert.equal(restored.onboardingCompleted, true);
  assert.equal(economy.commitStageClear(), 14);
  assert.equal(economy.commitStageClear(), 14);
  assert.deepEqual(restored.clearedStages, [s.runtime.stageId]);
  assert.equal(s.store.load().bankedCoins, 14);
  save.destroy();
});

test("잘못된 획득은 무변경이고 코인0개 클리어도 완료 기록을 남긴다", () => {
  const s = setup();
  let events = 0;
  s.bus.on("coin-changed", () => events++);
  for (const amount of [0, -1, 0.5, NaN, Infinity]) assert.equal(s.economy.collectCoin(s.runtime.stageId, amount), false);
  assert.equal(s.economy.collectCoin("world-01-stage-2"), false);
  assert.equal(events, 0);
  assert.equal(s.progress.bankedCoins, 10);
  s.economy.commitStageClear();
  assert.deepEqual(s.progress.clearedStages, [s.runtime.stageId]);
  assert.equal(s.progress.bankedCoins, 10);
  s.save.destroy();
});

test("기존 v2 저장을 승계하고 상점도 같은 잔액에서 차감한다", () => {
  const s = setup(1234);
  s.store.save(s.progress);
  assert.equal(JSON.parse(s.storage.getItem(PROGRESS_STORAGE_KEY)).schemaVersion, 3);
  const loaded = s.store.load();
  const economy = new EconomySystem(loaded, s.runtime, s.bus);
  economy.collectCoin(s.runtime.stageId);
  assert.equal(loaded.bankedCoins, 1235);
  const tool = TOOL_DEFINITIONS.find(t => !loaded.ownedToolIds.includes(t.id) && t.price > 0 && t.price <= loaded.bankedCoins);
  assert.ok(tool);
  assert.equal(economy.purchaseTool(tool.id), true);
  assert.equal(loaded.bankedCoins, 1235 - tool.price);
  assert.equal(economy.purchaseTool(tool.id), false);
  s.save.destroy();
});

test("저장 실패는 획득 처리를 중단하지 않고 destroy는 구독을 해제한다", t => {
  const warn = t.mock.method(console, "warn", () => {});
  const storage = new MemoryStorage();
  storage.setItem = () => { throw new Error("quota"); };
  const s = setup(10, storage);
  assert.doesNotThrow(() => s.economy.collectCoin(s.runtime.stageId));
  assert.equal(s.progress.bankedCoins, 11);
  assert.equal(warn.mock.callCount(), 1);
  s.save.destroy();
  const warnings = warn.mock.callCount();
  s.economy.collectCoin(s.runtime.stageId);
  assert.equal(warn.mock.callCount(), warnings);
});

test("과거 완료 스테이지를 재도전해도 새 획득만 적립한다", () => {
  const s = setup();
  s.progress.clearedStages.push(s.runtime.stageId);
  assert.equal(s.economy.collectCoin(s.runtime.stageId), true);
  assert.equal(s.store.load().bankedCoins, 11);
  assert.equal(s.economy.commitStageClear(), 11);
  assert.equal(s.economy.commitStageClear(), 11);
  assert.deepEqual(s.progress.clearedStages, [s.runtime.stageId]);
  s.save.destroy();
});
