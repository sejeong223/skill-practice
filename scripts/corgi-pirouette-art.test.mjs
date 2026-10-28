import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const frameWidth = 112, frameHeight = 128, frames = 8, sheetWidth = frameWidth * frames;
const pathFor = (name) => fileURLToPath(new URL(`public/assets/pixel/characters/corgi/${name}`, root));
const raw = async (name) => sharp(pathFor(name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const pixel = (data, width, x, y) => data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4);

test("피루엣 원본·반전 시트는 필수 112×128 전신 8프레임이다", async () => {
  const manifest = JSON.parse(await readFile(new URL("src/game/assets/assetManifest.json", root), "utf8"));
  for (const key of ["corgi-pirouette", "corgi-pirouette-mirror"]) {
    const entry = manifest.find((asset) => asset.key === key);
    assert.deepEqual(entry, { key, kind: "spritesheet",
      url: `/assets/pixel/characters/corgi/${key}.png`,
      frameWidth, frameHeight, frameCount: frames, required: true });
    const { data, info } = await raw(`${key}.png`);
    assert.deepEqual([info.width, info.height, info.channels], [sheetWidth, frameHeight, 4]);
    for (let frame = 0; frame < frames; frame++) {
      let opaque = 0, top = frameHeight, bottom = -1, left = frameWidth, right = -1;
      for (let y = 0; y < frameHeight; y++) for (let x = 0; x < frameWidth; x++) {
        if (pixel(data, sheetWidth, frame * frameWidth + x, y)[3] < 128) continue;
        opaque++;
        top = Math.min(top, y); bottom = Math.max(bottom, y);
        left = Math.min(left, x); right = Math.max(right, x);
      }
      assert.ok(opaque > 1200, `${key}/${frame}: whole body must be visible`);
      assert.ok(top < 15 && left > 0 && right < 111, `${key}/${frame}: unclipped ears and paws`);
      assert.equal(bottom, 99, `${key}/${frame}: supporting paw meets foot anchor`);
    }
  }
  assert.equal(manifest.some((asset) => ["corgi-jump", "corgi-double-jump"].includes(asset.key)), false);
});

test("8개 방향은 각각 다른 몸통 실루엣이고 달리기 몸통을 복사하지 않았다", async () => {
  const { data } = await raw("corgi-pirouette.png");
  const run = await raw("corgi-run.png");
  const silhouettes = new Set();
  for (let frame = 0; frame < frames; frame++) {
    let hash = 2166136261, copied = 0, considered = 0;
    for (let y = 25; y <= 90; y++) for (let x = 20; x <= 91; x++) {
      const p = pixel(data, sheetWidth, frame * frameWidth + x, y);
      hash ^= p[3] >= 128 ? 1 : 0;
      hash = Math.imul(hash, 16777619) >>> 0;
      if (frame === 0 && p[3] >= 128) {
        considered++;
        const old = pixel(run.data, run.info.width, x, y);
        if (p.every((channel, index) => channel === old[index])) copied++;
      }
    }
    silhouettes.add(hash);
    if (frame === 0) assert.ok(copied / considered < 0.15, "upright body cannot be a pasted run torso");
  }
  assert.equal(silhouettes.size, frames, "each of eight rotation angles needs its own body silhouette");
});

test("mirror 시트는 각 프레임 안에서만 좌우 반전하고 프레임 순서를 유지한다", async () => {
  const original = (await raw("corgi-pirouette.png")).data;
  const mirrored = (await raw("corgi-pirouette-mirror.png")).data;
  for (let frame = 0; frame < frames; frame++) for (let y = 0; y < frameHeight; y++) {
    for (let x = 0; x < frameWidth; x++) {
      assert.deepEqual(pixel(mirrored, sheetWidth, frame * frameWidth + x, y),
        pixel(original, sheetWidth, frame * frameWidth + frameWidth - 1 - x, y));
    }
  }
});
