import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "src/game/assets/assetManifest.json");
const ids = [
  "pink-caterpillar-suit", "banana-peel-suit", "bee-bodysuit", "hotdog-outfit", "diamond-armor",
  "shinchan-eyebrow-sticker", "birthday-party-hat", "strawberry-headpiece", "propeller-hat", "prince-crown",
];
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const requested = ids.flatMap((id) => [
  { key: `wear-${id}-run`, kind: "spritesheet", url: `/assets/pixel/characters/corgi/equipment/${id}-run.png`,
    frameWidth: 112, frameHeight: 128, frameCount: 4, required: true },
  { key: `wear-${id}-bark`, kind: "image", url: `/assets/pixel/characters/corgi/equipment/${id}-bark.png`, required: true },
]);

if (process.argv.includes("--check")) {
  for (const asset of requested) {
    assert.deepEqual(manifest.find((candidate) => candidate.key === asset.key), asset, asset.key);
  }
  console.log("Corgi wearable manifest verified: 20 assets");
} else {
  const existing = new Set(manifest.map((asset) => asset.key));
  for (const asset of requested) if (!existing.has(asset.key)) manifest.push(asset);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log("Corgi wearable manifest synced: 20 assets");
}
