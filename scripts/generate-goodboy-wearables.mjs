import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { composeDressedCorgiPixels } = require("../src/game/entities/dressedCorgiPixels.ts");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "public/assets/pixel/characters/corgi/equipment");
const outline = "#37162e";
// A sewn suit follows the rump, belly and shoulder. Its pixels are baked into the corgi below.
// The fourth run frame sits eight pixels lower; outfitBody applies that offset.
const torsoPaths = [
  "M14 64 Q15 58 23 57 L41 57 Q47 53 52 53 Q59 54 65 60 Q73 63 78 69 Q81 76 77 83 Q73 89 66 90 L57 87 Q51 90 46 88 L36 87 Q29 90 22 88 Q15 85 14 78Z",
  "M14 64 Q16 58 24 57 L42 56 Q48 52 53 53 Q60 54 66 60 Q74 64 79 70 Q81 77 77 84 Q72 90 65 90 L57 86 Q51 88 45 87 L35 86 Q28 89 21 87 Q15 84 14 78Z",
  "M14 64 Q16 58 24 58 L43 56 Q49 53 54 54 Q61 55 67 61 Q75 65 80 71 Q82 78 78 85 Q73 91 66 91 L56 88 Q51 90 45 89 L35 88 Q28 90 21 88 Q15 85 14 78Z",
  "M15 63 Q17 57 25 57 L43 56 Q49 52 54 53 Q61 55 67 61 Q75 65 80 71 Q82 78 78 85 Q73 91 66 91 L56 88 Q51 90 45 89 L35 88 Q28 90 22 88 Q15 84 15 77Z",
];
const barkTorsoPath = "M14 64 Q16 58 24 57 L43 56 Q49 52 54 53 Q61 55 67 60 Q75 64 80 70 Q82 77 78 84 Q73 90 66 90 L56 87 Q50 89 44 88 L34 87 Q27 89 21 87 Q15 84 14 77Z";
const caterpillarPaths = [
  "M13 65 Q13 57 21 57 Q26 52 34 55 Q40 51 47 54 Q54 51 61 57 Q70 57 76 65 Q82 70 79 79 Q78 86 71 88 Q67 93 59 90 Q53 94 46 90 Q39 94 32 90 Q23 92 18 87 Q12 82 13 74Z",
  "M13 65 Q14 57 22 57 Q27 52 35 55 Q41 51 48 54 Q55 52 62 58 Q71 58 77 66 Q82 72 79 80 Q77 87 70 89 Q65 93 58 89 Q52 93 45 89 Q38 92 31 89 Q22 91 17 86 Q12 81 13 73Z",
  "M13 65 Q14 57 22 57 Q28 52 36 55 Q42 51 49 55 Q56 52 63 58 Q72 59 78 67 Q83 73 80 81 Q78 88 71 90 Q66 94 59 91 Q52 95 45 91 Q38 94 30 91 Q21 93 17 87 Q12 82 13 74Z",
  "M14 65 Q15 57 23 57 Q29 52 37 55 Q43 51 50 55 Q57 52 64 58 Q73 59 79 67 Q83 73 80 81 Q78 88 71 90 Q66 94 59 91 Q52 95 45 91 Q38 94 30 91 Q21 93 18 87 Q13 82 14 74Z",
];
const torsoPath = (frameIndex, pose) => pose === "bark" ? barkTorsoPath : torsoPaths[frameIndex];

function outfitBody(frameIndex, pose, baseColor, details = "", extras = "", shape = "regular") {
  const pathData = shape === "caterpillar" ? caterpillarPaths[pose === "bark" ? 0 : frameIndex] : torsoPath(frameIndex, pose);
  assert.ok(pathData, `unknown outfit frame: ${frameIndex}/${pose}`);
  const stride = pose === "bark" ? 0 : [0, 1, -1, 1][frameIndex];
  const rise = pose === "run" ? [0, 2, 0, 8][frameIndex] : 3;
  const seamColor = shape === "caterpillar" ? "#cc7199" : "#6b4448";
  return `<g transform="translate(0 ${rise})"><defs><clipPath id="torso"><path d="${pathData}"/></clipPath></defs>
    ${extras}
    <path d="${pathData}" fill="${baseColor}" stroke="${seamColor}" stroke-width="1.5" stroke-linejoin="round"/>
    <g clip-path="url(#torso)" transform="translate(${stride} 0)">${details}</g>
    <path d="M60 58 Q70 62 75 71M16 79 Q23 88 31 88" fill="none" stroke="${seamColor}" stroke-width="1.5"/></g>`;
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
  const runOverlay = await sharp({ create: { width: 448, height: 128, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(frames.map((input, index) => ({ input, left: index * 112, top: 0 }))).png().toBuffer();
  const barkOverlay = await sharp(frameSvg(id, 0, "bark")).png().toBuffer();
  const composeOutfit = async (overlay, pose) => {
    const width = pose === "run" ? 448 : 112;
    const source = path.join(root, `public/assets/pixel/characters/corgi/corgi-${pose}.png`);
    const [basePixels, outfitPixels] = await Promise.all([
      sharp(source).ensureAlpha().raw().toBuffer(),
      sharp(overlay).ensureAlpha().raw().toBuffer(),
    ]);
    const dressed = composeDressedCorgiPixels(basePixels, outfitPixels, width, 128, id === "pink-caterpillar-suit");
    return sharp(Buffer.from(dressed), { raw: { width, height: 128, channels: 4 } }).png().toBuffer();
  };
  const run = id in outfitArt && id !== "custom-outfit-template" ? await composeOutfit(runOverlay, "run") : runOverlay;
  const bark = id in outfitArt && id !== "custom-outfit-template" ? await composeOutfit(barkOverlay, "bark") : barkOverlay;
  await saveOrCheck(path.join(outputDir, `${id}-run.png`), run);
  await saveOrCheck(path.join(outputDir, `${id}-bark.png`), bark);
}

console.log(`Corgi wearables ${process.argv.includes("--check") ? "verified" : "generated"}: ${ids.length} run/bark pairs`);
