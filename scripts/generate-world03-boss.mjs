import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "art/source/world03-mackerel-boss-poses.png");
const output = path.join(root, "public/assets/pixel/characters/world-03/mackerel-boss.png");
const brick = path.join(root, "public/assets/pixel/objects/world-03/mackerel-brick.png");
const image = await readFile(source);
const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

assert.deepEqual([info.width, info.height, info.channels], [896, 112, 4]);
assert.equal(data[3], 0, "spritesheet corners must be transparent");
for (let frame = 0; frame < 8; frame++) {
  let pixels = 0;
  let ground = false;
  for (let y = 0; y < 112; y++) {
    for (let x = frame * 112; x < (frame + 1) * 112; x++) {
      if (data[(y * 896 + x) * 4 + 3] < 128) continue;
      pixels++;
      if (y >= 103 && y <= 107) ground = true;
    }
  }
  assert.ok(pixels > 500, `empty full-body frame ${frame}`);
  assert.ok(ground, `frame ${frame} is not floor-aligned`);
}
assert.deepEqual(await sharp(brick).metadata().then(({ width, height }) => [width, height]), [32, 32]);

if (process.argv.includes("--check")) {
  assert.deepEqual(await readFile(output), image, "sprite output differs from approved source");
} else {
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, image);
}
