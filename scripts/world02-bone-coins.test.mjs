import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);

const { segmentCoinPresentation } = require("../src/game/stages/segmentCoinPresentation.ts");
const { SNACK_PRESENTATION } = require("../src/game/data/snackPresentation.ts");
const { STAGE_DEFINITIONS } = require("../src/game/data/worlds.ts");

test("월드 2 fallback 코인은 기존 뼈다귀 프레임과 모래바닥 높이를 사용한다", () => {
  assert.deepEqual(segmentCoinPresentation("world-02"), { appearance: "bone", y: 464 });
  assert.deepEqual(SNACK_PRESENTATION, {
    textureKey: "world-01-props", frameKey: "bone-coin", width: 34, height: 26, topOffsetFromFloor: 40,
  });
  for (const stage of STAGE_DEFINITIONS.filter(candidate => candidate.worldId === "world-02")) {
    assert.ok(stage.segments.flatMap(segment => segment.coins).length > 0, stage.id);
    assert.equal(segmentCoinPresentation(stage.worldId).appearance, "bone");
  }
});

test("다른 월드의 fallback 코인 표현은 유지한다", () => {
  assert.deepEqual(segmentCoinPresentation("world-01"), { y: 450 });
  assert.deepEqual(segmentCoinPresentation("world-03"), { y: 450 });
});
