import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "public/assets/pixel/characters/corgi/equipment");
const outline = "#37162e";
// The torso changes shape between strides. Keep the face, tail, and four paws clear.
const torsoPaths = [
  "M21 63 28 58 43 58 49 56 57 57 63 60 68 60 71 65 69 70 65 73 56 74 49 71 43 73 39 78 29 77 22 73Z",
  "M21 63 29 57 42 56 51 56 58 58 64 60 69 62 71 66 68 71 62 74 53 73 48 70 40 72 36 77 27 76 21 72Z",
  "M20 64 28 59 44 58 50 56 59 58 65 61 70 62 72 67 68 72 63 74 54 74 48 72 41 74 36 79 27 78 21 73Z",
  "M22 65 29 60 43 59 50 58 59 59 66 62 71 63 72 68 69 73 63 76 53 75 47 72 40 74 35 79 28 78 22 74Z",
];
const barkTorsoPath = "M20 64 28 59 43 58 51 55 59 56 65 58 70 61 72 66 69 71 64 74 55 74 49 72 42 74 37 79 28 78 21 73Z";
const torsoPath = (frameIndex, pose) => pose === "bark" ? barkTorsoPath : torsoPaths[frameIndex];

function outfitBody(frameIndex, pose, baseColor, details = "", extras = "") {
  const pathData = torsoPath(frameIndex, pose);
  assert.ok(pathData, `unknown outfit frame: ${frameIndex}/${pose}`);
  const stride = pose === "bark" ? 0 : [0, 1, -1, 1][frameIndex];
  const rise = pose === "run" ? [0, 2, 0, 8][frameIndex] : 3;
  return `<g transform="translate(0 ${rise})"><defs><clipPath id="torso"><path d="${pathData}"/></clipPath></defs>
    ${extras}
    <path d="${pathData}" fill="${baseColor}" stroke="${outline}" stroke-width="2" stroke-linejoin="miter"/>
    <g clip-path="url(#torso)" transform="translate(${stride} 0)">${details}</g>
    <path d="M58 58 63 61 68 61M25 72 29 75 37 76" fill="none" stroke="${outline}" stroke-width="1"/></g>`;
}

const outfitArt = {
  "pink-caterpillar-suit": (frame, pose) => outfitBody(frame, pose, "#ee8eae", `
    <path d="M33 56 30 76M47 55 45 76M60 57 59 75" fill="none" stroke="#a44871" stroke-width="3"/>
    <path d="M26 65h8m5 3h8m6-4h8" stroke="#f8bfd0" stroke-width="2"/>`),
  "banana-peel-suit": (frame, pose) => outfitBody(frame, pose, "#f4d460", `
    <path d="M24 58 31 60 33 77 27 76ZM44 56 51 55 54 75 47 72ZM62 59 68 62 66 73 60 75Z" fill="#ffe78c"/>
    <path d="M32 61 36 75M54 59 57 73" fill="none" stroke="#bd8643" stroke-width="2"/>`),
  "bee-bodysuit": (frame, pose) => outfitBody(frame, pose, "#f6ca5e", `
    <path d="M32 56 31 77M47 55 46 75M62 59 61 75" fill="none" stroke="${outline}" stroke-width="6"/>`,
    `<path d="M36 57 32 49 35 44 44 56ZM47 56 52 45 58 43 61 57Z" fill="#e4f7ee" stroke="${outline}" stroke-width="1"/>`),
  "hotdog-outfit": (frame, pose) => outfitBody(frame, pose, "#e9b36d", `
    <path d="M22 67 29 63 48 61 65 65 71 68 67 74 52 71 37 73 25 73Z" fill="#a94e43"/>
    <path d="M27 66 36 69 45 64 54 69 64 66" fill="none" stroke="#f5d368" stroke-width="3"/>
    <path d="M23 75 35 76 42 72 53 72 66 75" fill="none" stroke="#ffe3a1" stroke-width="3"/>`),
  "diamond-armor": (frame, pose) => outfitBody(frame, pose, "#70c7e6", `
    <path d="M29 59 47 57 64 62 61 72 48 70 39 75 27 72Z" fill="#b8eef0"/>
    <path d="M47 57 48 70 39 75M48 70 61 72M28 66 48 70" fill="none" stroke="#4a8dab" stroke-width="2"/>
    <path d="M30 61 43 59M53 61 62 64" stroke="#e7faf1" stroke-width="2"/>`),
  "custom-outfit-template": (frame, pose) => outfitBody(frame, pose, "#fffdf1", `
    <path d="M25 65 32 61 47 59 60 61" fill="none" stroke="#ffffff" stroke-width="2"/>`),
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
  const offset = outfitArt[id] || pose === "bark" ? { x: 0, y: 0 } : offsets[frameIndex];
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="112" height="128" viewBox="0 0 112 128" shape-rendering="crispEdges">
    <g transform="translate(${offset.x} ${offset.y})" stroke="${outline}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${art(frameIndex, pose)}</g>
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
