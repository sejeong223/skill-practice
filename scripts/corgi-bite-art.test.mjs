import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const biteUrl = new URL("../public/assets/pixel/characters/corgi/corgi-bite.png", import.meta.url);
const runUrl = new URL("../public/assets/pixel/characters/corgi/corgi-run.png", import.meta.url);
const manifestUrl = new URL("../src/game/assets/assetManifest.json", import.meta.url);
const footLines = [99, 99, 100, 104];
const eyes = [[87, 40], [86, 40], [87, 41], [87, 41]];

test("물기 이미지는 기존 코기 몸과 발을 유지하는 전신 4프레임 필수 에셋이다", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  const entry = manifest.find((asset) => asset.key === "corgi-bite");
  assert.deepEqual({ kind: entry.kind, frameWidth: entry.frameWidth,
    frameHeight: entry.frameHeight, frameCount: entry.frameCount, required: entry.required },
  { kind: "spritesheet", frameWidth: 112, frameHeight: 128, frameCount: 4, required: true });
  const bite = await sharp(fileURLToPath(biteUrl)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const run = await sharp(fileURLToPath(runUrl)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([bite.info.width, bite.info.height, bite.info.channels], [448, 128, 4]);
  assert.deepEqual([run.info.width, run.info.height, run.info.channels], [448, 128, 4]);

  const headChecksums = [];
  for (let frame = 0; frame < 4; frame++) {
    let opaque = 0;
    let tail = false;
    let muzzle = false;
    let paws = false;
    let bottom = -1;
    let headChecksum = 0;
    for (let y = 0; y < 128; y++) for (let localX = 0; localX < 112; localX++) {
      const offset = (y * 448 + frame * 112 + localX) * 4;
      const pixel = bite.data.subarray(offset, offset + 4);
      if (localX < 40 || y >= 85) {
        assert.deepEqual(pixel, run.data.subarray(offset, offset + 4),
          `프레임 ${frame}: 몸·발·꼬리는 기존 run 픽셀을 유지해야 한다`);
      }
      if (localX >= 40 && y < 85) {
        for (const channel of pixel) headChecksum = (headChecksum * 31 + channel) >>> 0;
      }
      if (pixel[3] >= 128) {
        opaque++;
        bottom = y;
        if (localX <= 25) tail = true;
        if (localX >= 90) muzzle = true;
        if (y >= 95) paws = true;
      }
    }
    assert.ok(opaque >= 3000, `프레임 ${frame}에 전신이 있어야 한다`);
    assert.ok(tail && muzzle && paws, `프레임 ${frame}에 꼬리·주둥이·발이 있어야 한다`);
    assert.equal(bottom, footLines[frame], `프레임 ${frame}의 발 기준선`);
    const [eyeX, eyeY] = eyes[frame];
    const eyeOffset = (eyeY * 448 + frame * 112 + eyeX) * 4;
    assert.ok(bite.data[eyeOffset] < 100 && bite.data[eyeOffset + 1] < 100 &&
      bite.data[eyeOffset + 2] < 100 && bite.data[eyeOffset + 3] >= 128,
    `프레임 ${frame}의 눈에는 흰 안광이 없어야 한다`);
    headChecksums.push(headChecksum);
  }
  assert.equal(new Set(headChecksums).size, 4, "네 물기 표정은 서로 달라야 한다");
  for (const [x, y] of [[0, 0], [111, 127], [336, 0], [447, 127]]) {
    assert.equal(bite.data[(y * 448 + x) * 4 + 3], 0);
  }
});
