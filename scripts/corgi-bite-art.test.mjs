import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const imageUrl = new URL("../public/assets/pixel/characters/corgi/corgi-bite.png", import.meta.url);
const manifestUrl = new URL("../src/game/assets/assetManifest.json", import.meta.url);

test("물기 이미지는 코기와 같은 112×128 네 프레임 투명 오버레이이며 필수 에셋이다", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  const entry = manifest.find((asset) => asset.key === "corgi-bite");
  assert.deepEqual({ kind: entry.kind, frameWidth: entry.frameWidth,
    frameHeight: entry.frameHeight, frameCount: entry.frameCount, required: entry.required },
  { kind: "spritesheet", frameWidth: 112, frameHeight: 128, frameCount: 4, required: true });
  const { data, info } = await sharp(fileURLToPath(imageUrl)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 448);
  assert.equal(info.height, 128);
  assert.equal(info.channels, 4);
  const alpha = (x, y) => data[(y * info.width + x) * 4 + 3];
  const framePixels = [];
  for (let frame = 0; frame < 4; frame++) {
    let opaque = 0;
    let checksum = 0;
    for (let y = 0; y < 128; y++) for (let x = frame * 112; x < (frame + 1) * 112; x++) {
      checksum = (checksum * 31 + alpha(x, y)) >>> 0;
      if (alpha(x, y) > 0) {
        opaque++;
        assert.ok(y < 85, "몸통·발·장비 영역은 투명해야 한다");
        assert.ok(x >= frame * 112 + 40, "얼굴 오버레이만 있어야 한다");
      }
    }
    assert.ok(opaque > 100, `프레임 ${frame}의 얼굴이 보여야 한다`);
    framePixels.push(checksum);
  }
  assert.equal(new Set(framePixels).size, 4);
  assert.equal(alpha(0, 0), 0);
  assert.equal(alpha(111, 127), 0);
});
