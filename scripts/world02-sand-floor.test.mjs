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
const stage = (id) => STAGE_DEFINITIONS.find((definition) => definition.id === id);

test("월드 2 맵 1~3은 출구까지 이어진 모래 바닥 하나와 기존 수집물을 가진다", () => {
  for (const number of [1, 2, 3]) {
    const current = stage(`world-02-stage-${number}`);
    assert.equal(current.mapWidth, 3840);
    const platforms = current.segments.flatMap((segment) => segment.platforms);
    assert.deepEqual(platforms, [{
      id: `world-02-stage-${number}-segment-1-platform`,
      x: 1920, y: 520, width: 3840, height: 32,
    }]);
    assert.equal(platforms[0].x - platforms[0].width / 2, 0);
    assert.equal(platforms[0].x + platforms[0].width / 2, current.mapWidth);
    assert.equal(platforms[0].y - platforms[0].height / 2, 504);
    assert.ok(current.segments.slice(1).every((segment) => segment.platforms.length === 0));
    assert.ok(current.segments.every((segment) => segment.traps.length === 0 && segment.enemies.length === 0));
    assert.ok(current.segments.every((segment) => segment.coins.length === 3));
    assert.equal(current.checkpointIds.length, 1);
  }
});

test("다른 스테이지의 기존 발판과 이름은 그대로다", () => {
  const second = stage("world-02-stage-2");
  assert.equal(second.title, "미끄럼틀 낙하 구역");
  assert.equal(second.segments.length, 5);
  assert.equal(second.segments.flatMap((segment) => segment.platforms).length, 1);
  assert.ok(stage("world-02-stage-4").segments.every((segment) => segment.platforms.length === 1));
  assert.equal(stage("world-01-stage-1").title, "무법지대 뒷골목");
});
