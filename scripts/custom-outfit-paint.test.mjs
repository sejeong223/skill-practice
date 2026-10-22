import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { CUSTOM_OUTFIT_CELL_COUNT, CUSTOM_OUTFIT_WIDTH, paintCell, eraseCell, fillRegion, undoChange } =
  require("../src/game/data/customOutfitPaint.ts");

test("펜과 지우개는 흰 옷 마스크 내부만 바꾼다", () => {
  const mask = Array(CUSTOM_OUTFIT_CELL_COUNT).fill(false);
  mask[100] = true;
  const blank = Array(CUSTOM_OUTFIT_CELL_COUNT).fill(null);
  assert.equal(paintCell(blank, 99, "#123456", mask), blank);
  assert.equal(paintCell(blank, 100, "blue", mask), blank);
  const painted = paintCell(blank, 100, "#123456", mask);
  assert.equal(painted[100], "#123456");
  assert.equal(blank[100], null);
  assert.equal(eraseCell(painted, 99, mask), painted);
  assert.equal(eraseCell(painted, 100, mask)[100], null);
});

test("채우기는 같은 색의 상하좌우 영역만 칠하고 마스크와 행 경계를 넘지 않는다", () => {
  const mask = Array(CUSTOM_OUTFIT_CELL_COUNT).fill(false);
  for (const index of [54, 55, 56, 57, 58, 112]) mask[index] = true;
  const blank = Array(CUSTOM_OUTFIT_CELL_COUNT).fill(null);
  blank[57] = "#111111";
  const filled = fillRegion(blank, 55, "#AA0000", mask);
  assert.equal(filled[54], "#AA0000");
  assert.equal(filled[55], "#AA0000");
  assert.equal(filled[56], null, "previous row edge must not wrap to next row");
  assert.equal(filled[57], "#111111");
  assert.equal(filled[58], null);
  assert.equal(filled[112], null);
  assert.equal(CUSTOM_OUTFIT_WIDTH, 56);
});

test("되돌리기는 마지막 작업의 전체 셀 배열을 복원하고 빈 기록에서는 그대로 둔다", () => {
  const blank = Array(CUSTOM_OUTFIT_CELL_COUNT).fill(null);
  const first = [...blank]; first[100] = "#123456";
  const second = [...first]; second[101] = "#ABCDEF";
  const undone = undoChange({ cells: second, undo: [blank, first] });
  assert.deepEqual(undone.cells, first);
  assert.equal(undone.undo.length, 1);
  assert.equal(undoChange({ cells: blank, undo: [] }).cells, blank);
});
