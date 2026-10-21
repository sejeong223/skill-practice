import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public/assets/pixel/characters/world-02/cheese-tabby-boss.svg');
const spriteSheet = path.join(root, 'public/assets/pixel/characters/world-02/cheese-tabby-boss.png');
const preview = path.join(root, '.memory/reviews/2026-10-21-cheese-tabby-boss-preview.png');

export async function renderSpriteSheet(svgBytes) {
  const metadata = await sharp(svgBytes).metadata();
  assert.equal(metadata.width, 512, 'sprite source width');
  assert.equal(metadata.height, 128, 'sprite source height');
  return sharp(svgBytes).png({ compressionLevel: 9 }).toBuffer();
}

export async function renderPreview(pngBytes) {
  const enlarged = await sharp(pngBytes)
    .resize(2048, 512, { kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: 2048,
      height: 512,
      channels: 4,
      background: '#F5E7C7',
    },
  })
    .composite([{ input: enlarged, left: 0, top: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  const svgBytes = await readFile(source);
  const outputs = [
    [spriteSheet, await renderSpriteSheet(svgBytes)],
  ];
  outputs.push([preview, await renderPreview(outputs[0][1])]);

  if (process.argv.includes('--check')) {
    for (const [destination, bytes] of outputs) {
      const saved = await readFile(destination);
      assert.deepEqual(saved, bytes, `${path.relative(root, destination)} is out of sync`);
    }
    return;
  }

  for (const [destination, bytes] of outputs) {
    await writeFile(destination, bytes);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
