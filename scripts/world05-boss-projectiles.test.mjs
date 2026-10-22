import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { BOSS_COMBAT_CONFIG } from "../src/game/data/bossCombat.ts";
import {
  chooseFurballX, mouseKindForSalvo, safeMouseSpawnX, sampleMouseStep, sweptMouseBounds,
} from "../src/game/systems/maineCoonTrajectory.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("메인쿤·생쥐·털뭉치·캣타워 배경이 올바른 크기의 필수 에셋이다", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "src/game/assets/assetManifest.json"), "utf8"));
  for (const [key, size, frames] of [
    ["world-05-maine-coon-boss", [640, 160], 4],
    ["world-05-boss-mouse", [32, 24], 1],
    ["world-05-boss-furball", [28, 28], 1],
    ["world-05-boss-cat-tower", [800, 280], 1],
  ]) {
    const entry = manifest.find(asset => asset.key === key);
    assert.equal(entry?.required, true, key);
    if (frames === 4) assert.deepEqual([entry.frameWidth, entry.frameHeight, entry.frameCount], [160, 160, 4]);
    const image = await sharp(path.join(root, "public", entry.url)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([image.info.width, image.info.height], size);
    if (key !== "world-05-boss-cat-tower") assert.equal(image.data[3], 0);
  }
});

test("최종 보스의 생쥐는 1.5초마다 두 마리이고 세 종류가 연속 반복되지 않는다", () => {
  assert.equal(BOSS_COMBAT_CONFIG["world-05"].maxHealth, 40);
  assert.equal(BOSS_COMBAT_CONFIG["world-05"].attackIntervalMs, 1500);
  assert.equal(BOSS_COMBAT_CONFIG["world-05"].telegraphMs, 450);
  const sequence = Array.from({ length: 9 }, (_, index) =>
    mouseKindForSalvo(Math.floor(index / 2) + 1, index % 2, 1));
  assert.deepEqual(new Set(sequence), new Set(["curve", "straight", "fast"]));
  for (let index = 1; index < sequence.length; index++) assert.notEqual(sequence[index], sequence[index - 1]);
});

test("생쥐는 매 프레임 현재 코기 위치를 향해 회전하되 최고 속도와 회피 거리를 지킨다", () => {
  assert.equal(safeMouseSpawnX(1150, 1280, 1600), 1340);
  const initial = { kind: "straight", x: 1200, y: 400, vx: -300, vy: 0, ageMs: 0, turnSeed: 0 };
  const above = sampleMouseStep(initial, { x: 600, y: 200 }, 50);
  const below = sampleMouseStep(initial, { x: 600, y: 500 }, 50);
  assert.ok(above.vy < 0 && below.vy > 0);
  assert.ok(Math.hypot(above.vx, above.vy) <= 300.001);
  assert.ok(Math.abs(above.x - initial.x) <= 15.001);
  assert.deepEqual(sampleMouseStep(initial, { x: 600, y: 500 }, 0), initial);
  const swept = sweptMouseBounds(initial, below);
  assert.ok(swept.width >= 22 && swept.height >= 16);
  for (const [kind, speed] of [["curve", 260], ["straight", 300], ["fast", 420]]) {
    const next = sampleMouseStep({ ...initial, kind }, { x: 600, y: 500 }, 50);
    assert.ok(Math.abs(Math.hypot(next.vx, next.vy) - speed) < 0.001, kind);
  }
  let curved = { ...initial, kind: "curve", turnSeed: 1.8 };
  let straight = { ...initial, kind: "straight" };
  for (let i = 0; i < 12; i++) {
    curved = sampleMouseStep(curved, { x: 600, y: 480 }, 50);
    straight = sampleMouseStep(straight, { x: 600, y: 480 }, 50);
  }
  assert.ok(Math.abs(curved.y - straight.y) > 4, "curved mouse should visibly swerve");
});

test("털뭉치 낙하 지점은 캣타워 접근 공간과 생쥐 위치를 피한다", () => {
  assert.ok(chooseFurballX(1160, 1, []) <= 1080);
  const nearMouse = chooseFurballX(600, 1, [680]);
  assert.ok(Math.abs(nearMouse - 680) >= 95);
});
