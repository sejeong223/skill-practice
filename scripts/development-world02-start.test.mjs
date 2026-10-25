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
const { prepareDevelopmentWorld02Progress, getDevelopmentWorld02Entry } = require("../src/game/systems/developmentWorld02Start.ts");
const { getSelectedWorldResume } = require("../src/game/systems/worldSelection.ts");

test("개발 모드의 새 저장은 두 인트로와 이름 입력을 건너뛰고 월드 2 게임플레이로 간다", () => {
  const original = createDefaultProgressState();
  const prepared = prepareDevelopmentWorld02Progress(original, true);
  assert.notStrictEqual(prepared, original);
  assert.equal(original.onboardingCompleted, false);
  assert.equal(original.selectedWorldId, null);
  assert.equal(prepared.onboardingCompleted, true);
  assert.equal(prepared.selectedWorldId, "world-02");
  assert.ok(prepared.clearedStages.includes("world-01-stage-boss"));
  assert.ok(prepared.unlockedSkills.includes("bark"));
  assert.ok(prepared.seenCutsceneIds.includes("intro-home"));
  assert.ok(!prepared.seenCutsceneIds.includes("world-02-intro"));
  assert.deepEqual(getDevelopmentWorld02Entry(prepared, true), {
    sceneKey: "StageScene", data: { stageId: "world-02-stage-1", playerName: prepared.playerName },
  });
});

test("기존 월드 1 저장은 코인·장비·사망 기록을 유지하며 월드 2 첫 스테이지로 간다", () => {
  const original = createDefaultProgressState("초코");
  original.onboardingCompleted = true;
  original.selectedWorldId = "world-01";
  original.clearedStages.push("world-01-stage-1", "world-02-stage-1");
  original.seenCutsceneIds.push("world-02-intro");
  original.bankedCoins = 37;
  original.deathsTotal = 5;
  original.ownedToolIds.push("squeaky-ball");
  const prepared = prepareDevelopmentWorld02Progress(original, true);
  assert.equal(prepared.bankedCoins, 37);
  assert.equal(prepared.deathsTotal, 5);
  assert.deepEqual(prepared.ownedToolIds, original.ownedToolIds);
  assert.equal(original.selectedWorldId, "world-01");
  assert.deepEqual(original.clearedStages, ["world-01-stage-1", "world-02-stage-1"]);
  assert.deepEqual(getDevelopmentWorld02Entry(prepared, true), {
    sceneKey: "StageScene", data: { stageId: "world-02-stage-1", playerName: "초코" },
  });
  assert.deepEqual(getSelectedWorldResume(prepared), { stageId: "world-02-stage-2" });
});

test("개발 시작 표시가 이미 있으면 완료·스킬·인트로 기록을 중복하지 않는다", () => {
  const original = createDefaultProgressState();
  original.clearedStages.push("world-01-stage-boss");
  original.unlockedSkills.push("bark");
  original.seenCutsceneIds.push("intro-home", "world-02-intro");
  const prepared = prepareDevelopmentWorld02Progress(original, true);
  assert.equal(prepared.clearedStages.filter(id => id === "world-01-stage-boss").length, 1);
  assert.equal(prepared.unlockedSkills.filter(id => id === "bark").length, 1);
  assert.equal(prepared.seenCutsceneIds.filter(id => id === "intro-home").length, 1);
});

test("월드 2 입구 컷신을 봤는지 여부와 관계없이 개발 시작은 1스테이지다", () => {
  const original = createDefaultProgressState("초코");
  original.seenCutsceneIds.push("world-02-intro");
  assert.deepEqual(getDevelopmentWorld02Entry(original, true), {
    sceneKey: "StageScene", data: { stageId: "world-02-stage-1", playerName: "초코" },
  });
});

test("프로덕션에서는 상태와 진입 경로를 그대로 둔다", () => {
  const original = createDefaultProgressState();
  original.selectedWorldId = "world-01";
  assert.strictEqual(prepareDevelopmentWorld02Progress(original, false), original);
  assert.equal(getDevelopmentWorld02Entry(original, false), null);
  assert.equal(getSelectedWorldResume(original), null);
});
