import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "public/assets/pixel/characters/corgi/equipment");
const outline = "#37162e";
// Follow the whole side of the torso, from the shoulder to just above the paws.
// The fourth run frame sits eight pixels lower; outfitBody applies that offset.
const torsoPaths = [
  "M20 65 Q22 60 28 59 L42 59 Q48 57 51 56 Q57 56 61 60 Q68 61 72 66 Q75 72 71 79 Q68 86 61 88 L48 86 Q43 84 38 86 L28 86 Q21 85 20 79 Q18 73 20 65Z",
  "M20 65 Q23 60 29 58 L42 58 Q48 56 51 56 Q58 57 62 61 Q69 62 72 67 Q74 73 70 80 Q67 86 60 88 L49 85 Q44 83 39 85 L27 85 Q20 84 20 78 Q18 72 20 65Z",
  "M20 65 Q23 60 29 59 L43 58 Q49 56 52 56 Q59 58 63 61 Q70 62 73 68 Q75 74 71 81 Q68 87 61 89 L48 87 Q42 84 37 87 L27 87 Q20 86 19 80 Q18 72 20 65Z",
  "M22 65 Q25 60 30 59 L44 58 Q50 57 53 56 Q60 58 64 61 Q70 63 73 69 Q75 75 71 81 Q68 87 61 89 L48 87 Q43 85 38 87 L28 87 Q21 86 21 80 Q20 72 22 65Z",
];
const barkTorsoPath = "M20 65 Q23 59 29 58 L43 58 Q49 56 52 55 Q59 56 64 59 Q71 62 73 68 Q75 74 71 81 Q68 87 61 89 L48 87 Q42 84 37 87 L27 87 Q20 86 19 80 Q18 72 20 65Z";
const caterpillarPaths = [
  "M19 67 Q19 60 26 59 Q30 55 38 57 Q45 53 51 56 Q58 55 63 60 Q71 61 74 68 Q76 75 72 80 Q72 87 64 88 Q60 92 53 89 Q47 92 41 89 Q35 92 29 89 Q21 90 18 84 Q16 78 19 74Z",
  "M19 67 Q20 60 27 58 Q31 54 39 56 Q46 53 52 56 Q59 56 64 61 Q72 62 74 69 Q76 76 71 81 Q70 88 63 88 Q59 92 52 88 Q46 91 40 88 Q34 91 28 88 Q20 89 18 83 Q16 76 19 73Z",
  "M19 67 Q20 60 27 59 Q31 55 39 57 Q46 53 52 56 Q60 56 65 62 Q72 63 75 70 Q77 77 72 82 Q71 89 64 90 Q59 94 52 90 Q46 93 40 90 Q34 93 27 90 Q19 90 17 84 Q16 77 19 74Z",
  "M21 67 Q22 60 29 59 Q33 55 41 57 Q48 54 54 56 Q61 57 66 62 Q73 64 75 71 Q77 77 72 83 Q71 90 64 90 Q59 94 52 91 Q46 94 40 91 Q34 94 28 90 Q20 90 19 84 Q18 77 21 74Z",
];
const torsoPath = (frameIndex, pose) => pose === "bark" ? barkTorsoPath : torsoPaths[frameIndex];

function outfitBody(frameIndex, pose, baseColor, details = "", extras = "", shape = "regular") {
  const pathData = shape === "caterpillar" ? caterpillarPaths[pose === "bark" ? 0 : frameIndex] : torsoPath(frameIndex, pose);
  assert.ok(pathData, `unknown outfit frame: ${frameIndex}/${pose}`);
  const stride = pose === "bark" ? 0 : [0, 1, -1, 1][frameIndex];
  const rise = pose === "run" ? [0, 2, 0, 8][frameIndex] : 3;
  return `<g transform="translate(0 ${rise})"><defs><clipPath id="torso"><path d="${pathData}"/></clipPath></defs>
    ${extras}
    <path d="${pathData}" fill="${baseColor}" stroke="${outline}" stroke-width="2" stroke-linejoin="miter"/>
    <g clip-path="url(#torso)" transform="translate(${stride} 0)">${details}</g>
    <path d="M57 58 Q65 61 69 66M21 78 Q24 83 31 84" fill="none" stroke="${outline}" stroke-width="1"/></g>`;
}

const outfitArt = {
  "pink-caterpillar-suit": (frame, pose) => outfitBody(frame, pose, "#f6a8c9", `
    <path d="M33 57 Q28 68 32 77 Q33 84 27 91M48 55 Q43 68 48 78 Q50 86 43 93M62 59 Q58 69 64 79 Q67 85 60 92" fill="none" stroke="#e678a7" stroke-width="5"/>
    <path d="M23 68 Q28 61 32 63M37 66 Q42 59 47 61M52 66 Q58 60 62 65M64 71 Q68 68 72 70" fill="none" stroke="#ffd0e0" stroke-width="3"/>
    <path d="M22 80 Q25 85 30 86M36 82 Q40 87 45 87M51 82 Q55 88 60 88" fill="none" stroke="#fbd2df" stroke-width="2"/>`, "", "caterpillar"),
  "banana-peel-suit": (frame, pose) => outfitBody(frame, pose, "#f4d460", `
    <path d="M22 61 31 60 35 87 26 88ZM43 57 51 56 55 88 46 86ZM61 60 70 64 69 84 61 89Z" fill="#ffe78c"/>
    <path d="M32 61 36 86M54 60 57 87" fill="none" stroke="#bd8643" stroke-width="2"/>`),
  "bee-bodysuit": (frame, pose) => outfitBody(frame, pose, "#f6ca5e", `
    <path d="M32 57 31 89M47 55 46 90M62 59 61 91" fill="none" stroke="${outline}" stroke-width="6"/>`,
    `<path d="M36 57 32 49 35 44 44 56ZM47 56 52 45 58 43 61 57Z" fill="#e4f7ee" stroke="${outline}" stroke-width="1"/>`),
  "hotdog-outfit": (frame, pose) => outfitBody(frame, pose, "#e9b36d", `
    <path d="M21 68 Q31 61 47 63 Q64 63 73 70 L70 79 Q61 83 50 80 Q34 84 21 80Z" fill="#a94e43"/>
    <path d="M26 69 Q34 75 43 68 Q51 74 60 69 Q65 73 69 71" fill="none" stroke="#f5d368" stroke-width="3"/>
    <path d="M22 83 Q31 86 40 83 Q51 86 60 84 Q67 85 71 82" fill="none" stroke="#ffe3a1" stroke-width="4"/>`),
  "diamond-armor": (frame, pose) => outfitBody(frame, pose, "#70c7e6", `
    <path d="M27 60 47 57 66 63 67 82 58 88 41 83 28 87 22 80Z" fill="#b8eef0"/>
    <path d="M47 57 48 75 41 83M48 75 67 82M25 70 48 75M41 83 43 90" fill="none" stroke="#4a8dab" stroke-width="2"/>
    <path d="M30 62 43 60M53 62 63 65" stroke="#e7faf1" stroke-width="2"/>`),
  "custom-outfit-template": (frame, pose) => outfitBody(frame, pose, "#fffdf1", `
    <path d="M24 67 Q35 60 47 60 Q59 60 66 65" fill="none" stroke="#ffffff" stroke-width="2"/>`),
};

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

const ids = [...Object.keys(outfitArt), ...Object.keys(accessoryArt)];
function frameSvg(id, frameIndex, pose) {
  const art = outfitArt[id] ?? accessoryArt[id];
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

for (const id of ids) {
  const frames = await Promise.all([0, 1, 2, 3].map((index) => sharp(frameSvg(id, index, "run")).png().toBuffer()));
  const run = await sharp({ create: { width: 448, height: 128, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(frames.map((input, index) => ({ input, left: index * 112, top: 0 }))).png().toBuffer();
  const bark = await sharp(frameSvg(id, 0, "bark")).png().toBuffer();
  await saveOrCheck(path.join(outputDir, `${id}-run.png`), run);
  await saveOrCheck(path.join(outputDir, `${id}-bark.png`), bark);
}

console.log(`Corgi wearables ${process.argv.includes("--check") ? "verified" : "generated"}: ${ids.length} run/bark pairs`);
