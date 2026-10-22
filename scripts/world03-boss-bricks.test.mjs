import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  advanceMackerelBrick, clampMackerelLanding, clearPlayerFromBrick,
  sweptMackerelBrickBounds,
} from "../src/game/systems/mackerelBrickPhysics.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("고등어 보스와 벽돌은 투명한 픽셀 에셋으로 등록된다", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "src/game/assets/assetManifest.json"), "utf8"));
  for (const [key, width, height, frameCount] of [
    ["world-03-mackerel-boss", 512, 128, 4],
    ["world-03-boss-brick", 32, 32, 1],
  ]) {
    const entry = manifest.find(asset => asset.key === key);
    assert.equal(entry?.required, true, key);
    if (frameCount === 4) assert.deepEqual([entry.frameWidth, entry.frameHeight, entry.frameCount], [128, 128, 4]);
    const { data, info } = await sharp(path.join(root, "public", entry.url)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height], [width, height]);
    assert.equal(data[3], 0, `${key} must have transparent background`);
    assert.ok(data.some((value, index) => index % 4 === 3 && value === 255), `${key} needs visible artwork`);
  }
});

test("벽돌은 예고한 착지 위치로 날아와 한 번만 착지한다", () => {
  const state = { x: 1232, y: 398, startX: 1232, startY: 398,
    targetX: 800, elapsedMs: 0, durationMs: 1300 };
  const halfway = advanceMackerelBrick(state, 50);
  assert.equal(halfway.landed, false);
  assert.ok(halfway.motion.y < 492);
  const hitbox = sweptMackerelBrickBounds(state, halfway.motion);
  assert.ok(hitbox.width >= 28 && hitbox.height >= 24);
  let motion = state;
  let landings = 0;
  for (let i = 0; i < 40; i++) {
    const next = advanceMackerelBrick(motion, 50);
    if (next.landed && motion.elapsedMs < motion.durationMs) landings++;
    motion = next.motion;
  }
  assert.equal(motion.x, 800);
  assert.equal(motion.y, 492);
  assert.equal(motion.elapsedMs, motion.durationMs);
  assert.equal(landings, 1);
});

test("착지 위치는 시작점과 보스 주변을 비우고, 코기와 겹치면 옆으로 옮긴다", () => {
  assert.equal(clampMackerelLanding(30, 1280, 1600), 120);
  assert.equal(clampMackerelLanding(1270, 1280, 1600), 1120);
  assert.equal(clearPlayerFromBrick(800, 802, 1280, 1600), 884);
  assert.equal(clearPlayerFromBrick(800, 600, 1280, 1600), 800);
});
