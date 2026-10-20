import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const assetPath = new URL("../public/assets/pixel/props/world-01/cat-box-open.png", import.meta.url);
const manifestPath = new URL("../src/game/assets/assetManifest.json", import.meta.url);

test("열린 상자 그림은 투명 배경의 게임용 PNG이며 기존 함정 그림과 별도 로드된다", async () => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const entries = manifest.filter((asset) => asset.key === "world-01-prop-cat-box-open");
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0], {
    key: "world-01-prop-cat-box-open",
    kind: "image",
    url: "/assets/pixel/props/world-01/cat-box-open.png",
    worldId: "world-01",
    required: true,
  });
  assert.ok(manifest.some((asset) => asset.key === "world-01-prop-cat-box-triggered"));

  const image = sharp(fileURLToPath(assetPath));
  const metadata = await image.metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 128);
  assert.equal(metadata.height, 112);
  assert.equal(metadata.channels, 4);
  assert.equal(metadata.hasAlpha, true);

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x, y) => data[(y * info.width + x) * info.channels + 3];
  for (const [x, y] of [[0, 0], [127, 0], [0, 111], [127, 111]]) {
    assert.equal(alphaAt(x, y), 0, "캔버스 모서리는 투명해야 한다");
  }
  assert.ok(alphaAt(64, 30) > 0, "위쪽에 튀어나온 고양이 손이 있어야 한다");
  assert.ok(alphaAt(64, 95) > 0, "아래쪽에 상자가 있어야 한다");
});
