import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'assets/character-source/world-02/cheese-tabby-boss-source.png');
const spriteSheet = path.join(root, 'public/assets/pixel/characters/world-02/cheese-tabby-boss.png');
const preview = path.join(root, '.memory/reviews/2026-10-26-cheese-tabby-boss-preview.png');

export async function renderSpriteSheet(pngBytes) {
  const metadata = await sharp(pngBytes).metadata();
  assert.equal(metadata.format, 'png', 'sprite source format');
  assert.equal(metadata.width, 384, 'sprite source width');
  assert.equal(metadata.height, 96, 'sprite source height');
  assert.equal(metadata.hasAlpha, true, 'sprite source transparency');
  const { data, info } = await sharp(pngBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < info.height; y++) {
    for (const frameStart of [0, 96, 192, 288]) {
      assert.equal(data[(y * info.width + frameStart) * 4 + 3], 0, 'left frame border');
      assert.equal(data[(y * info.width + frameStart + 95) * 4 + 3], 0, 'right frame border');
    }
  }
  return sharp(pngBytes).png({ compressionLevel: 9 }).toBuffer();
}

export async function renderPreview(pngBytes) {
  const enlarged = await sharp(pngBytes)
    .resize(1536, 384, { kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: 1536,
      height: 384,
      channels: 4,
      background: '#F5E7C7',
    },
  })
    .composite([{ input: enlarged, left: 0, top: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  const pngBytes = await readFile(source);
  const outputs = [
    [spriteSheet, await renderSpriteSheet(pngBytes)],
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
