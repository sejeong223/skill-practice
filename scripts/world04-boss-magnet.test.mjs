import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  advanceTuxedoScrap, chooseTuxedoDrag, clampTuxedoTarget,
  SCRAP_DRAG_MS, SCRAP_DRAG_WARNING_MS, SCRAP_FALL_MS,
  sweptTuxedoScrapBounds,
} from "../src/game/systems/tuxedoMagnetPhysics.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("턱시도·고철·고물상 배경은 필수 픽셀 에셋이다", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "src/game/assets/assetManifest.json"), "utf8"));
  for (const [key, size, frames] of [
    ["world-04-tuxedo-boss", [512, 128], 4],
    ["world-04-boss-magnet-scrap", [40, 40], 1],
    ["world-04-boss-scrapyard", [800, 280], 1],
  ]) {
    const entry = manifest.find(asset => asset.key === key);
    assert.equal(entry?.required, true, key);
    if (frames === 4) assert.deepEqual([entry.frameWidth, entry.frameHeight, entry.frameCount], [128, 128, 4]);
    const image = await sharp(path.join(root, "public", entry.url)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([image.info.width, image.info.height], size);
    if (key !== "world-04-boss-scrapyard") assert.equal(image.data[3], 0);
  }
});

test("고철은 700ms 낙하, 250ms 자석 신호, 450ms 한 번 이동 후 사라진다", () => {
  const targetX = clampTuxedoTarget(720);
  const dragToX = chooseTuxedoDrag(targetX, 1);
  let motion = { x: targetX, y: 140, targetX, dragToX, phase: "falling", phaseMs: 0 };
  assert.notEqual(dragToX, targetX);
  assert.deepEqual(advanceTuxedoScrap(motion, 0), motion);
  for (let elapsed = 0; elapsed < SCRAP_FALL_MS; elapsed += 50) motion = advanceTuxedoScrap(motion, 50);
  assert.equal(motion.phase, "drag-warning");
  assert.equal(motion.y, 488);
  for (let elapsed = 0; elapsed < SCRAP_DRAG_WARNING_MS; elapsed += 50) motion = advanceTuxedoScrap(motion, 50);
  assert.equal(motion.phase, "dragging");
  const firstDrag = advanceTuxedoScrap(motion, 50);
  const bounds = sweptTuxedoScrapBounds(motion, firstDrag);
  assert.ok(bounds.width >= 24 && bounds.height >= 30);
  motion = firstDrag;
  for (let elapsed = 50; elapsed < SCRAP_DRAG_MS; elapsed += 50) motion = advanceTuxedoScrap(motion, 50);
  assert.equal(motion.phase, "done");
  assert.equal(motion.x, dragToX);
  assert.equal(advanceTuxedoScrap(motion, 50), motion);
});

test("코기 시작점과 보스 주변을 제외하고, 자석 방향은 경계에서 뒤집는다", () => {
  assert.equal(clampTuxedoTarget(10), 160);
  assert.equal(clampTuxedoTarget(1280), 1120);
  assert.equal(chooseTuxedoDrag(160, 2), 270);
  assert.equal(chooseTuxedoDrag(1120, 1), 1010);
});
