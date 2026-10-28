import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const frameWidth = 112;
const frameHeight = 128;
const sheetWidth = frameWidth * 4;
const check = process.argv.slice(2).length === 1 && process.argv[2] === "--check";
if (process.argv.slice(2).length > 0 && !check) {
  throw new Error("Usage: node scripts/build-corgi-bite-sprites.mjs [--check]");
}
const poses = [
  { width: 96, height: 82, x: 8 },
  { width: 108, height: 82, x: 2 },
  { width: 105, height: 79, x: 4 },
  { width: 98, height: 76, x: 7 },
];
const variants = [
  { id: "bare", concept: "corgi-bite-lunge-concept.png", run: "corgi-run.png", output: "corgi-bite.png" },
  ...["pink-caterpillar-suit", "banana-peel-suit", "bee-bodysuit", "hotdog-outfit", "diamond-armor", "custom-outfit-template"]
    .map((id) => ({ id, concept: `corgi-bite-${id}-concept.png`,
      run: `equipment/${id}-run.png`, output: `equipment/${id}-bite.png` })),
];
const sourcePath = (file) => fileURLToPath(new URL(`art/source/${file}`, root));
const assetPath = (file) => fileURLToPath(new URL(`public/assets/pixel/characters/corgi/${file}`, root));

function bounds(data, imageWidth, imageHeight, left, right) {
  const box = { left: right, right: left, top: imageHeight, bottom: 0 };
  for (let y = 0; y < imageHeight; y++) for (let x = left; x < right; x++) {
    if (data[(y * imageWidth + x) * 4 + 3] < 128) continue;
    box.left = Math.min(box.left, x);
    box.right = Math.max(box.right, x);
    box.top = Math.min(box.top, y);
    box.bottom = Math.max(box.bottom, y);
  }
  if (box.left > box.right) throw new Error(`Empty sprite frame at ${left}`);
  return box;
}

function removeEyeCatchlight(sheet, frame) {
  const dark = (x, y) => {
    if (x < 80 || x > 101 || y < 30 || y > 69) return false;
    const at = (y * sheetWidth + frame * frameWidth + x) * 4;
    return sheet[at + 3] >= 128 && Math.max(sheet[at], sheet[at + 1], sheet[at + 2]) < 100;
  };
  const visited = new Set();
  const eyes = [];
  for (let y = 30; y <= 69; y++) for (let x = 80; x <= 101; x++) {
    const key = y * frameWidth + x;
    if (visited.has(key) || !dark(x, y)) continue;
    const queue = [[x, y]];
    visited.add(key);
    let left = x, right = x, top = y, bottom = y;
    for (let index = 0; index < queue.length; index++) {
      const [cx, cy] = queue[index];
      left = Math.min(left, cx); right = Math.max(right, cx);
      top = Math.min(top, cy); bottom = Math.max(bottom, cy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nextX = cx + dx, nextY = cy + dy, next = nextY * frameWidth + nextX;
        if (!visited.has(next) && dark(nextX, nextY)) { visited.add(next); queue.push([nextX, nextY]); }
      }
    }
    if (queue.length >= 18 && queue.length <= 40 && left >= 84 && right <= 99 &&
        right - left <= 6 && bottom - top <= 8) eyes.push({ left, right, top, bottom, area: queue.length });
  }
  if (eyes.length === 0) throw new Error(`Eye missing from bite frame ${frame}`);
  const eye = eyes.sort((a, b) => b.area - a.area)[0];
  for (let y = eye.top + 1; y < eye.bottom; y++) for (let x = eye.left + 1; x < eye.right; x++) {
    const at = (y * sheetWidth + frame * frameWidth + x) * 4;
    if (sheet[at + 3] < 128 || Math.min(sheet[at], sheet[at + 1], sheet[at + 2]) < 160) continue;
    sheet[at] = 46;
    sheet[at + 1] = 22;
    sheet[at + 2] = 12;
  }
}

const bareRun = await sharp(assetPath("corgi-run.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

for (const variant of variants) {
  const source = sourcePath(variant.concept);
  const concept = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const run = variant.id === "bare" ? bareRun
    : await sharp(assetPath(variant.run)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (concept.info.width % 4 !== 0 || run.info.width !== sheetWidth || run.info.height !== frameHeight) {
    throw new Error(`Unexpected source dimensions: ${variant.id}`);
  }
  const sheet = Buffer.alloc(sheetWidth * frameHeight * 4);
  for (let frame = 0; frame < 4; frame++) {
    const slotLeft = frame * concept.info.width / 4;
    const slotRight = (frame + 1) * concept.info.width / 4;
    const box = bounds(concept.data, concept.info.width, concept.info.height, slotLeft, slotRight);
    const crop = {
      left: Math.max(slotLeft, box.left - 2),
      top: Math.max(0, box.top - 2),
      width: Math.min(slotRight - 1, box.right + 2) - Math.max(slotLeft, box.left - 2) + 1,
      height: Math.min(concept.info.height - 1, box.bottom + 2) - Math.max(0, box.top - 2) + 1,
    };
    const runBox = bounds(run.data, sheetWidth, frameHeight, frame * frameWidth, (frame + 1) * frameWidth);
    const bareBox = bounds(bareRun.data, sheetWidth, frameHeight, frame * frameWidth, (frame + 1) * frameWidth);
    const pose = poses[frame];
    const width = Math.min(110, pose.width + (runBox.right - runBox.left) - (bareBox.right - bareBox.left));
    const height = Math.min(106, pose.height + (runBox.bottom - runBox.top) - (bareBox.bottom - bareBox.top));
    const xOffset = Math.max(0, Math.min(frameWidth - width, pose.x - Math.floor((width - pose.width) / 2)));
    const yOffset = 102 - height;
    const scaled = await sharp(source).extract(crop)
      .resize(width, height, { kernel: "nearest", fit: "fill" })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < height; y++) for (let localX = 0; localX < width; localX++) {
      const from = (y * width + localX) * 4;
      if (scaled.data[from + 3] < 128) continue;
      const sheetX = frame * frameWidth + xOffset + localX;
      const sheetY = yOffset + y;
      const to = (sheetY * sheetWidth + sheetX) * 4;
      let red = scaled.data[from], green = scaled.data[from + 1], blue = scaled.data[from + 2];
      if (variant.id === "custom-outfit-template" && xOffset + localX >= 7 && xOffset + localX < 85 &&
          sheetY >= 40 && sheetY < 96 && Math.min(red, green, blue) >= 230 &&
          Math.max(red, green, blue) - Math.min(red, green, blue) <= 10) {
        red = green = blue = 255;
      }
      sheet[to] = red;
      sheet[to + 1] = green;
      sheet[to + 2] = blue;
      sheet[to + 3] = 255;
    }
    removeEyeCatchlight(sheet, frame);
  }
  const png = await sharp(sheet, { raw: { width: sheetWidth, height: frameHeight, channels: 4 } })
    .png().toBuffer();
  const output = assetPath(variant.output);
  if (check) {
    if (!png.equals(await readFile(output))) throw new Error(`Bite sprite differs from source: ${output}`);
  } else {
    await writeFile(output, png);
  }
}
