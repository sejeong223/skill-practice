import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const corgiDir = path.join(root, "public/assets/pixel/characters/corgi");
const equipmentDir = path.join(corgiDir, "equipment");
const previewDir = path.join(root, ".memory/test-plans/assets");
const ids = [
  "pink-caterpillar-suit", "banana-peel-suit", "bee-bodysuit", "hotdog-outfit", "diamond-armor",
  "shinchan-eyebrow-sticker", "birthday-party-hat", "strawberry-headpiece", "propeller-hat", "prince-crown",
];
const runFrame = await sharp(path.join(corgiDir, "corgi-run.png"))
  .extract({ left: 0, top: 0, width: 112, height: 128 }).png().toBuffer();
const cells = await Promise.all(ids.map(async (id) => {
  const overlay = await sharp(path.join(equipmentDir, `${id}-run.png`))
    .extract({ left: 0, top: 0, width: 112, height: 128 }).png().toBuffer();
  return sharp({ create: { width: 112, height: 128, channels: 4, background: "#f5e9cf" } })
    .composite([{ input: runFrame, left: 0, top: 0 }, { input: overlay, left: 0, top: 0 }])
    .png().toBuffer();
}));
const sheet = await sharp({ create: { width: 560, height: 256, channels: 4, background: "#f5e9cf" } })
  .composite(cells.map((input, index) => ({ input, left: index % 5 * 112, top: Math.floor(index / 5) * 128 })))
  .png().toBuffer();
await writeFile(path.join(previewDir, "2026-10-20-goodboy-wearables-run.png"), sheet);

const bark = await readFile(path.join(corgiDir, "corgi-bark.png"));
const beeBark = await readFile(path.join(equipmentDir, "bee-bodysuit-bark.png"));
const crownBark = await readFile(path.join(equipmentDir, "prince-crown-bark.png"));
const barkPreview = await sharp({ create: { width: 112, height: 128, channels: 4, background: "#f5e9cf" } })
  .composite([{ input: bark, left: 0, top: 0 }, { input: beeBark, left: 0, top: 0 }, { input: crownBark, left: 0, top: 0 }])
  .png().toBuffer();
await writeFile(path.join(previewDir, "2026-10-20-goodboy-wearables-bark.png"), barkPreview);
console.log("Corgi wearable previews created");
