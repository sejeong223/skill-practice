import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);

const { createDefaultProgressState } = require("../src/game/core/constants.ts");
const { getSelectedWorldResume, getWorldStartStageId, isWorldSelectionUnlocked } = require("../src/game/systems/worldSelection.ts");
const { migrateSave } = require("../src/game/persistence/migrations.ts");
const { ProgressStore } = require("../src/game/persistence/ProgressStore.ts");
const { AutoSaveCoordinator } = require("../src/game/persistence/AutoSaveCoordinator.ts");
const { GameEventBus } = require("../src/game/bridge/GameEventBus.ts");

test("월드 1 보스를 클리어하기 전에는 저장 값이 있어도 월드 선택 복귀를 막는다", () => {
  const progress = createDefaultProgressState();
  progress.selectedWorldId = "world-01";
  assert.equal(isWorldSelectionUnlocked(progress), false);
  assert.equal(getSelectedWorldResume(progress), null);
  progress.clearedStages.push("world-01-stage-boss");
  assert.equal(isWorldSelectionUnlocked(progress), true);
});

test("월드 1은 처음부터 재도전하고 새 깃발을 밟은 뒤에는 그 지점에서 재개한다", () => {
  const progress = createDefaultProgressState();
  progress.clearedStages.push("world-01-stage-boss");
  progress.selectedWorldId = "world-01";
  progress.world01CheckpointStageId = null;
  assert.equal(getWorldStartStageId("world-01"), "world-01-stage-1");
  assert.deepEqual(getSelectedWorldResume(progress), { stageId: "world-01-stage-1" });
  progress.world01CheckpointStageId = "world-01-stage-2";
  assert.deepEqual(getSelectedWorldResume(progress), {
    stageId: "world-01-stage-2", resumeCheckpointId: "world-01-stage-2-checkpoint",
  });
});

test("월드 2는 선택 직후 1스테이지로 가고 새로고침은 첫 미클리어 스테이지로 간다", () => {
  const progress = createDefaultProgressState();
  progress.clearedStages.push("world-01-stage-boss", "world-02-stage-1");
  progress.selectedWorldId = "world-02";
  assert.equal(getWorldStartStageId("world-02"), "world-02-stage-1");
  assert.deepEqual(getSelectedWorldResume(progress), { stageId: "world-02-stage-2" });
  progress.clearedStages.push("world-02-stage-2", "world-02-stage-3", "world-02-stage-4", "world-02-stage-boss");
  assert.deepEqual(getSelectedWorldResume(progress), { stageId: "world-02-stage-1" });
});

test("이전 저장과 잘못된 월드 값은 기존 자동 복귀 경로를 유지한다", () => {
  const legacy = createDefaultProgressState();
  legacy.clearedStages.push("world-01-stage-boss");
  delete legacy.selectedWorldId;
  assert.equal(migrateSave({ schemaVersion: 2, progress: legacy }).selectedWorldId, null);
  for (const invalid of ["world-03", "world-1", 1, {}]) {
    assert.equal(migrateSave({ schemaVersion: 2, progress: { ...legacy, selectedWorldId: invalid } }).selectedWorldId, null);
  }
});

test("월드 선택 완료는 진행 자산을 보존한 채 즉시 저장한다", () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const store = new ProgressStore(storage);
  const progress = createDefaultProgressState();
  progress.clearedStages.push("world-01-stage-boss");
  progress.unlockedSkills.push("bark");
  progress.bankedCoins = 83;
  progress.world01CheckpointStageId = "world-01-stage-4";
  const bus = new GameEventBus();
  const save = new AutoSaveCoordinator(store, progress, bus);
  progress.selectedWorldId = "world-01";
  progress.world01CheckpointStageId = null;
  bus.emit("world-selection-committed", { worldId: "world-01" });
  const loaded = store.load();
  assert.equal(loaded.selectedWorldId, "world-01");
  assert.equal(loaded.world01CheckpointStageId, null);
  assert.deepEqual(loaded.clearedStages, ["world-01-stage-boss"]);
  assert.deepEqual(loaded.unlockedSkills, ["bark"]);
  assert.equal(loaded.bankedCoins, 83);
  save.destroy();
});
