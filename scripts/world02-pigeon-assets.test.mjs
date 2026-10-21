import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetDir = path.join(root, 'public/assets/pixel/props/world-02');
const manifest = JSON.parse(await readFile(path.join(root, 'src/game/assets/assetManifest.json'), 'utf8'));

const specs = [
  { name: 'pigeon-fly', key: 'world-02-pigeon-fly', width: 240, height: 56, kind: 'spritesheet' },
  { name: 'pigeon-dropping', key: 'world-02-pigeon-dropping', width: 24, height: 32, kind: 'image' },
  { name: 'pigeon-splat', key: 'world-02-pigeon-splat', width: 40, height: 16, kind: 'image' },
];

test('월드 2 비둘기·낙하 똥·착지 자국은 정확한 필수 에셋으로 등록된다', () => {
  for (const { name, key, kind } of specs) {
    const entries = manifest.filter(entry => entry.key === key);
    assert.equal(entries.length, 1, key);
    assert.deepEqual(entries[0], {
      key,
      kind,
      url: `/assets/pixel/props/world-02/${name}.png`,
      ...(kind === 'spritesheet' ? { frameWidth: 80, frameHeight: 56, frameCount: 3 } : {}),
      worldId: 'world-02',
      required: true,
    });
  }
});

for (const { name, width, height } of specs) {
  test(`${name}: 실제 게임 크기와 투명 여백`, async () => {
    const bytes = await readFile(path.join(assetDir, `${name}.png`));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, height);
    assert.equal(metadata.hasAlpha, true);
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alpha = (x, y) => data[(y * info.width + x) * 4 + 3];
    for (const [x, y] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]) {
      assert.equal(alpha(x, y), 0, `${name} corner must be transparent`);
    }
    let filled = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 127) filled++;
    assert.ok(filled >= 20, `${name} must contain visible pixels`);
  });
}

test('세 비행 프레임은 서로 다르고, 부리 위치가 왼쪽에 고정된다', async () => {
  const bytes = await readFile(path.join(assetDir, 'pigeon-fly.png'));
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const hashes = [];
  for (let frame = 0; frame < 3; frame++) {
    const pixels = [];
    let filled = 0;
    let leftBeak = 0;
    let rightBeak = 0;
    for (let y = 0; y < 56; y++) {
      for (let x = 0; x < 80; x++) {
        const offset = (y * info.width + frame * 80 + x) * 4;
        const rgba = data.subarray(offset, offset + 4);
        pixels.push(...rgba);
        if (rgba[3] > 127) filled++;
        const orange = rgba[3] > 127 && rgba[0] > 150 && rgba[1] > 70 && rgba[1] < 190 && rgba[2] < 100;
        if (orange && y < 28 && x < 28) leftBeak++;
        if (orange && y < 28 && x >= 52) rightBeak++;
      }
    }
    assert.ok(filled > 500, `frame ${frame} is visible at 1x`);
    assert.ok(leftBeak > 2, `frame ${frame} has a left-facing beak`);
    assert.equal(rightBeak, 0, `frame ${frame} must not face right`);
    hashes.push(createHash('sha256').update(Buffer.from(pixels)).digest('hex'));
  }
  assert.equal(new Set(hashes).size, 3);
});
