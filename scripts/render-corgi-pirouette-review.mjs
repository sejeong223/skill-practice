import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import sharp from "sharp";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { colorizeCustomOutfitPixels } = require("../src/game/entities/customOutfitTexture.ts");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const corgi = path.join(root, "public/assets/pixel/characters/corgi");
const equipment = path.join(corgi, "equipment");
const output = path.join(root, ".memory/test-plans/assets");
const frameWidth = 112;
const frameHeight = 128;
const scale = 4;
const labelWidth = 240;
const cellWidth = frameWidth * scale;
const rowHeight = frameHeight * scale + 48;

function background(rows) {
  const width = labelWidth + 8 * cellWidth;
  const height = 48 + rows.length * rowHeight;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    `<rect width="100%" height="100%" fill="#f4efe7"/>`];
  for (let frame = 0; frame < 8; frame++) {
    const x = labelWidth + frame * cellWidth;
    parts.push(`<text x="${x + 12}" y="33" fill="#443a31" font-family="sans-serif" font-size="22">${frame * 45}° · ${frame}</text>`);
  }
  for (let row = 0; row < rows.length; row++) {
    const y = 48 + row * rowHeight;
    parts.push(`<text x="12" y="${y + 40}" fill="#443a31" font-family="sans-serif" font-size="22">${rows[row].label}</text>`);
    for (let frame = 0; frame < 8; frame++) {
      const x = labelWidth + frame * cellWidth;
      parts.push(`<rect x="${x}" y="${y}" width="${cellWidth}" height="${frameHeight * scale}" fill="${(row + frame) % 2 ? "#fffaf3" : "#e8e0d4"}"/>`);
      parts.push(`<line x1="${x}" y1="${y}" x2="${x}" y2="${y + frameHeight * scale}" stroke="#b8aa98"/>`);
    }
  }
  parts.push("</svg>");
  return { width, height, svg: Buffer.from(parts.join("")) };
}

async function frameBuffer(source, frame) {
  const input = typeof source === "string" ? source : source.data;
  const options = typeof source === "string" ? {} : { raw: source.raw };
  return sharp(input, options).extract({ left: frame * frameWidth, top: 0,
    width: frameWidth, height: frameHeight }).resize(cellWidth, frameHeight * scale, {
    kernel: sharp.kernel.nearest,
  }).png().toBuffer();
}

async function render(rows, filename) {
  const { width, height, svg } = background(rows);
  const overlays = [];
  for (let row = 0; row < rows.length; row++) {
    for (let frame = 0; frame < 8; frame++) {
      const left = labelWidth + frame * cellWidth;
      const top = 48 + row * rowHeight;
      overlays.push({ input: await frameBuffer(rows[row].source, frame), left, top });
      if (rows[row].overlay) overlays.push({ input: await frameBuffer(rows[row].overlay, frame), left, top });
    }
  }
  await sharp(svg).composite(overlays).png().toFile(path.join(output, filename));
  console.log(`${filename}: ${width}×${height}, ${rows.length} rows`);
}

async function coloredCustom() {
  const source = new Uint8ClampedArray(await sharp(path.join(equipment,
    "custom-outfit-template-pirouette.png")).ensureAlpha().raw().toBuffer());
  const uv = new Uint8ClampedArray(await sharp(path.join(equipment,
    "custom-outfit-template-pirouette-uv.png")).ensureAlpha().raw().toBuffer());
  const cells = Array.from({ length: 56 * 32 }, (_, index) => Math.floor(index / 56) % 6 < 3 ? "#6C9BD8" : "#E95F68");
  const data = colorizeCustomOutfitPixels(source, 896, 128, "pirouette", {
    id: "review", updatedAt: "2026-10-28T00:00:00Z", cells,
  }, uv);
  return { data: Buffer.from(data), raw: { width: 896, height: 128, channels: 4 } };
}

await fs.promises.mkdir(output, { recursive: true });
const base = path.join(corgi, "corgi-pirouette.png");
await render([{ label: "Base corgi", source: base }], "2026-10-28-corgi-pirouette-base.png");
const outfitIds = ["banana-peel-suit", "bee-bodysuit", "diamond-armor", "hotdog-outfit", "pink-caterpillar-suit"];
const accessoryIds = ["birthday-party-hat", "prince-crown", "propeller-hat", "shinchan-eyebrow-sticker", "strawberry-headpiece"];
const rows = [
  ...outfitIds.map(id => ({ label: id, source: path.join(equipment, `${id}-pirouette.png`) })),
  { label: "custom-colored", source: await coloredCustom() },
  ...accessoryIds.map(id => ({ label: id, source: base, overlay: path.join(equipment, `${id}-pirouette.png`) })),
];
await render(rows, "2026-10-28-corgi-pirouette-wardrobe.png");
