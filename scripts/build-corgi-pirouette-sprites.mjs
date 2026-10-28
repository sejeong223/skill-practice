import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const FRAME_WIDTH = 112;
const FRAME_HEIGHT = 128;
const FRAME_COUNT = 8;
const SHEET_WIDTH = FRAME_WIDTH * FRAME_COUNT;
const SOURCE_WIDTH = 2172;
const SOURCE_HEIGHT = 724;
const TARGET_HEIGHT = 94;
const FOOT_Y = 99;
const CHECK = process.argv.length === 3 && process.argv[2] === "--check";
if (process.argv.length > (CHECK ? 3 : 2)) {
  throw new Error("Usage: node scripts/build-corgi-pirouette-sprites.mjs [--check]");
}

// Boundaries fall in the transparent gaps of the generated eight-view source.
const panels = [0, 277, 549, 814, 1086, 1355, 1628, 1883, 2172];
const sourcePath = fileURLToPath(new URL("art/source/corgi-pirouette-generated.png", root));
const conceptPath = fileURLToPath(new URL("art/source/corgi-pirouette-base-concept.png", root));
const assetPath = (name) => fileURLToPath(new URL(`public/assets/pixel/characters/corgi/${name}`, root));

function assertSheet(sheet) {
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    let pixels = 0;
    let bottom = -1;
    for (let y = 0; y < FRAME_HEIGHT; y++) for (let x = 0; x < FRAME_WIDTH; x++) {
      const at = (y * SHEET_WIDTH + frame * FRAME_WIDTH + x) * 4;
      if (sheet[at + 3] < 128) continue;
      pixels++;
      bottom = Math.max(bottom, y);
    }
    if (pixels < 1200 || bottom !== FOOT_Y) {
      throw new Error(`Pirouette frame ${frame}: incomplete full body or foot anchor ${bottom}`);
    }
  }
}

async function buildBasePirouette(source) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== SOURCE_WIDTH || info.height !== SOURCE_HEIGHT || info.channels !== 4) {
    throw new Error(`Unexpected pirouette source dimensions: ${info.width}x${info.height}`);
  }
  const sheet = Buffer.alloc(SHEET_WIDTH * FRAME_HEIGHT * 4);
  const transforms = [];
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    const left = panels[frame], right = panels[frame + 1];
    let minX = right, maxX = left - 1, minY = SOURCE_HEIGHT, maxY = -1;
    for (let y = 0; y < SOURCE_HEIGHT; y++) for (let x = left; x < right; x++) {
      if (data[(y * SOURCE_WIDTH + x) * 4 + 3] < 128) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    if (minX > maxX || minY > maxY) throw new Error(`Empty pirouette source panel ${frame}`);
    const crop = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
    const width = Math.min(104, Math.max(48, Math.round(crop.width * TARGET_HEIGHT / crop.height * 1.7)));
    const resized = await sharp(data, { raw: { width: SOURCE_WIDTH, height: SOURCE_HEIGHT, channels: 4 } })
      .extract(crop).resize(width, TARGET_HEIGHT, { kernel: "nearest", fit: "fill" })
      .raw().toBuffer({ resolveWithObject: true });
    const xOffset = Math.floor((FRAME_WIDTH - width) / 2);
    const yOffset = FOOT_Y - TARGET_HEIGHT + 1;
    transforms.push({ minX, minY, cropWidth: crop.width, cropHeight: crop.height,
      width, xOffset, yOffset, panelLeft: left, panelRight: right });
    for (let y = 0; y < TARGET_HEIGHT; y++) for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4;
      if (resized.data[from + 3] < 128) continue;
      const to = ((y + yOffset) * SHEET_WIDTH + frame * FRAME_WIDTH + x + xOffset) * 4;
      sheet[to] = resized.data[from];
      sheet[to + 1] = resized.data[from + 1];
      sheet[to + 2] = resized.data[from + 2];
      sheet[to + 3] = 255;
    }
  }
  assertSheet(sheet);
  return { sheet, transforms };
}

async function normalizeGenerated(source, transforms) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width < SOURCE_WIDTH - 1 || info.width > SOURCE_WIDTH || info.height !== SOURCE_HEIGHT) {
    throw new Error(`Unexpected wardrobe concept dimensions: ${info.width}x${info.height}`);
  }
  const sheet = Buffer.alloc(SHEET_WIDTH * FRAME_HEIGHT * 4);
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    const t = transforms[frame];
    for (let y = 0; y < FRAME_HEIGHT; y++) for (let x = 0; x < FRAME_WIDTH; x++) {
      const sx = t.minX + Math.floor((x - t.xOffset) * t.cropWidth / t.width);
      const sy = t.minY + Math.floor((y - t.yOffset) * t.cropHeight / TARGET_HEIGHT);
      if (sx < t.panelLeft || sx >= Math.min(t.panelRight, info.width) || sy < 0 || sy >= info.height) continue;
      const from = (sy * info.width + sx) * 4;
      if (data[from + 3] < 128) continue;
      const to = (y * SHEET_WIDTH + frame * FRAME_WIDTH + x) * 4;
      sheet[to] = data[from]; sheet[to + 1] = data[from + 1];
      sheet[to + 2] = data[from + 2]; sheet[to + 3] = 255;
    }
  }
  return sheet;
}

function alignVariantFeet(sheet) {
  const aligned = Buffer.alloc(sheet.length);
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    let bottom = -1;
    for (let y = 0; y < FRAME_HEIGHT; y++) for (let x = 0; x < FRAME_WIDTH; x++) {
      if (sheet[(y * SHEET_WIDTH + frame * FRAME_WIDTH + x) * 4 + 3] >= 128) bottom = y;
    }
    if (bottom < 0) throw new Error(`Empty wardrobe frame ${frame}`);
    const shift = FOOT_Y - bottom;
    for (let y = 0; y < FRAME_HEIGHT; y++) for (let x = 0; x < FRAME_WIDTH; x++) {
      const destY = y + shift;
      if (destY < 0 || destY >= FRAME_HEIGHT) continue;
      const from = (y * SHEET_WIDTH + frame * FRAME_WIDTH + x) * 4;
      const to = (destY * SHEET_WIDTH + frame * FRAME_WIDTH + x) * 4;
      sheet.copy(aligned, to, from, from + 4);
    }
  }
  assertSheet(aligned);
  return aligned;
}

function accessoryColor(id, r, g, b) {
  switch (id) {
    case "birthday-party-hat": return (b > r + 20 && b > g + 10) || (r > g + 28 && b > g + 18);
    case "strawberry-headpiece": return (r > 150 && r > g * 2.1 && g < 120 && b > r * 0.28) || (g > r * 1.15 && g > b * 1.1);
    case "propeller-hat": return (b > r + 15 && b > g + 5) || (r > 190 && g > 170 && b < 130);
    case "prince-crown": return r > 170 && g > r * 0.72 && b < g * 0.78;
    default: return false;
  }
}

function extractAccessory(id, edited, base) {
  const output = Buffer.alloc(edited.length);
  const maxY = id === "strawberry-headpiece" ? 48 : id === "shinchan-eyebrow-sticker" ? 44 : 32;
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    if (id === "shinchan-eyebrow-sticker" && (frame === 5 || frame === 6)) continue;
    const seeds = new Set();
    for (let y = 0; y <= maxY; y++) for (let x = 0; x < FRAME_WIDTH; x++) {
      const at = (y * SHEET_WIDTH + frame * FRAME_WIDTH + x) * 4;
      if (edited[at + 3] < 128) continue;
      const [r, g, b] = edited.subarray(at, at + 3);
      let chosen = accessoryColor(id, r, g, b);
      if (id === "shinchan-eyebrow-sticker") {
        const baseBright = Math.min(base[at], base[at + 1], base[at + 2]) > 95;
        chosen = y >= 18 && y <= 43 && x >= 34 && x <= 79 &&
          Math.max(r, g, b) < 110 && baseBright;
      }
      if (chosen) seeds.add(y * FRAME_WIDTH + x);
    }
    for (const seed of seeds) {
      const cx = seed % FRAME_WIDTH, cy = Math.floor(seed / FRAME_WIDTH);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || x >= FRAME_WIDTH || y < 0 || y > maxY) continue;
        const at = (y * SHEET_WIDTH + frame * FRAME_WIDTH + x) * 4;
        if (edited[at + 3] < 128) continue;
        const [r, g, b] = edited.subarray(at, at + 3);
        const darkOutline = Math.max(r, g, b) < 110;
        if (!seeds.has(y * FRAME_WIDTH + x) && !darkOutline) continue;
        edited.copy(output, at, at, at + 4);
      }
    }
  }
  return output;
}

function buildCustomUv(template, base) {
  const uv = Buffer.alloc(template.length);
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    let paintable = 0;
    for (let y = 44; y <= 87; y++) for (let x = 32; x <= 81; x++) {
      const at = (y * SHEET_WIDTH + frame * FRAME_WIDTH + x) * 4;
      if (template[at + 3] < 200) continue;
      const [r, g, b] = template.subarray(at, at + 3);
      if (Math.min(r, g, b) < 230 || Math.max(r, g, b) - Math.min(r, g, b) > 8) continue;
      // The rear-facing white tail is part of the corgi, not paintable fabric.
      if (frame === 6 && Math.abs(x - 56) <= 9 && y >= 69 &&
          Math.min(base[at], base[at + 1], base[at + 2]) > 190) continue;
      const cellX = Math.min(55, Math.floor((x - 32) * 56 / 50));
      const cellY = Math.min(31, Math.floor((y - 44) * 32 / 44));
      const encoded = cellY * 56 + cellX + 1;
      template[at] = template[at + 1] = template[at + 2] = 255;
      uv[at] = encoded & 255;
      uv[at + 1] = encoded >> 8;
      uv[at + 2] = 0;
      uv[at + 3] = 255;
      paintable++;
    }
    if (paintable < 250) throw new Error(`Custom outfit has too little paintable fabric in frame ${frame}: ${paintable}`);
  }
  return uv;
}

function mirrorFrames(sheet) {
  const mirrored = Buffer.alloc(sheet.length);
  for (let frame = 0; frame < FRAME_COUNT; frame++) for (let y = 0; y < FRAME_HEIGHT; y++) {
    for (let x = 0; x < FRAME_WIDTH; x++) {
      const from = (y * SHEET_WIDTH + frame * FRAME_WIDTH + x) * 4;
      const to = (y * SHEET_WIDTH + frame * FRAME_WIDTH + (FRAME_WIDTH - 1 - x)) * 4;
      sheet.copy(mirrored, to, from, from + 4);
    }
  }
  return mirrored;
}

async function outputPng(destination, raw) {
  const png = await sharp(raw, { raw: { width: SHEET_WIDTH, height: FRAME_HEIGHT, channels: 4 } }).png().toBuffer();
  if (CHECK) {
    const existing = await readFile(destination);
    if (!existing.equals(png)) throw new Error(`Pirouette output is stale: ${destination}`);
  } else {
    await writeFile(destination, png);
  }
}

const { sheet, transforms } = await buildBasePirouette(sourcePath);
await outputPng(conceptPath, sheet);
await outputPng(assetPath("corgi-pirouette.png"), sheet);
await outputPng(assetPath("corgi-pirouette-mirror.png"), mirrorFrames(sheet));

const equipmentAsset = (name) => assetPath(`equipment/${name}`);
const outfitIds = ["pink-caterpillar-suit", "banana-peel-suit", "bee-bodysuit", "hotdog-outfit", "diamond-armor"];
const accessoryIds = ["shinchan-eyebrow-sticker", "birthday-party-hat", "strawberry-headpiece", "propeller-hat", "prince-crown"];
if (new Set([...outfitIds, ...accessoryIds]).size !== 10) throw new Error("Duplicate wardrobe id");

for (const id of outfitIds) {
  const path = (name) => fileURLToPath(new URL(`art/source/corgi-pirouette-outfits/${name}`, root));
  const normalized = alignVariantFeet(await normalizeGenerated(path(`${id}-generated.png`), transforms));
  await outputPng(path(`${id}.png`), normalized);
  await outputPng(equipmentAsset(`${id}-pirouette.png`), normalized);
  await outputPng(equipmentAsset(`${id}-pirouette-mirror.png`), mirrorFrames(normalized));
}

for (const id of accessoryIds) {
  const path = (name) => fileURLToPath(new URL(`art/source/corgi-pirouette-accessories/${name}`, root));
  const edited = await normalizeGenerated(path(`${id}-generated.png`), transforms);
  const layer = extractAccessory(id, edited, sheet);
  await outputPng(path(`${id}.png`), layer);
  await outputPng(equipmentAsset(`${id}-pirouette.png`), layer);
  await outputPng(equipmentAsset(`${id}-pirouette-mirror.png`), mirrorFrames(layer));
}

const custom = alignVariantFeet(await normalizeGenerated(
  fileURLToPath(new URL("art/source/corgi-pirouette-custom-outfit-generated.png", root)), transforms));
const uv = buildCustomUv(custom, sheet);
await outputPng(fileURLToPath(new URL("art/source/corgi-pirouette-custom-outfit.png", root)), custom);
await outputPng(fileURLToPath(new URL("art/source/corgi-pirouette-custom-uv.png", root)), uv);
await outputPng(equipmentAsset("custom-outfit-template-pirouette.png"), custom);
await outputPng(equipmentAsset("custom-outfit-template-pirouette-mirror.png"), mirrorFrames(custom));
await outputPng(equipmentAsset("custom-outfit-template-pirouette-uv.png"), uv);
await outputPng(equipmentAsset("custom-outfit-template-pirouette-mirror-uv.png"), mirrorFrames(uv));
console.log(`Corgi pirouette ${CHECK ? "check" : "build"} passed: ${FRAME_COUNT} full-body frames and 11 wardrobe variants.`);
