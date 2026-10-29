import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("파도·덩어리·웅덩이는 서로 다른 투명 실루엣으로 보인다", async () => {
  const silhouettes = [];
  for (const [kind, width, height] of [["wave", 64, 24], ["lump", 48, 48], ["puddle", 96, 16]]) {
    const source = path.join(root, `art/source/world03-cement-${kind}.png`);
    const game = path.join(root, `public/assets/pixel/objects/world-03/cement-${kind}.png`);
    assert.deepEqual(await readFile(game), await readFile(source));
    const { data, info } = await sharp(game).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height], [width, height]);
    assert.equal(data[3], 0);
    let visible = 0;
    let left = width, right = 0, top = height, bottom = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 128) continue;
      visible++;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    assert.ok(visible > width * height * 0.2, `${kind} lacks visible pixels`);
    silhouettes.push({ kind, width: right - left + 1, height: bottom - top + 1 });
  }
  const [wave, lump, puddle] = silhouettes;
  assert.ok(wave.width > wave.height * 2, "wave must travel low along the ground");
  assert.ok(lump.height > lump.width * 0.7, "lump must read as a tall airborne shape");
  assert.ok(puddle.width > puddle.height * 5, "puddle must read as a flat residue");
  assert.ok(puddle.width > wave.width && wave.width > lump.width);
});
