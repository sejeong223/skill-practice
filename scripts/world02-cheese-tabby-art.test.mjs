import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sheetPath = path.join(root, 'public/assets/pixel/characters/world-02/cheese-tabby-boss.png');
const previewPath = path.join(root, '.memory/reviews/2026-10-21-cheese-tabby-boss-preview.png');

test('치즈 태비 네 프레임은 투명한 128픽셀 픽셀아트이고 자세가 서로 다르다', async () => {
  const bytes = await readFile(sheetPath);
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 128);
  assert.equal(metadata.hasAlpha, true);

  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  const colors = new Set();
  const signatures = new Set();

  for (const frameStart of [0, 128, 256, 384]) {
    let opaque = 0;
    let lowest = -1;
    const frameBytes = Buffer.alloc(128 * 128 * 4);

    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const offset = (y * info.width + frameStart + x) * 4;
        const destination = (y * 128 + x) * 4;
        const [red, green, blue, alpha] = data.subarray(offset, offset + 4);
        data.copy(frameBytes, destination, offset, offset + 4);
        assert.ok(alpha === 0 || alpha === 255, `soft edge at frame ${frameStart / 128}, ${x},${y}`);
        if (x === 0 || x === 127) assert.equal(alpha, 0, `frame ${frameStart / 128} border`);
        if (alpha === 0) continue;
        opaque++;
        lowest = y;
        colors.add(`${red},${green},${blue}`);
      }
    }

    assert.ok(opaque > 1200, `frame ${frameStart / 128} silhouette is too sparse`);
    assert.ok(opaque < 10000, `frame ${frameStart / 128} has too little transparent space`);
    assert.ok(lowest >= 118 && lowest <= 123, `frame ${frameStart / 128} feet are misaligned`);
    signatures.add(createHash('sha256').update(frameBytes).digest('hex'));
  }

  assert.equal(signatures.size, 4, 'all four poses must be distinct');
  assert.ok(colors.size <= 24, `palette has ${colors.size} opaque colors`);
});

test('확대 미리보기는 네 프레임을 네 배 크기로 보여준다', async () => {
  const metadata = await sharp(await readFile(previewPath)).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 2048);
  assert.equal(metadata.height, 512);
});
