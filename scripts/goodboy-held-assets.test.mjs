import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ids = [
  "squeaky-ball", "rolled-newspaper", "pink-backscratcher", "drumstick-boomerang", "plastic-frisbee",
  "cushion-pad", "greasy-pizza-box", "umbrella", "yellow-pot-lid",
];

test("9종 무기·방패 장착 그림은 상점 상품과 같은 색의 64px 투명 이미지다", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "src/game/assets/assetManifest.json"), "utf8"));
  for (const id of ids) {
    const entry = manifest.find((asset) => asset.key === `held-${id}`);
    assert.deepEqual(entry, {
      key: `held-${id}`, kind: "image", url: `/assets/pixel/characters/corgi/equipment/${id}-held.png`, required: true,
    });
    const bytes = await readFile(path.join(root, "public", entry.url.slice(1)));
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 64);
    assert.equal(info.height, 64);
    assert.equal(data[3], 0, `${id}: upper-left background should be transparent`);
    assert.ok(data.some((value, index) => index % 4 === 3 && value === 255), `${id}: expected visible pixels`);
  }
});
