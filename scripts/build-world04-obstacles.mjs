import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Fixed rectangles measured on the two generated source sheets; all frames share a foot or center anchor.
export const obstacleCrops = [
  ['scrap', 'ground', 48, 40, [[30, 90, 292, 200]]],
  ['tire', 'ground', 72, 40, [[390, 198, 185, 92, 28], [675, 218, 199, 73, 22], [976, 166, 178, 124, 40]]],
  ['oil', 'ground', 160, 16, [[1214, 232, 294, 64]]],
  ['belt', 'ground', 160, 24, [[40, 422, 278, 102], [336, 422, 278, 102], [630, 422, 278, 102], [925, 422, 278, 102]]],
  ['cable', 'ground', 32, 48, [[108, 540, 128, 236], [414, 540, 128, 236], [708, 540, 128, 236]]],
  ['press-left', 'ground', 64, 112, [[920, 542, 234, 240]]],
  ['press-right', 'ground', 64, 112, [[1282, 542, 234, 240]]],
  ['plate', 'ground', 48, 8, [[40, 878, 278, 82], [348, 898, 266, 62, 6]]],
  ['door', 'ground', 32, 144, [[1240, 320, 268, 204]]],
  ['crane', 'air', 128, 96, [[32, 112, 502, 306]]],
  ['magnet', 'air', 64, 32, [[548, 204, 462, 268]]],
  ['payload', 'air', 72, 80, [[1052, 196, 466, 280]]],
  ['swing', 'air', 48, 48, [[48, 546, 432, 432]]],
  ['saw', 'air', 44, 44, [[554, 546, 440, 432]]],
].map(([name, sheet, frameWidth, frameHeight, crops]) => ({ name, sourcePath: `art/source/world04-scrapyard-obstacles-${sheet}.png`, frameWidth, frameHeight, crops }));

export async function normalizeWorld04Obstacles({ check = false } = {}) {
  for (const c of obstacleCrops) {
    const frames = [];
    for (const [i, crop] of c.crops.entries()) {
      const [left, top, width, height, outputHeight = c.frameHeight] = crop;
      const input = await sharp(path.join(root, c.sourcePath)).extract({ left, top, width, height })
        .resize(c.frameWidth, outputHeight, { fit: 'fill', kernel: 'nearest' }).ensureAlpha().png().toBuffer();
      frames.push({ input, left: i * c.frameWidth, top: c.frameHeight - outputHeight });
    }
    const output = await sharp({ create: { width: c.frameWidth * c.crops.length, height: c.frameHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(frames).png().toBuffer();
    const target = path.join(root, 'public/assets/pixel/objects/world-04', `world-04-scrapyard-${c.name}.png`);
    if (check) { if (!output.equals(await readFile(target))) throw new Error(`Generated asset differs: ${target}`); }
    else { await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, output); }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await normalizeWorld04Obstacles({ check: process.argv.includes('--check') });
  console.log('World 4 obstacles: 14 assets verified.');
}
