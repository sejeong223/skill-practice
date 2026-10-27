import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetPath = (relativePath) => path.join(root, 'public/assets/pixel', relativePath);

async function imageData(relativePath) {
  const { data, info } = await sharp(assetPath(relativePath))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function pixel(image, x, y) {
  return [...image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)];
}

test('월드 3 원경은 오후 하늘을 채우고 좌우 반복 경계가 이어진다', async () => {
  const image = await imageData('backgrounds/world-03/world-03-far.png');
  assert.deepEqual([image.width, image.height], [1672, 941]);
  for (let y = 0; y < image.height; y++) {
    assert.equal(pixel(image, 0, y)[3], 255);
    assert.deepEqual(pixel(image, 0, y), pixel(image, image.width - 1, y), `far seam at y=${y}`);
  }
  const sky = pixel(image, Math.floor(image.width / 2), 30);
  assert.ok(sky[2] > sky[0] && sky[2] > sky[1], '하늘은 파란색 계열이어야 한다');
});

test('월드 3 전경은 코기 위를 가리지 않고 하단에서만 반복된다', async () => {
  const image = await imageData('backgrounds/world-03/world-03-foreground.png');
  assert.deepEqual([image.width, image.height], [1672, 941]);
  for (let y = 0; y < 860; y++) {
    for (let x = 0; x < image.width; x++) {
      assert.equal(image.data[(y * image.width + x) * 4 + 3], 0, `foreground at ${x},${y}`);
    }
  }
  assert.ok(pixel(image, Math.floor(image.width / 2), 900)[3] > 0);
  for (let y = 860; y < image.height; y++) {
    assert.deepEqual(pixel(image, 0, y), pixel(image, image.width - 1, y), `foreground seam at y=${y}`);
  }
});

test('월드 3 바닥 텍스처는 충돌 표면에 맞는 크기로 이어진다', async () => {
  const image = await imageData('tiles/world-03/world-03-construction-floor.png');
  assert.deepEqual([image.width, image.height], [128, 216]);
  for (let y = 0; y < image.height; y++) {
    assert.deepEqual(pixel(image, 0, y), pixel(image, image.width - 1, y), `floor seam at y=${y}`);
  }
  assert.ok(pixel(image, 64, 10)[3] > 0);
});

test('월드 3 공통 이미지의 기존 manifest 키와 필수 로드 계약을 유지한다', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'src/game/assets/assetManifest.json'), 'utf8'));
  const expected = new Map([
    ['world-03-background-far', '/assets/pixel/backgrounds/world-03/world-03-far.png'],
    ['world-03-foreground', '/assets/pixel/backgrounds/world-03/world-03-foreground.png'],
    ['world-03-construction-floor', '/assets/pixel/tiles/world-03/world-03-construction-floor.png'],
  ]);
  for (const [key, url] of expected) {
    const asset = manifest.find((entry) => entry.key === key);
    assert.ok(asset, key);
    assert.equal(asset.url, url);
    assert.equal(asset.required, true);
  }
});
