import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prefix = 'world-04-scrapyard-';
export const backgroundCrops = [
  ['far', 0, 0, 1672, 941, 1280, 720, 'backgrounds'],
  ['mid-1', 0, 0, 1671, 728, 1920, 504, 'backgrounds'],
  ['mid-2', 0, 0, 1672, 744, 1920, 504, 'backgrounds'],
  ['mid-3', 0, 0, 1672, 762, 1920, 504, 'backgrounds'],
  ['mid-4', 0, 0, 1672, 684, 1920, 504, 'backgrounds'],
  ['foreground', 0, 0, 1672, 941, 1280, 720, 'backgrounds'],
  ['floor', 80, 424, 512, 432, 128, 216, 'tiles'],
  ['platform', 654, 516, 540, 84, 128, 24, 'tiles'],
  ['rise-column', 1248, 148, 212, 712, 112, 320, 'tiles'],
].map(([name, left, top, width, height, outputWidth, outputHeight, folder]) => ({
  name, sourcePath: `art/source/world04-scrapyard-${folder === 'tiles' ? 'terrain-sheet' : name}.png`,
  left, top, width, height, outputWidth, outputHeight, folder,
}));

export async function normalizeWorld04Backgrounds({ check = false } = {}) {
  for (const c of backgroundCrops) {
    const source = path.join(root, c.sourcePath);
    let pipeline = sharp(source).extract({ left: c.left, top: c.top, width: c.width, height: c.height })
      .resize(c.outputWidth, c.outputHeight, { fit: 'fill', kernel: 'nearest' }).ensureAlpha();
    if (c.name.startsWith('mid-')) pipeline = pipeline.extend({ top: 0, bottom: 216, left: 0, right: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } });
    let { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
    if (c.folder === 'tiles' || c.name === 'far') {
      for (let p = 3; p < data.length; p += 4) data[p] = 255;
    }
    if (c.name === 'foreground') {
      for (let y = 120; y <= 548; y++) for (let x = 0; x < info.width; x++) data[(y * info.width + x) * 4 + 3] = 0;
    }
    // Reflect the generated texture at its midpoint so adjacent floor tiles share an exact edge.
    if (c.name === 'floor') {
      for (let y = 0; y < info.height; y++) for (let x = 64; x < 128; x++) {
        data.copy(data, (y * 128 + x) * 4, (y * 128 + 127 - x) * 4, (y * 128 + 128 - x) * 4);
      }
    }
    const output = await sharp(data, { raw: info }).png().toBuffer();
    const target = path.join(root, 'public/assets/pixel', c.folder, 'world-04', `${prefix}${c.name}.png`);
    if (check) {
      if (!output.equals(await readFile(target))) throw new Error(`Generated asset differs: ${target}`);
    } else { await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, output); }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await normalizeWorld04Backgrounds({ check: process.argv.includes('--check') });
  console.log('World 4 backgrounds: 9 assets verified.');
}
