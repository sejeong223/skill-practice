import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const images = [
  ["wave", 64, 24],
  ["lump", 48, 48],
  ["puddle", 96, 16],
];

for (const [kind, width, height] of images) {
  const source = path.join(root, `art/source/world03-cement-${kind}.png`);
  const output = path.join(root, `public/assets/pixel/objects/world-03/cement-${kind}.png`);
  const bytes = await readFile(source);
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height, info.channels], [width, height, 4], `${kind}: wrong size`);
  assert.equal(data[3], 0, `${kind}: background must be transparent`);
  const alpha = data.filter((_, index) => index % 4 === 3);
  assert.ok(alpha.some(value => value === 255), `${kind}: missing artwork`);
  assert.ok(alpha.some(value => value === 0), `${kind}: missing transparency`);
  if (process.argv.includes("--check")) {
    assert.deepEqual(await readFile(output), bytes, `${kind}: output differs from source`);
  } else {
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, bytes);
  }
}
