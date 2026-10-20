import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);

const { WORLD01_GIMMICKS } = require("../src/game/data/world01Gimmicks.ts");
const {
  BOX_OPEN_DISPLAY,
  BOX_OPEN_TEXTURE_KEY,
  getOpenStaticBoxDangerRects,
  hasPassedStaticBox,
  isAtStaticBox,
} = require("../src/game/systems/world01BoxTrap.ts");

const boxes = WORLD01_GIMMICKS.filter((gimmick) => gimmick.kind === "box-static");

test("월드 1의 일곱 상자는 높이와 상관없이 지나는 가로 위치에서 열린다", () => {
  assert.equal(boxes.length, 7);
  assert.deepEqual(new Set(boxes.map((box) => box.stageId)),
    new Set(["world-01-stage-1", "world-01-stage-2", "world-01-stage-3", "world-01-stage-4"]));
  assert.equal(BOX_OPEN_TEXTURE_KEY, "world-01-prop-cat-box-open");
  assert.deepEqual(BOX_OPEN_DISPLAY, { width: 64, height: 56 });

  for (const box of boxes) {
    assert.equal(box.visualKey, "cat-box");
    assert.deepEqual([box.width, box.height], [44, 36]);
    assert.equal(isAtStaticBox({ left: box.x - 100, right: box.x - 13 }, box.x, box.width), false);
    assert.equal(isAtStaticBox({ left: box.x - 60, right: box.x - 12 }, box.x, box.width), true);
    assert.equal(hasPassedStaticBox({ left: box.x + 56, right: box.x + 128 }, box.x, box.width), false);
    assert.equal(hasPassedStaticBox({ left: box.x + 57, right: box.x + 129 }, box.x, box.width), true);
  }
});

test("기본 점프는 열린 상자 몸체와 좁은 손을 동시에 피할 수 있다", () => {
  const speed = 240;
  const jumpVelocity = -460;
  const gravity = 1200;
  const playerWidth = 48;
  const playerHeight = 40;
  const timeStep = 1 / 240;

  for (const box of boxes) {
    const floorY = box.y + box.height;
    const danger = getOpenStaticBoxDangerRects(box.x, floorY);
    assert.deepEqual(danger, [
      { x: box.x, y: floorY - 36, width: 44, height: 36 },
      { x: box.x + 14, y: floorY - 54, width: 16, height: 54 },
    ]);

    // Start jumping when the front of Corgi's body is 34px before the box.
    // Simulate a whole jump, including the descending edge after passing the paw.
    const initialRight = box.x - 34;
    for (let t = 0; t <= -2 * jumpVelocity / gravity; t += timeStep) {
      const right = initialRight + speed * t;
      const left = right - playerWidth;
      const bottom = floorY + jumpVelocity * t + gravity * t * t / 2;
      const top = bottom - playerHeight;
      const hit = danger.some((rect) =>
        left < rect.x + rect.width && right > rect.x &&
        top < rect.y + rect.height && bottom > rect.y);
      assert.equal(hit, false, `${box.id}: 정상 점프 중 t=${t.toFixed(3)}s에 충돌`);
    }

    const walkingBottom = floorY;
    const walkingLeft = box.x + 10;
    assert.ok(danger.some((rect) =>
      walkingLeft < rect.x + rect.width && walkingLeft + playerWidth > rect.x &&
      walkingBottom - playerHeight < rect.y + rect.height && walkingBottom > rect.y));
  }
});
