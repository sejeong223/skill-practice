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
const { getWorld01Respawn } = require("../src/game/systems/world01Respawn.ts");
const { CheckpointSystem } = require("../src/game/systems/CheckpointSystem.ts");
const { GameplayEventBus } = require("../src/game/core/events.ts");
const { GameEventBus } = require("../src/game/bridge/GameEventBus.ts");
const { ProgressStore } = require("../src/game/persistence/ProgressStore.ts");
const { AutoSaveCoordinator } = require("../src/game/persistence/AutoSaveCoordinator.ts");
const { migrateSave } = require("../src/game/persistence/migrations.ts");

test("맵 완료가 깃발을 대신하지 않고 다음 깃발만 복귀 지점을 바꾼다", () => {
  const progress = createDefaultProgressState();
  progress.clearedStages.push("world-01-stage-1");
  assert.deepEqual(getWorld01Respawn(progress), { stageId: "world-01-stage-1" });
  progress.world01CheckpointStageId = "world-01-stage-2";
  for (const stage of ["world-01-stage-2", "world-01-stage-3", "world-01-stage-4"]) {
    progress.clearedStages.push(stage);
    assert.deepEqual(getWorld01Respawn(progress), {
      stageId: "world-01-stage-2", resumeCheckpointId: "world-01-stage-2-checkpoint",
    });
  }
  progress.world01CheckpointStageId = "world-01-stage-4";
  assert.deepEqual(getWorld01Respawn(progress), {
    stageId: "world-01-stage-4", resumeCheckpointId: "world-01-stage-4-checkpoint",
  });
});

test("이전 저장에 없는 깃발을 추정하지 않고 기존 자산과 진행 기록을 보존한다", () => {
  const legacy = createDefaultProgressState("기존 코기");
  delete legacy.world01CheckpointStageId;
  Object.assign(legacy, { bankedCoins: 321, deathsTotal: 7,
    clearedStages: ["world-01-stage-1", "world-01-stage-2"], unlockedSkills: ["bark"] });
  const loaded = migrateSave({ schemaVersion: 2, progress: legacy });
  assert.equal(loaded.world01CheckpointStageId, null);
  assert.equal(loaded.playerName, legacy.playerName);
  assert.equal(loaded.bankedCoins, 321); assert.equal(loaded.deathsTotal, 7);
  assert.deepEqual(loaded.clearedStages, legacy.clearedStages);
  assert.deepEqual(loaded.unlockedSkills, ["bark"]);
});

test("잘못된 깃발만 무시하며 유효한 두 깃발은 저장을 왕복한다", () => {
  for (const value of ["world-01-stage-1", "world-01-stage-3", "world-01-stage-boss", "world-02-stage-2", {}, 2, null]) {
    const progress = { ...createDefaultProgressState(), bankedCoins: 57, world01CheckpointStageId: value };
    const loaded = migrateSave({ schemaVersion: 2, progress });
    assert.equal(loaded.world01CheckpointStageId, null);
    assert.equal(loaded.bankedCoins, 57);
  }
  for (const stageId of ["world-01-stage-2", "world-01-stage-4"]) {
    const progress = { ...createDefaultProgressState(), world01CheckpointStageId: stageId };
    assert.equal(migrateSave({ schemaVersion: 2, progress }).world01CheckpointStageId, stageId);
  }
});

test("실제 깃발 이벤트는 즉시 저장하고 이후 맵 완료와 재접속에도 유지한다", () => {
  const data = new Map();
  const store = new ProgressStore({ getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) });
  const progress = createDefaultProgressState();
  progress.bankedCoins = 57;
  const bus = new GameEventBus();
  const save = new AutoSaveCoordinator(store, progress, bus);
  progress.world01CheckpointStageId = "world-01-stage-2";
  bus.emit("checkpoint-activated", { stageId: "world-01-stage-2", checkpointId: "world-01-stage-2-checkpoint" });
  assert.equal(store.load().world01CheckpointStageId, "world-01-stage-2");
  progress.clearedStages.push("world-01-stage-2");
  bus.emit("stage-completed", { stageId: "world-01-stage-2", nextStageId: "world-01-stage-3", bankedCoins: 57 });
  save.destroy();
  const loaded = store.load();
  assert.equal(loaded.world01CheckpointStageId, "world-01-stage-2");
  assert.equal(loaded.bankedCoins, 57);
  assert.deepEqual(loaded.clearedStages, ["world-01-stage-2"]);
});

test("새 씬은 스냅샷을 무음 복원하고 이전 씬 정리와 이후 변형에서 분리된다", () => {
  const stageId = "world-01-stage-2", checkpointId = `${stageId}-checkpoint`;
  const bus = new GameplayEventBus();
  const events = [];
  bus.on("checkpoint-reached", p => events.push(p));
  const mapSnapshot = { checkpointId, randomSeed: 19, activeObjectStates: {}, movedObjectPositions: {},
    spawnedEntityIds: [], firedChainIds: ["opened-wall"], objectStates: {}, gimmickStates: {} };
  const old = new CheckpointSystem({}, bus, stageId, createRuntimeStageState(stageId, 19), () => mapSnapshot);
  old.activate(checkpointId, 1529, 480, 1, 0);
  const saved = structuredClone(old.getSnapshot());
  old.resetForStage();
  const runtime = createRuntimeStageState(stageId);
  const next = new CheckpointSystem({}, bus, stageId, runtime);
  assert.equal(next.restore(saved), true);
  assert.equal(runtime.checkpointUsed, true); assert.equal(runtime.randomSeed, 19);
  assert.equal(runtime.checkpointId, checkpointId); assert.equal(events.length, 1);
  saved.mapSnapshot.firedChainIds.push("later-change");
  assert.deepEqual(next.getSnapshot().mapSnapshot.firedChainIds, ["opened-wall"]);
  assert.equal(next.activate(checkpointId, 1529, 480, 1, 1), false);
  assert.equal(events.length, 1);
});

test("다른 맵과 가짜 깃발의 스냅샷 복원은 거절한다", () => {
  const stageId = "world-01-stage-2";
  const system = new CheckpointSystem({}, new GameplayEventBus(), stageId,
    createRuntimeStageState(stageId), undefined, id => id === "fake");
  const snapshot = { stageId, checkpointId: "fake", x: 1, y: 2, facing: 1 };
  assert.equal(system.restore(snapshot), false);
  assert.equal(system.restore({ ...snapshot, stageId: "world-01-stage-4", checkpointId: "real" }), false);
  assert.equal(system.getSnapshot(), null);
});
