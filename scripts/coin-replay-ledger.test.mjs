import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compile = filename => ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText;
require.extensions[".ts"] = (module, filename) => module._compile(compile(filename), filename);
const { createDefaultProgressState, createRuntimeStageState } = require("../src/game/core/constants.ts");
const { GameEventBus } = require("../src/game/bridge/GameEventBus.ts");
const { EconomySystem } = require("../src/game/systems/EconomySystem.ts");
const { AutoSaveCoordinator } = require("../src/game/persistence/AutoSaveCoordinator.ts");
const { ProgressStore } = require("../src/game/persistence/ProgressStore.ts");
const { PROGRESS_STORAGE_KEY } = require("../src/game/persistence/saveTypes.ts");
const { hasCollectedCoin } = require("../src/game/systems/coinLedger.ts");

function loadStageRuntime() {
  const filename = path.resolve("src/game/stages/StageRuntime.ts");
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const actualRequire = loaded.require.bind(loaded);
  loaded.require = id => id === "./StageEntityFactory" ? { StageEntityFactory: class {} } : actualRequire(id);
  loaded._compile(compile(filename), filename);
  return loaded.exports.StageRuntime;
}
const StageRuntime = loadStageRuntime();

function harness(balance = 0, progress = createDefaultProgressState(), storage) {
  const data = storage ?? { values: new Map(), getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { this.values.set(key, value); }, removeItem(key) { this.values.delete(key); } };
  progress.bankedCoins = balance;
  const store = new ProgressStore(data);
  const bus = new GameEventBus();
  const save = new AutoSaveCoordinator(store, progress, bus);
  const definition = {
    id: "world-01-stage-1", worldId: "world-01", kind: "boss", mapWidth: 500,
    segments: [{ length: 500, platforms: [], traps: [], enemies: [], coins: ["bone-a", "bone-b"], collectibles: [] }],
  };
  const factory = { create(_scene, request) {
    return { id: request.id ?? request.kind, active: true, visible: true, body: { enable: true },
      setActive(value) { this.active = value; return this; },
      setVisible(value) { this.visible = value; return this; },
      destroy() {},
    };
  } };
  function stage(nextProgress = progress) {
    const runtime = new StageRuntime({}, definition, createRuntimeStageState(definition.id), bus, factory, nextProgress);
    runtime.build();
    return runtime;
  }
  return { progress, data, store, bus, save, stage };
}

test("collected bone disappears on death reset and cannot pay twice", () => {
  const h = harness(10);
  const stage = h.stage();
  const first = stage.getEntities("coin")[0].entity;
  assert.equal(stage.collectCoin("bone-a"), true);
  assert.equal(h.progress.bankedCoins, 11);
  assert.equal(h.store.load().bankedCoins, 11);
  assert.equal(h.store.load().collectedCoinIds[0], "world-01-stage-1:bone-a");
  assert.equal(first.visible, false);
  assert.equal(first.body.enable, false);
  stage.resetCoins(); // Death and checkpoint snapshot restoration use this path.
  assert.equal(first.active, false);
  assert.equal(first.body.enable, false);
  assert.equal(stage.collectCoin("bone-a"), false);
  assert.equal(stage.collectCoin("bone-b"), true);
  assert.equal(h.progress.bankedCoins, 12);
  h.save.destroy();
});

test("reload builds collected coins hidden but another stage may use the same ID", () => {
  const h = harness();
  const firstStage = h.stage();
  assert.equal(firstStage.collectCoin("bone-a"), true);
  const restored = h.store.load();
  const reloadedStage = h.stage(restored);
  const coins = reloadedStage.getEntities("coin");
  assert.equal(coins[0].entity.active, false);
  assert.equal(coins[0].entity.visible, false);
  assert.equal(coins[1].entity.active, true);
  assert.equal(reloadedStage.collectCoin("bone-a"), false);
  assert.equal(hasCollectedCoin(restored, "world-01-stage-2", "bone-a"), false);
  const otherRuntime = createRuntimeStageState("world-01-stage-2");
  const otherEconomy = new EconomySystem(restored, otherRuntime, new GameEventBus());
  assert.equal(otherEconomy.collectCoin(otherRuntime.stageId, 1, "bone-a"), true);
  assert.equal(restored.bankedCoins, 2);
  h.save.destroy();
});

test("legacy save without the ledger keeps its wallet and equipment", () => {
  const h = harness(38);
  h.progress.ownedToolIds.push("squeaky-ball");
  const oldProgress = { ...h.progress };
  delete oldProgress.collectedCoinIds;
  h.data.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ schemaVersion: 3, updatedAt: new Date().toISOString(), progress: oldProgress }));
  const restored = h.store.load();
  assert.equal(restored.bankedCoins, 38);
  assert.ok(restored.ownedToolIds.includes("squeaky-ball"));
  assert.deepEqual(restored.collectedCoinIds, []);
  h.save.destroy();
});

test("normal stage clear keeps eaten coins; world boss clear only resets its own world", () => {
  const h = harness(20);
  const runtime = createRuntimeStageState("world-01-stage-1");
  const economy = new EconomySystem(h.progress, runtime, h.bus);
  assert.equal(economy.collectCoin(runtime.stageId, 1, "bone-a"), true);
  runtime.stageId = "world-02-stage-1";
  assert.equal(economy.collectCoin(runtime.stageId, 1, "bone-a"), true);
  assert.equal(h.progress.bankedCoins, 22);

  runtime.stageId = "world-01-stage-2";
  economy.commitStageClear();
  assert.equal(h.progress.collectedCoinIds.length, 2);
  assert.equal(h.store.load().collectedCoinIds.length, 2);

  runtime.stageId = "world-01-stage-boss";
  economy.commitStageClear();
  assert.deepEqual(h.progress.collectedCoinIds, ["world-02-stage-1:bone-a"]);
  assert.deepEqual(h.store.load().collectedCoinIds, ["world-02-stage-1:bone-a"]);
  assert.equal(h.progress.bankedCoins, 22);

  runtime.stageId = "world-01-stage-1";
  assert.equal(economy.collectCoin(runtime.stageId, 1, "bone-a"), true);
  assert.equal(h.progress.bankedCoins, 23);
  runtime.stageId = "world-02-stage-1";
  assert.equal(economy.collectCoin(runtime.stageId, 1, "bone-a"), false);
  assert.equal(h.progress.bankedCoins, 23);
  runtime.stageId = "world-02-stage-boss";
  economy.commitStageClear();
  assert.deepEqual(h.progress.collectedCoinIds, ["world-01-stage-1:bone-a"]);
  h.save.destroy();
});
