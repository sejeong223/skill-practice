import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "public/assets/pixel/shop");
const sourcePath = path.join(root, ".memory/test-plans/assets/2026-10-20-goodboy-shopkeeper-source.png");
const outline = "#37162e";
const gold = "#f9be60";
const cream = "#fff0cc";
const blue = "#67c9e8";
const pink = "#ee83a8";
const green = "#9ed760";

// Each item is hand-shaped at 32 px, then enlarged with nearest-neighbor.
// The intentionally shared outline and small palette match the World 1 props.
const art = {
  "squeaky-ball": `<circle cx="16" cy="16" r="11" fill="${gold}"/><path d="M7 13h3v-3h4" fill="none" stroke="#ffdf89"/><path d="M21 8h3v3" fill="none" stroke="#d27845"/><circle cx="20" cy="17" r="2.2" fill="${outline}" stroke="none"/>`,
  "rolled-newspaper": `<path d="M5 23 19 5 27 10 12 27Z" fill="#d9d8d1"/><path d="M8 22 21 7M11 24 24 9M15 13l6 4M11 18l6 4" fill="none" stroke="#798898" stroke-width="1"/><path d="M4 22 11 27M5 24l5 3" fill="none" stroke="#bd8c5c"/>`,
  "pink-backscratcher": `<g transform="translate(-1 0)"><path d="M7 27 20 10l3 2L10 29Z" fill="${pink}"/><path d="M18 11 21 6l2 3 2-4 2 3 2-2 1 5-4 5-5-2Z" fill="#f6a7bd"/><path d="M9 24 12 26" stroke="#ffe1e8"/></g>`,
  "drumstick-boomerang": `<path d="M5 25q-4-4 0-6 2-1 4 1L19 7q-1-3 2-4 2-1 4 2 3-1 4 1 1 3-3 5L13 26q-1 3-4 3-2 0-3-2Z" fill="${cream}"/><path d="M10 23 22 9" stroke="#dcae79" fill="none"/>`,
  "plastic-frisbee": `<ellipse cx="16" cy="16" rx="13" ry="6" fill="${blue}"/><ellipse cx="16" cy="14" rx="9" ry="3" fill="#d9f5ef"/><path d="M5 18q11 9 22 0" fill="none" stroke="#2889a7"/>`,
  "cushion-pad": `<rect x="5" y="6" width="22" height="21" rx="4" fill="${pink}"/><path d="M9 10h14v13H9Z" fill="#fac0cc" stroke="#b8537b" stroke-width="1"/><path d="M10 12 22 22M22 12 10 22" fill="none" stroke="#db799b" stroke-width="1"/><circle cx="16" cy="17" r="1" fill="#fff1d9" stroke="none"/>`,
  "greasy-pizza-box": `<path d="M4 11 22 5l7 7-2 14-19 2-4-7Z" fill="#d99d5d"/><path d="M4 11 23 8l6 4-19 5Z" fill="#f1c388"/><path d="M12 13 19 11l-2 5Z" fill="#b65a36" stroke="#923f38" stroke-width="1"/><path d="M10 18 27 14M10 18 9 26" fill="none" stroke="#a76543"/>`,
  "umbrella": `<path d="M3 16Q16 2 29 16q-4-2-7 1-3-3-6 0-3-3-6 0-3-3-7-1Z" fill="${blue}"/><path d="M16 16v10q0 4 5 2l2-2" fill="none" stroke="${outline}" stroke-width="2"/><path d="M10 14q2-7 6-9m0 0q5 2 7 9" fill="none" stroke="#e7f8ef" stroke-width="1"/>`,
  "yellow-pot-lid": `<ellipse cx="16" cy="20" rx="13" ry="8" fill="${gold}"/><ellipse cx="16" cy="18" rx="11" ry="6" fill="#ffe190"/><path d="M12 13v-4h8v4" fill="${gold}"/><path d="M8 18h16" stroke="#fff1ba" stroke-width="1"/>`,
  "pink-caterpillar-suit": `<circle cx="9" cy="19" r="6" fill="${pink}"/><circle cx="17" cy="18" r="7" fill="#f4a4b8"/><circle cx="24" cy="17" r="6" fill="${pink}"/><path d="M8 13 6 8m5 5 2-5" stroke="${outline}" fill="none"/><circle cx="6" cy="8" r="1.5" fill="#ffcf74"/><circle cx="13" cy="8" r="1.5" fill="#ffcf74"/>`,
  "banana-peel-suit": `<path d="M15 9q1-4 3-4l2 3-2 8 7-5 3 4q-5 12-12 14-9-2-12-14l3-4 7 5Z" fill="#f6d764"/><path d="M15 10 16 27M8 14q2 8 8 13m10-12q-4 10-10 12" fill="none" stroke="#d99e48" stroke-width="1"/><path d="M16 5h3" stroke="#70513f"/>`,
  "bee-bodysuit": `<ellipse cx="6" cy="12" rx="4" ry="6" fill="#dff5e9"/><ellipse cx="26" cy="12" rx="4" ry="6" fill="#dff5e9"/><ellipse cx="16" cy="18" rx="10" ry="12" fill="${gold}"/><path d="M8 14h16M7 20h18M11 26h10" stroke="${outline}" stroke-width="3" fill="none"/><path d="M13 6 11 3m8 3 2-3" stroke="${outline}" fill="none"/>`,
  "hotdog-outfit": `<path d="M5 8q-4 7 0 16 3 5 8 3V5Q8 4 5 8Z" fill="#e6ae64"/><path d="M27 8q4 7 0 16-3 5-8 3V5q5-1 8 3Z" fill="#e6ae64"/><rect x="12" y="5" width="8" height="22" rx="4" fill="#b9564e"/><path d="M15 8q4 3 0 6t0 6 0 5" fill="none" stroke="#f1cb55" stroke-width="2"/>`,
  "diamond-armor": `<path d="M6 7 12 4h8l6 3 3 6-4 4-2 11H9L7 17l-4-4Z" fill="#79d7ed"/><path d="M12 4 16 11 20 4M9 15l7-4 7 4-3 9h-8Z" fill="#b9f3f5"/><path d="M16 11v13" stroke="#4b9ec0" fill="none" stroke-width="1"/>`,
  "shinchan-eyebrow-sticker": `<path d="M3 18q5-8 12-5v5q-7-2-12 4ZM17 13q7-3 12 5v4q-5-6-12-4Z" fill="${outline}"/><path d="M6 17q3-2 6-2m8 0q4 0 6 3" fill="none" stroke="#75546a" stroke-width="1"/>`,
  "birthday-party-hat": `<path d="M6 25 17 4 27 25Z" fill="${pink}"/><path d="M12 13 21 17M9 20 24 23" stroke="#f9d76b" stroke-width="3" fill="none"/><circle cx="17" cy="4" r="3" fill="${blue}"/><path d="M4 26h24" stroke="${outline}" stroke-width="2"/>`,
  "strawberry-headpiece": `<path d="M16 6q12 0 11 11-1 8-11 13Q5 25 5 17 4 6 16 6Z" fill="#e95b64"/><path d="M6 10 11 5l5 2 5-2 5 5-7 1-3-3-3 3Z" fill="${green}"/><path d="m10 15 1 2m8-2 1 2m-6 4 1 2m8-1 1 2" stroke="#ffe5a5" stroke-width="1"/>`,
  "propeller-hat": `<path d="M5 18q0-10 11-10t11 10v6H5Z" fill="${blue}"/><path d="M5 21h22" stroke="#e8f9ee" stroke-width="3"/><path d="M16 8V5" stroke="${outline}"/><path d="M5 5 12 3l4 2 4-2 7 2-7 3-4-2-4 2Z" fill="#f5c661"/><circle cx="16" cy="5" r="2" fill="#ea6a5e"/>`,
  "prince-crown": `<path d="M4 10 9 15 15 5 21 15l7-5-2 17H6Z" fill="${gold}"/><path d="M7 21h18v4H7Z" fill="#fbe092"/><circle cx="16" cy="20" r="2" fill="#ef6880" stroke="none"/><path d="M9 9h1m11 0h1" stroke="#fff0bb"/>`,
};

function iconSvg(fragment) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="-2 -2 36 36" shape-rendering="crispEdges"><g stroke="${outline}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${fragment}</g></svg>`);
}

async function cropAlpha(source) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const index = (y * info.width + x) * 4;
    const alpha = data[index + 3];
    data[index + 3] = alpha < 160 ? 0 : 255;
    if (alpha < 160) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  assert.ok(right >= left && bottom >= top, "shopkeeper source needs an opaque silhouette");
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .png().toBuffer();
}

async function saveOrCheck(file, bytes) {
  if (process.argv.includes("--check")) {
    assert.deepEqual(await readFile(file), bytes, `${file} does not match generated art`);
  } else {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  }
}

const cropped = await cropAlpha(await readFile(sourcePath));
const owner = await sharp(cropped).resize({ width: 240, height: 240, fit: "inside", kernel: sharp.kernel.nearest }).png().toBuffer();
const ownerSize = await sharp(owner).metadata();
assert.ok(ownerSize.width && ownerSize.height);
const ownerCanvas = await sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: owner, left: Math.floor((256 - ownerSize.width) / 2), top: Math.floor((256 - ownerSize.height) / 2) }])
  .png().toBuffer();
await saveOrCheck(path.join(outputDir, "goodboy-retriever.png"), ownerCanvas);

for (const [id, fragment] of Object.entries(art)) {
  const croppedIcon = await cropAlpha(iconSvg(fragment));
  const scaledIcon = await sharp(croppedIcon).resize({ width: 56, height: 56, fit: "inside", kernel: sharp.kernel.nearest }).png().toBuffer();
  const size = await sharp(scaledIcon).metadata();
  assert.ok(size.width && size.height);
  const icon = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaledIcon, left: Math.floor((64 - size.width) / 2), top: Math.floor((64 - size.height) / 2) }])
    .png().toBuffer();
  await saveOrCheck(path.join(outputDir, "items", `${id}.png`), icon);
}

const previewLayers = await Promise.all(Object.keys(art).map(async (id, index) => ({
  input: await readFile(path.join(outputDir, "items", `${id}.png`)),
  left: index % 5 * 72 + 4,
  top: Math.floor(index / 5) * 72 + 4,
})));
const preview = await sharp({ create: { width: 360, height: 288, channels: 4, background: "#f5e9cf" } })
  .composite(previewLayers).png().toBuffer();
await saveOrCheck(path.join(root, ".memory/test-plans/assets/2026-10-20-goodboy-market-contact-sheet.png"), preview);

console.log(`Goodboy market sprites ${process.argv.includes("--check") ? "verified" : "generated"}: ${Object.keys(art).length} items + owner`);
