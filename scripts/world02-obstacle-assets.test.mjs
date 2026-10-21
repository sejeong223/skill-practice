import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const specs = [
  ['duck-spring', 80, 64],
  ['elephant-spring', 88, 68],
  ['rabbit-spring', 80, 68],
  ['pink-sand-shovel', 40, 56],
  ['orange-traffic-cone', 48, 52],
  ['sleeping-fat-cat', 96, 56],
  ['scratching-fat-cat', 96, 56],
  ['crushed-cola-can', 40, 28],
  ['empty-snack-bag', 80, 84],
];

const manifest = JSON.parse(await readFile(path.join(root, 'src/game/assets/assetManifest.json'), 'utf8'));
const manifestKeys = manifest.map(({ key }) => key);

test('월드 2 장애물 9개를 필수 이미지로 한 번씩 등록한다', () => {
  assert.equal(new Set(manifestKeys).size, manifestKeys.length);
  for (const [name] of specs) {
    const key = `world-02-obstacle-${name}`;
    const entries = manifest.filter((entry) => entry.key === key);
    assert.equal(entries.length, 1, key);
    assert.deepEqual(entries[0], {
      key,
      kind: 'image',
      url: `/assets/pixel/props/world-02/${name === 'empty-snack-bag' ? 'empty-snack-bag-ground' : name}.png`,
      worldId: 'world-02',
      required: true,
    });
  }
});

for (const [name, width, height] of specs) {
  test(`${name}: 게임 크기, 투명 여백, 바닥 기준 확인`, async () => {
    const imagePath = path.join(root, 'public/assets/pixel/props/world-02', `${name}.png`);
    const bytes = await readFile(imagePath);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, height);
    assert.equal(metadata.hasAlpha, true);

    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alpha = (x, y) => data[(y * info.width + x) * 4 + 3];
    assert.equal(alpha(0, 0), 0);
    assert.equal(alpha(width - 1, 0), 0);
    assert.equal(alpha(0, height - 1), 0);
    assert.equal(alpha(width - 1, height - 1), 0);

    let filled = 0;
    let lowest = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (alpha(x, y) > 127) { filled++; lowest = y; }
      }
    }
    assert.ok(filled >= width * height * 0.07, `${name} silhouette is too sparse`);
    assert.ok(filled < width * height * 0.85, `${name} has too little transparent space`);
    assert.ok(lowest >= height - 3 && lowest <= height - 1, `${name} bottom alignment`);
  });
}

test('고양이의 잠든 포즈와 할퀴는 포즈가 다른 이미지다', async () => {
  const base = path.join(root, 'public/assets/pixel/props/world-02');
  const sleeping = await readFile(path.join(base, 'sleeping-fat-cat.png'));
  const scratching = await readFile(path.join(base, 'scratching-fat-cat.png'));
  assert.notDeepEqual(sleeping, scratching);
});

test('과자 봉지는 흰 윗부분·빨간 로고·파란 하단·감자칩과 포카칩 글자가 구분된다', async () => {
  const bytes = await readFile(path.join(root, 'public/assets/pixel/props/world-02/empty-snack-bag.png'));
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let blue = 0;
  let lettering = 0;
  let whiteTop = 0;
  let redLogo = 0;
  let yellowChips = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const index = (y * info.width + x) * 4;
      const [r, g, b, a] = data.subarray(index, index + 4);
      if (a < 200) continue;
      if (b > r * 1.8 && b > g * 1.15) blue++;
      if (x >= 19 && x <= 61 && y >= 22 && y <= 39 && r > 190 && g > 160 && b > 135) lettering++;
      if (y < 22 && r > 190 && g > 170 && b > 140) whiteTop++;
      if (y > 10 && y < 43 && r > 150 && g < 95 && b < 115) redLogo++;
      if (y > 43 && r > 180 && g > 120 && b < 120) yellowChips++;
    }
  }
  assert.ok(blue > 900, 'blue lower bag surface should remain visible');
  assert.ok(lettering > 45, 'the cream-colored Korean label should be visible');
  assert.ok(whiteTop > 300, 'the pale sealed top should be visible');
  assert.ok(redLogo > 350, 'the red central logo should be visible');
  assert.ok(yellowChips > 300, 'the golden potato chips should be visible');
});

