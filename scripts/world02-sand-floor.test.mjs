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

test("월드 2 첫 스테이지는 밝은 모래 바닥 하나가 출구까지 끊김 없이 이어진다", () => {
  const first = stage("world-02-stage-1");
  assert.equal(first.title, "지옥의 동네 놀이터");
  assert.equal(first.mapWidth, 3840);
  const platforms = first.segments.flatMap((segment) => segment.platforms);
  assert.equal(platforms.length, 1);
  assert.deepEqual(platforms[0], {
    id: "world-02-stage-1-segment-1-platform",
    x: 1920, y: 520, width: 3840, height: 32,
  });
  assert.equal(platforms[0].x - platforms[0].width / 2, 0);
  assert.equal(platforms[0].x + platforms[0].width / 2, first.mapWidth);
  assert.equal(platforms[0].y - platforms[0].height / 2, 504);
  assert.ok(first.segments.slice(1).every((segment) => segment.platforms.length === 0));
  assert.ok(first.segments.every((segment) => segment.traps.length === 0));
  assert.ok(first.segments.every((segment) => segment.enemies.length === 0));
});

test("다른 스테이지의 기존 발판과 이름은 그대로다", () => {
  const second = stage("world-02-stage-2");
  assert.equal(second.title, "미끄럼틀 낙하 구역");
  assert.equal(second.segments.length, 5);
  assert.ok(second.segments.every((segment) => segment.platforms.length === 1));
  assert.equal(second.segments[0].platforms[0].x, 16);
  assert.equal(stage("world-01-stage-1").title, "무법지대 뒷골목");
});
