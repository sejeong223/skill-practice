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
const { prepareDevelopmentIntroProgress } = require("../src/game/systems/developmentIntroStart.ts");

test("개발 모드의 새 저장은 첫 인트로 상태를 유지한다", () => {
  const original = createDefaultProgressState();
  const prepared = prepareDevelopmentIntroProgress(original, true);
  assert.equal(prepared.onboardingCompleted, false);
  assert.deepEqual(prepared.seenCutsceneIds, []);
  assert.notStrictEqual(prepared, original);
});

test("기존 저장도 인트로를 다시 보되 코인·장비·클리어 기록은 보존한다", () => {
  const original = createDefaultProgressState("초코");
  original.onboardingCompleted = true;
  original.selectedWorldId = "world-02";
  original.seenCutsceneIds = ["intro-home", "world-02-intro"];
  original.clearedStages = ["world-01-stage-boss"];
  original.unlockedSkills = ["bark"];
  original.bankedCoins = 37;
  original.deathsTotal = 5;
  original.ownedToolIds.push("squeaky-ball");
  const prepared = prepareDevelopmentIntroProgress(original, true);
  assert.equal(prepared.onboardingCompleted, false);
  assert.deepEqual(prepared.seenCutsceneIds, ["world-02-intro"]);
  assert.equal(prepared.selectedWorldId, "world-02");
  assert.deepEqual(prepared.clearedStages, original.clearedStages);
  assert.deepEqual(prepared.unlockedSkills, original.unlockedSkills);
  assert.deepEqual(prepared.ownedToolIds, original.ownedToolIds);
  assert.equal(prepared.bankedCoins, 37);
  assert.equal(prepared.deathsTotal, 5);
  assert.equal(original.onboardingCompleted, true);
  assert.deepEqual(original.seenCutsceneIds, ["intro-home", "world-02-intro"]);
});

test("배포 모드에서는 저장을 그대로 복원한다", () => {
  const original = createDefaultProgressState();
  original.onboardingCompleted = true;
  original.seenCutsceneIds.push("intro-home");
  assert.strictEqual(prepareDevelopmentIntroProgress(original, false), original);
});
