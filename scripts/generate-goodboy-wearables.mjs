import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "public/assets/pixel/characters/corgi/equipment");
const outline = "#37162e";
const suitBody = "M19 61 29 55 53 54 70 58 77 69 73 82 60 86 28 85 19 77Z";
const edge = (fill) => `<path d="${suitBody}" fill="${fill}"/>`;

const outfitArt = {
  "pink-caterpillar-suit": () => `${edge("#ee8eae")}
    <path d="M34 56q-6 9 0 27M50 55q-6 12 0 29M64 57q-5 11 0 26" fill="none" stroke="#a44871" stroke-width="2"/>
    <circle cx="27" cy="66" r="2" fill="#f8bfd0"/><circle cx="44" cy="74" r="2" fill="#f8bfd0"/><circle cx="62" cy="65" r="2" fill="#f8bfd0"/>`,
  "banana-peel-suit": () => `${edge("#f4d460")}
    <path d="M20 59 25 53 30 64 31 83 23 78ZM52 54 58 57 61 84 51 85ZM70 59 75 62 72 82 65 84Z" fill="#ffe78c"/>
    <path d="M30 61q6 11 4 22m26-23q-3 12 0 23" fill="none" stroke="#bd8643" stroke-width="2"/>`,
  "bee-bodysuit": () => `<path d="M34 57q-9-17 1-18l12 15ZM51 55q4-18 13-15l-2 21Z" fill="#e4f7ee"/>${edge("#f6ca5e")}
    <path d="M30 57q-3 13 0 27M46 55q-2 14 1 29M63 56q-3 14 0 27" fill="none" stroke="${outline}" stroke-width="6"/>`,
  "hotdog-outfit": () => `<path d="M18 65q10-12 28-12 18 0 30 12l-3 7-50 1Z" fill="#e9b36d"/>
    <path d="M21 67q22-9 51 0l-1 11-45 4Z" fill="#a94e43"/>
    <path d="M20 75q20 11 54-2l-3 10q-31 12-50-1Z" fill="#e9b36d"/>
    <path d="M31 68q9 8 17 0 9 8 17 0" fill="none" stroke="#f5d368" stroke-width="3"/>`,
  "diamond-armor": () => `${edge("#70c7e6")}
    <path d="M28 57 49 55 68 60 62 77 39 82 24 75Z" fill="#b8eef0"/>
    <path d="M49 55 39 82M49 55 62 77M24 75l15 7" fill="none" stroke="#4a8dab" stroke-width="2"/>
    <path d="M30 60 23 69l5 11m37-20 8 9-5 12" fill="none" stroke="#e7faf1" stroke-width="2"/>`,
};

const accessoryArt = {
  "shinchan-eyebrow-sticker": () => `<path d="M76 42q5-4 10-1v4q-5-2-10 2ZM88 40q4-2 8 1v3q-4-1-8 2Z" fill="${outline}" stroke="none"/>`,
  "birthday-party-hat": () => `<path d="M72 31 84 4 96 31Z" fill="#ea8eae"/><path d="M77 20 91 23m-10-11 8 3" stroke="#f6d968" fill="none" stroke-width="3"/>
    <circle cx="84" cy="5" r="3" fill="#79d0e9"/><path d="M70 31h27" stroke="${outline}" stroke-width="2"/>`,
  "strawberry-headpiece": () => `<path d="M68 55 66 38q-1-17 13-19h10q12 5 11 20l-2 18-5-3V38q-9-9-21 2v14Z" fill="#e95f68"/>
    <path d="M70 25 76 18l7 3 7-4 8 8-9 2-6-4-6 5Z" fill="#82b956"/>
    <path d="m69 44 2 2m24-4 2 2m-17-20 1 2m10 2 1 2" stroke="#fff1b5" stroke-width="1"/>`,
  "propeller-hat": () => `<path d="M69 29q2-13 15-13t15 13l-4 4H73Z" fill="#7ccce4"/>
    <path d="M71 29h26" stroke="#f1de92" stroke-width="3"/><path d="M84 16v-6" stroke="${outline}"/>
    <path d="M68 9 79 6l5 3 5-3 11 3-10 4-6-2-6 2Z" fill="#f5c86c"/><circle cx="84" cy="9" r="2" fill="#e96e62"/>`,
  "prince-crown": () => `<path d="M70 30 69 12 75 18 82 8 89 18 97 12 95 30Z" fill="#f4be5e"/>
    <path d="M71 25h24v5H71Z" fill="#ffe693"/><circle cx="83" cy="25" r="2" fill="#ed7188"/>`,
};

const ids = [...Object.keys(outfitArt), ...Object.keys(accessoryArt)];
const offsets = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 5 }];

function frameSvg(id, frameIndex, pose) {
  const art = outfitArt[id] ?? accessoryArt[id];
  assert.ok(art, `unknown wearable: ${id}`);
  const offset = pose === "bark" ? { x: 0, y: 0 } : offsets[frameIndex];
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="112" height="128" viewBox="0 0 112 128" shape-rendering="crispEdges">
    <g transform="translate(${offset.x} ${offset.y})" stroke="${outline}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${art()}</g>
  </svg>`);
}

async function saveOrCheck(file, bytes) {
  if (process.argv.includes("--check")) {
    assert.deepEqual(await readFile(file), bytes, `${file} differs from generated wearable`);
  } else {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  }
}

for (const id of ids) {
  const frames = await Promise.all([0, 1, 2, 3].map((index) => sharp(frameSvg(id, index, "run")).png().toBuffer()));
  const run = await sharp({ create: { width: 448, height: 128, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(frames.map((input, index) => ({ input, left: index * 112, top: 0 }))).png().toBuffer();
  const bark = await sharp(frameSvg(id, 0, "bark")).png().toBuffer();
  await saveOrCheck(path.join(outputDir, `${id}-run.png`), run);
  await saveOrCheck(path.join(outputDir, `${id}-bark.png`), bark);
}

console.log(`Corgi wearables ${process.argv.includes("--check") ? "verified" : "generated"}: ${ids.length} run/bark pairs`);
