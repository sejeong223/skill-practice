import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "src/game/assets/assetManifest.json");
const ids = [
  "squeaky-ball", "rolled-newspaper", "pink-backscratcher", "drumstick-boomerang", "plastic-frisbee",
  "cushion-pad", "greasy-pizza-box", "umbrella", "yellow-pot-lid",
];
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
for (const id of ids) {
  const entry = { key: `held-${id}`, kind: "image", url: `/assets/pixel/characters/corgi/equipment/${id}-held.png`, required: true };
  const existing = manifest.find((asset) => asset.key === entry.key);
  if (process.argv.includes("--check")) assert.deepEqual(existing, entry);
  else if (!existing) manifest.push(entry);
}
if (!process.argv.includes("--check")) await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Held item manifest ${process.argv.includes("--check") ? "verified" : "synced"}: ${ids.length}`);
