import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "public/assets/pixel/characters/corgi/equipment");
const outline = "#37162e";
const outfitSources = {
  "pink-caterpillar-suit": "caterpillar",
  "banana-peel-suit": "banana",
  "bee-bodysuit": "bee",
  "hotdog-outfit": "hotdog",
  "diamond-armor": "diamond",
  "custom-outfit-template": "custom-white",
};
const footAnchors = [99, 99, 100, 104, 99];

function onHead(frameIndex, pose, art) {
  const shift = pose === "bark" ? { x: -2, y: 0 } : [
    { x: 0, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: -1, y: 10 },
  ][frameIndex];
  assert.ok(shift, `unknown accessory frame: ${frameIndex}/${pose}`);
  return `<g transform="translate(${shift.x} ${shift.y})">${art}</g>`;
}

const accessoryArt = {
  "shinchan-eyebrow-sticker": (frame, pose) => onHead(frame, pose, `
    <path d="M76 42 82 40 87 42 87 46 83 44 77 47Z" fill="${outline}" stroke="none"/>
    <path d="M88 40 93 42 96 45 95 48 90 45Z" fill="${outline}" stroke="none"/>`),
  "birthday-party-hat": (frame, pose) => onHead(frame, pose, `
    <path d="M58 42 61 30 69 19 79 8 84 4 88 16 91 28 93 43 87 47 64 47Z" fill="#ea8eae"/>
    <path d="M64 39 68 30 73 27 79 16 84 11 87 22 86 37 90 42 85 44 65 44Z" fill="#f6b1c9" stroke="none"/>
    <path d="M61 42 69 40 79 43 91 42 92 46 85 48 65 47Z" fill="#bd6288"/>
    <path d="M72 26 78 28M77 18 83 20M67 35 73 37" fill="none" stroke="#f6d968" stroke-width="2"/>
    <circle cx="84" cy="5" r="3" fill="#79d0e9"/>`),
  "strawberry-headpiece": (frame, pose) => onHead(frame, pose, `
    <path d="M58 46 60 31 67 22 75 19 84 23 91 30 92 44 87 47 86 36 79 32 72 36 69 46 64 54 59 52Z" fill="#e95f68"/>
    <path d="M65 23 70 17 76 20 81 15 88 20 92 25 83 25 77 23 72 27Z" fill="#82b956"/>
    <path d="m64 36 2 2m17-11 2 2m-10-6 1 2m-11 22 2 2" stroke="#fff1b5" stroke-width="1"/>`),
  "propeller-hat": (frame, pose) => onHead(frame, pose, `
    <path d="M60 39 63 28 69 22 78 21 87 25 91 34 91 41 84 44 65 44Z" fill="#7ccce4"/>
    <path d="M64 39 89 39 91 43 84 46 65 44Z" fill="#f1de92"/>
    <path d="M76 22 76 14" fill="none" stroke="${outline}" stroke-width="2"/>
    <path d="M59 14 70 10 76 13 84 9 93 13 82 18 76 16 68 19Z" fill="#f5c86c"/>
    <circle cx="76" cy="14" r="2" fill="#e96e62"/>`),
  "prince-crown": (frame, pose) => onHead(frame, pose, `
    <path d="M60 38 60 18 66 25 72 12 79 23 85 13 91 24 91 40 84 43 65 43Z" fill="#f4be5e"/>
    <path d="M61 35 90 35 91 41 83 44 65 43Z" fill="#ffe693"/>
    <path d="M67 29 72 18M79 27 84 19" fill="none" stroke="#fff3af" stroke-width="2"/>
    <circle cx="76" cy="38" r="2" fill="#ed7188"/>`),
};

const ids = [...Object.keys(outfitSources), ...Object.keys(accessoryArt)];
function frameSvg(id, frameIndex, pose) {
  const art = accessoryArt[id];
  assert.ok(art, `unknown wearable: ${id}`);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="112" height="128" viewBox="0 0 112 128" shape-rendering="crispEdges">
    <g stroke="${outline}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${art(frameIndex, pose)}</g>
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

async function approvedOutfitFrames(slug) {
  const source = path.join(root, "assets/corgi-outfits", `${slug}-poses.png`);
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 560, `${slug}: expected five 112px frames`);
  assert.equal(info.height, 128, `${slug}: expected 128px frames`);
  const frames = [];
  for (let frame = 0; frame < 5; frame++) {
    let foot = -1;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 112; x++) {
      if (data[(y * 560 + frame * 112 + x) * 4 + 3] >= 160) foot = y;
    }
    assert.ok(foot >= 0, `${slug}: empty frame ${frame}`);
    const shift = footAnchors[frame] - foot;
    const output = Buffer.alloc(112 * 128 * 4);
    for (let y = 0; y < 128; y++) {
      const targetY = y + shift;
      if (targetY < 0 || targetY >= 128) continue;
      data.copy(output, targetY * 112 * 4, (y * 560 + frame * 112) * 4,
        (y * 560 + frame * 112 + 112) * 4);
    }
    frames.push(output);
  }
  const run = Buffer.alloc(448 * 128 * 4);
  for (let frame = 0; frame < 4; frame++) for (let y = 0; y < 128; y++) {
    frames[frame].copy(run, (y * 448 + frame * 112) * 4, y * 112 * 4, (y + 1) * 112 * 4);
  }
  return {
    run: await sharp(run, { raw: { width: 448, height: 128, channels: 4 } }).png().toBuffer(),
    bark: await sharp(frames[4], { raw: { width: 112, height: 128, channels: 4 } }).png().toBuffer(),
  };
}

for (const id of ids) {
  if (id in outfitSources) {
    const outfit = await approvedOutfitFrames(outfitSources[id]);
    await saveOrCheck(path.join(outputDir, `${id}-run.png`), outfit.run);
    await saveOrCheck(path.join(outputDir, `${id}-bark.png`), outfit.bark);
    continue;
  }
  const frames = await Promise.all([0, 1, 2, 3].map((index) => sharp(frameSvg(id, index, "run")).png().toBuffer()));
  const runOverlay = await sharp({ create: { width: 448, height: 128, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(frames.map((input, index) => ({ input, left: index * 112, top: 0 }))).png().toBuffer();
  const barkOverlay = await sharp(frameSvg(id, 0, "bark")).png().toBuffer();
  await saveOrCheck(path.join(outputDir, `${id}-run.png`), runOverlay);
  await saveOrCheck(path.join(outputDir, `${id}-bark.png`), barkOverlay);
}

console.log(`Corgi wearables ${process.argv.includes("--check") ? "verified" : "generated"}: ${ids.length} run/bark pairs`);
