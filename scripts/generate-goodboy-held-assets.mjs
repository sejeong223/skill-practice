import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ids = [
  "squeaky-ball", "rolled-newspaper", "pink-backscratcher", "drumstick-boomerang", "plastic-frisbee",
  "cushion-pad", "greasy-pizza-box", "umbrella", "yellow-pot-lid",
];

for (const id of ids) {
  const source = path.join(root, "public/assets/pixel/shop/items", `${id}.png`);
  const target = path.join(root, "public/assets/pixel/characters/corgi/equipment", `${id}-held.png`);
  const bytes = await readFile(source);
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 64);
  assert.equal(metadata.height, 64);
  if (process.argv.includes("--check")) assert.deepEqual(await readFile(target), bytes);
  else {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
}
console.log(`Held item sprites ${process.argv.includes("--check") ? "verified" : "generated"}: ${ids.length}`);
