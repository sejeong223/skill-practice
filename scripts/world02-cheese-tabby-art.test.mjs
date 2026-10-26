import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sheetPath = path.join(root, 'public/assets/pixel/characters/world-02/cheese-tabby-boss.png');
const previewPath = path.join(root, '.memory/reviews/2026-10-26-cheese-tabby-boss-preview.png');

function getOpaqueBounds(data, imageWidth, frameStart, alphaThreshold = 16) {
  let left = 96;
  let top = 96;
  let right = -1;
  let bottom = -1;
  let pixels = 0;
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 96; x++) {
      if (data[(y * imageWidth + frameStart + x) * 4 + 3] <= alphaThreshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = y;
      pixels++;
    }
  }
  return { left, top, right, bottom, pixels };
}

test('치즈 태비 네 자세는 투명한 96픽셀 시트에서 같은 발밑선을 공유한다', async () => {
  const bytes = await readFile(sheetPath);
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 384);
  assert.equal(metadata.height, 96);
  assert.equal(metadata.hasAlpha, true);

  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  const signatures = new Set();

  for (const frameStart of [0, 96, 192, 288]) {
    const frameBytes = Buffer.alloc(96 * 96 * 4);

    for (let y = 0; y < 96; y++) {
      for (let x = 0; x < 96; x++) {
        const offset = (y * info.width + frameStart + x) * 4;
        const destination = (y * 96 + x) * 4;
        data.copy(frameBytes, destination, offset, offset + 4);
        if (x === 0 || x === 95 || y === 0 || y === 95) {
          assert.equal(data[offset + 3], 0, `frame ${frameStart / 96} border at ${x},${y}`);
        }
      }
    }

    const bounds = getOpaqueBounds(data, info.width, frameStart);
    assert.ok(bounds.pixels > 1800 && bounds.pixels < 4500, `frame ${frameStart / 96} silhouette`);
    assert.ok(bounds.left >= 2 && bounds.right <= 94, `frame ${frameStart / 96} width`);
    assert.ok(bounds.bottom >= 78 && bounds.bottom <= 80, `frame ${frameStart / 96} ground line`);
    const expectedTop = frameStart === 288 ? [40, 48] : [17, 23];
    assert.ok(bounds.top >= expectedTop[0] && bounds.top <= expectedTop[1], `frame ${frameStart / 96} height`);
    signatures.add(createHash('sha256').update(frameBytes).digest('hex'));
  }

  assert.equal(signatures.size, 4, 'all four poses must be distinct');
});

test('확대 미리보기는 네 프레임을 네 배 크기로 보여준다', async () => {
  const metadata = await sharp(await readFile(previewPath)).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 1536);
  assert.equal(metadata.height, 384);
});
