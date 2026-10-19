import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { BossFeedbackController } = require("../src/game/systems/bossFeedback.ts");
const { SkillSystem } = require("../src/game/systems/SkillSystem.ts");
const { SKILL_DEFINITIONS } = require("../src/game/data/skills.ts");

test("성공한 짖기만 10초 간격으로 세며 재도전에서 해금은 유지한다", () => {
  const player = { setAnimationState() {} };
  const locked = new SkillSystem(player, SKILL_DEFINITIONS);
  assert.equal(locked.use("bark", 0).reason, "locked");
  const skills = new SkillSystem(player, SKILL_DEFINITIONS, undefined, undefined, ["bark"]);
  const feedback = new BossFeedbackController();
  const warnings = [];
  for (const now of [0, 9999, 10000, 19999, 20000, 30000, 40000, 50000]) {
    if (skills.use("bark", now).accepted && feedback.recordBarkUse()) warnings.push(now);
  }
  assert.deepEqual(warnings, [20000, 50000]);
  assert.equal(skills.getRemainingCooldown("bark", 50000), 10000);
  skills.resetCooldowns(); feedback.reset();
  assert.equal(skills.use("bark", 0).accepted, true);
  assert.equal(feedback.recordBarkUse(), false);
});

test("새 경고가 이전 경고를 대체하고 플레이 시간 2500ms 뒤 만료된다", () => {
  const f = new BossFeedbackController();
  f.recordBarkUse(); f.recordBarkUse(); f.recordBarkUse();
  assert.deepEqual(f.getWarning(), { kind: "bark-third", sequence: 1 });
  f.update(500); f.showBowlAlarm();
  assert.deepEqual(f.getWarning(), { kind: "bowl-alarm", sequence: 2 });
  for (const invalid of [-100, NaN, Infinity]) f.update(invalid);
  f.update(2499); assert.ok(f.getWarning());
  f.update(1); assert.equal(f.getWarning(), null);
  f.recordBarkUse(); f.clearWarning(); f.recordBarkUse();
  assert.equal(f.recordBarkUse(), true);
  f.reset(); assert.equal(f.getWarning(), null);
  assert.equal(f.recordBarkUse(), false);
});
