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
  return sheet;
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

const sheet = await buildBasePirouette(sourcePath);
await outputPng(conceptPath, sheet);
await outputPng(assetPath("corgi-pirouette.png"), sheet);
await outputPng(assetPath("corgi-pirouette-mirror.png"), mirrorFrames(sheet));
console.log(`Corgi pirouette ${CHECK ? "check" : "build"} passed: ${FRAME_COUNT} full-body frames.`);
