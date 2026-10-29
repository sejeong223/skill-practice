import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const pathAt = path => fileURLToPath(new URL(path, root));
const FRAME_W = 112, FRAME_H = 128, COUNT = 4, SHEET_W = FRAME_W * COUNT, FOOT_Y = 99;
const CHECK = process.argv.length === 3 && process.argv[2] === "--check";
if (process.argv.length > (CHECK ? 3 : 2)) throw new Error("Usage: node scripts/build-corgi-dash-sprites.mjs [--check]");
const asset = name => pathAt(`public/assets/pixel/characters/corgi/${name}`);
const source = name => pathAt(`art/source/corgi-dash-raw/${name}.png`);
const outfitIds = ["pink-caterpillar-suit", "banana-peel-suit", "bee-bodysuit", "hotdog-outfit", "diamond-armor"];
const accessoryIds = ["shinchan-eyebrow-sticker", "birthday-party-hat", "strawberry-headpiece", "propeller-hat", "prince-crown"];
const frameSpecs = [
  { name: "push", width: 96, height: 55 },
  { name: "launch", width: 104, height: 56 },
  { name: "push", width: 102, height: 56 },
  { name: "recover", width: 98, height: 58 },
];

function boundsOf(data, width, height) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] < 128) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  if (right < left || bottom < top) throw new Error("Empty full-body dash source");
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function renderFrame(rawPath, width, height) {
  const { data, info } = await sharp(rawPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const crop = boundsOf(data, info.width, info.height);
  if (crop.width < 300 || crop.height < 250) throw new Error(`Incomplete dash body: ${rawPath}`);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract(crop).resize(width, height, { kernel: "nearest", fit: "fill" })
    .ensureAlpha().raw().toBuffer();
}

async function buildBodySheet(paths) {
  const sheet = Buffer.alloc(SHEET_W * FRAME_H * 4);
  for (let frame = 0; frame < COUNT; frame++) {
    const spec = frameSpecs[frame];
    const pixels = await renderFrame(paths[frame], spec.width, spec.height);
    const left = Math.floor((FRAME_W - spec.width) / 2), top = FOOT_Y - spec.height + 1;
    for (let y = 0; y < spec.height; y++) for (let x = 0; x < spec.width; x++) {
      const from = (y * spec.width + x) * 4;
      if (pixels[from + 3] < 128) continue;
      const to = ((top + y) * SHEET_W + frame * FRAME_W + left + x) * 4;
      sheet[to] = pixels[from]; sheet[to + 1] = pixels[from + 1];
      sheet[to + 2] = pixels[from + 2]; sheet[to + 3] = 255;
    }
  }
  assertBody(sheet);
  return sheet;
}

function assertBody(sheet) {
  for (let frame = 0; frame < COUNT; frame++) {
    let count = 0, bottom = -1;
    for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) {
      if (sheet[(y * SHEET_W + frame * FRAME_W + x) * 4 + 3] < 128) continue;
      count++; bottom = y;
    }
    if (count < 1800 || bottom !== FOOT_Y) throw new Error(`Dash frame ${frame} incomplete or feet misaligned: ${count}, ${bottom}`);
  }
}

async function output(file, raw) {
  const png = await sharp(raw, { raw: { width: SHEET_W, height: FRAME_H, channels: 4 } }).png().toBuffer();
  if (CHECK) {
    const previous = await readFile(file);
    if (!previous.equals(png)) throw new Error(`Stale dash output: ${file}`);
  } else {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, png);
  }
}

function buildAccessory(runSheet, id) {
  const layer = Buffer.alloc(SHEET_W * FRAME_H * 4);
  for (let frame = 0; frame < COUNT; frame++) for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) {
    const from = (y * SHEET_W + frame * FRAME_W + x) * 4;
    if (runSheet[from + 3] < 128) continue;
    const nx = x + 1, ny = y + (id === "shinchan-eyebrow-sticker" ? 24 : 13);
    if (nx >= FRAME_W || ny >= FRAME_H) continue;
    const to = (ny * SHEET_W + frame * FRAME_W + nx) * 4;
    runSheet.copy(layer, to, from, from + 4);
  }
  return layer;
}

function buildCustom(base) {
  const suit = Buffer.from(base), uv = Buffer.alloc(base.length);
  for (let frame = 0; frame < COUNT; frame++) for (let y = 62; y < 90; y++) for (let x = 24; x < 80; x++) {
    const at = (y * SHEET_W + frame * FRAME_W + x) * 4;
    const [red, green, blue, alpha] = suit.subarray(at, at + 4);
    if (alpha < 200 || red < 170 || green < 75 || green > 205 || blue > 130 || red < green + 30) continue;
    suit[at] = suit[at + 1] = suit[at + 2] = 255;
    const cellX = Math.floor((x - 24) * 56 / 56), cellY = Math.floor((y - 62) * 32 / 28);
    const encoded = Math.min(31, cellY) * 56 + cellX + 1;
    uv[at] = encoded & 255; uv[at + 1] = encoded >> 8; uv[at + 3] = 255;
  }
  if (!uv.some((value, index) => index % 4 === 3 && value === 255)) throw new Error("Missing dash paint fabric");
  return { suit, uv };
}

const base = await buildBodySheet(frameSpecs.map(frame => source(frame.name)));
await output(pathAt("art/source/corgi-dash-base-concept.png"), base);
await output(asset("corgi-dash.png"), base);
for (const id of outfitIds) {
  const sheet = await buildBodySheet(frameSpecs.map(() => source(id)));
  await output(pathAt(`art/source/corgi-dash-outfits/${id}.png`), sheet);
  await output(asset(`equipment/${id}-dash.png`), sheet);
}
for (const id of accessoryIds) {
  const { data, info } = await sharp(asset(`equipment/${id}-run.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== SHEET_W || info.height !== FRAME_H) throw new Error(`Accessory size mismatch: ${id}`);
  const layer = buildAccessory(data, id);
  await output(pathAt(`art/source/corgi-dash-accessories/${id}.png`), layer);
  await output(asset(`equipment/${id}-dash.png`), layer);
}
const { suit, uv } = buildCustom(base);
await output(pathAt("art/source/corgi-dash-custom-outfit.png"), suit);
await output(pathAt("art/source/corgi-dash-custom-uv.png"), uv);
await output(asset("equipment/custom-outfit-template-dash.png"), suit);
await output(asset("equipment/custom-outfit-template-dash-uv.png"), uv);
console.log(`Dash ${CHECK ? "check" : "build"} passed: four full-body frames, five outfits, five accessories and paint UV.`);
