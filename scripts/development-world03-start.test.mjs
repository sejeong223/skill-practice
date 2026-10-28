import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);

const { createDefaultProgressState } = require("../src/game/core/constants.ts");
const { prepareDevelopmentWorld03Progress, getDevelopmentWorld03Entry } = require("../src/game/systems/developmentWorld03Start.ts");
const { getSelectedWorldResume } = require("../src/game/systems/worldSelection.ts");

test("개발 모드의 새 저장은 월드 2 클리어와 물기를 반영하고 월드 3 인트로로 간다", () => {
  const original = createDefaultProgressState();
  const prepared = prepareDevelopmentWorld03Progress(original, true);
  assert.notStrictEqual(prepared, original);
  assert.equal(original.onboardingCompleted, false);
  assert.equal(original.selectedWorldId, null);
  assert.equal(prepared.onboardingCompleted, true);
  assert.equal(prepared.selectedWorldId, null);
  assert.ok(prepared.clearedStages.includes("world-01-stage-boss"));
  assert.ok(prepared.clearedStages.includes("world-02-stage-boss"));
  assert.ok(prepared.unlockedSkills.includes("bark"));
  assert.ok(prepared.unlockedSkills.includes("bite"));
  for (const cutsceneId of ["intro-home", "world-02-intro", "world-02-boss-intro", "world-02-boss-clear"]) {
    assert.ok(prepared.seenCutsceneIds.includes(cutsceneId));
  }
  assert.ok(!prepared.seenCutsceneIds.includes("world-03-intro"));
  assert.deepEqual(getDevelopmentWorld03Entry(prepared, true), {
    sceneKey: "World03EntranceScene", data: { nextStageId: "world-03-stage-1" },
  });
  assert.equal(getSelectedWorldResume(prepared), null);
});

test("기존 저장의 코인·장비·사망 기록과 원본 배열을 유지한다", () => {
  const original = createDefaultProgressState("초코");
  original.onboardingCompleted = true;
  original.selectedWorldId = "world-02";
  original.clearedStages.push("world-01-stage-1", "world-02-stage-1");
  original.bankedCoins = 37;
  original.deathsTotal = 5;
  original.ownedToolIds.push("squeaky-ball");
  const prepared = prepareDevelopmentWorld03Progress(original, true);
  assert.equal(prepared.bankedCoins, 37);
  assert.equal(prepared.deathsTotal, 5);
  assert.deepEqual(prepared.ownedToolIds, original.ownedToolIds);
  assert.deepEqual(original.clearedStages, ["world-01-stage-1", "world-02-stage-1"]);
  assert.equal(original.selectedWorldId, "world-02");
  assert.deepEqual(getDevelopmentWorld03Entry(prepared, true), {
    sceneKey: "World03EntranceScene", data: { nextStageId: "world-03-stage-1" },
  });
});

test("이미 기록된 클리어·스킬·인트로는 중복하지 않는다", () => {
  const original = createDefaultProgressState();
  original.clearedStages.push("world-01-stage-boss", "world-02-stage-boss");
  original.unlockedSkills.push("bark", "bite");
  original.seenCutsceneIds.push("intro-home", "world-02-intro", "world-02-boss-intro", "world-02-boss-clear", "world-03-intro");
  const prepared = prepareDevelopmentWorld03Progress(original, true);
  assert.deepEqual(prepared.clearedStages, original.clearedStages);
  assert.deepEqual(prepared.unlockedSkills, original.unlockedSkills);
  assert.deepEqual(prepared.seenCutsceneIds, original.seenCutsceneIds);
  assert.deepEqual(getDevelopmentWorld03Entry(prepared, true), {
    sceneKey: "StageScene", data: { stageId: "world-03-stage-1", playerName: prepared.playerName },
  });
});

test("일반 빌드는 저장 상태와 진입 경로를 바꾸지 않는다", () => {
  const original = createDefaultProgressState();
  original.selectedWorldId = "world-01";
  assert.strictEqual(prepareDevelopmentWorld03Progress(original, false), original);
  assert.equal(getDevelopmentWorld03Entry(original, false), null);
  assert.equal(getSelectedWorldResume(original), null);
});
