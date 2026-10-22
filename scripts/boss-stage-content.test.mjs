import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { STAGE_DEFINITIONS } = require("../src/game/data/worlds.ts");
const { BOSS_COMBAT_CONFIG, getBossDamage } = require("../src/game/data/bossCombat.ts");

test("월드 1 보스에는 화면과 판정에 남는 기본 코인이 없다", () => {
  const stage = STAGE_DEFINITIONS.find(stage => stage.id === "world-01-stage-boss");
  assert.ok(stage);
  assert.equal(stage.segments.flatMap(segment => segment.coins).length, 0);
  assert.ok(stage.segments.every(segment => segment.platforms.length > 0));
});

test("다른 월드 보스의 기존 코인 데이터는 유지한다", () => {
  const stages = STAGE_DEFINITIONS.filter(stage => stage.id.endsWith("-boss") && stage.id !== "world-01-stage-boss");
  assert.equal(stages.length, 4);
  for (const stage of stages) {
    assert.equal(stage.segments.flatMap(segment => segment.coins).length, 3);
  }
});

test("월드 2~5 보스의 체력과 예고 시작 주기를 확정 수치로 유지한다", () => {
  assert.deepEqual(Object.values(BOSS_COMBAT_CONFIG).map(({ maxHealth, attackIntervalMs }) => [maxHealth, attackIntervalMs]), [
    [15, 3000], [20, 2600], [25, 2200], [40, 1500],
  ]);
});

test("무기 등급별 보스 피해량은 1·2·3이며 미확인 도구는 기본값 1이다", () => {
  for (const id of ["rabbit-slipper", "squeaky-ball", "unknown-tool"]) assert.equal(getBossDamage(id), 1);
  for (const id of ["rolled-newspaper", "pink-backscratcher", "cardboard-tube"]) assert.equal(getBossDamage(id), 2);
  for (const id of ["drumstick-boomerang", "plastic-frisbee"]) assert.equal(getBossDamage(id), 3);
});
