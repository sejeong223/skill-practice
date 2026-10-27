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

test('월드 3 구역과 보스 중경은 같은 크기와 투명 하늘, 반복 경계를 가진다', async () => {
  for (const stage of ['1', '2', '3', '4', 'boss']) {
    const image = await imageData(`backgrounds/world-03/world-03-mid-${stage}.png`);
    assert.deepEqual([image.width, image.height], [1672, 941], stage);
    assert.equal(pixel(image, 800, 0)[3], 0, `${stage} sky`);
    assert.ok(pixel(image, 800, 610)[3] > 0, `${stage} site structures`);
    for (const x of [100, 800, 1500]) {
      assert.ok(pixel(image, x, 660)[3] >= 128, `${stage} floor overlap at x=${x}`);
    }
    assert.ok(pixel(image, 0, 660)[3] >= 128, `${stage} repeated fence joint`);
    for (let y = 0; y < image.height; y++) {
      assert.deepEqual(pixel(image, 0, y), pixel(image, image.width - 1, y), `${stage} seam at y=${y}`);
    }
  }
});

test('월드 3 장애물 네 종류는 기존 판정 안에 보이는 그림과 바닥 접점을 가진다', async () => {
  const contracts = [
    ['traffic-cone', 32, 40, 23, 34],
    ['brick-stack', 36, 35, 34, 29],
    ['cement-bag', 34, 36, 29, 32],
    ['steel-pipe', 40, 30, 37, 23],
  ];
  for (const [kind, width, height, hitboxWidth, hitboxHeight] of contracts) {
    const image = await imageData(`objects/world-03/${kind}.png`);
    assert.deepEqual([image.width, image.height], [width, height], kind);
    let left = width, right = -1, top = height, bottom = -1;
    const colors = new Set();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const [red, green, blue, alpha] = pixel(image, x, y);
        if (alpha < 128) continue;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
        colors.add(`${red},${green},${blue}`);
      }
    }
    assert.ok(right >= left && bottom >= top, `${kind} visible`);
    assert.ok(right - left + 1 <= hitboxWidth, `${kind} width`);
    assert.ok(bottom - top + 1 <= hitboxHeight, `${kind} height`);
    assert.ok(Math.abs((left + right) / 2 - (width - 1) / 2) <= 1, `${kind} centered`);
    assert.ok(bottom >= height - 2, `${kind} ground contact`);
    assert.ok(colors.size >= 8, `${kind} color detail`);
  }
});

test('월드 3 새 위험물 세 종류는 투명 여백과 판정 크기를 지킨다', async () => {
  const contracts = [
    ['cable-drum', 48, 48, 42, 42],
    ['wheelbarrow', 56, 44, 52, 40],
    ['falling-steel-beam', 64, 28, 56, 20],
  ];
  for (const [kind, width, height, hitboxWidth, hitboxHeight] of contracts) {
    const artwork = await imageData(`objects/world-03/${kind}.png`);
    assert.deepEqual([artwork.width, artwork.height], [width, height], kind);
    assert.equal(pixel(artwork, 0, 0)[3], 0, `${kind} transparent corner`);
    assert.equal(pixel(artwork, width - 1, height - 1)[3], 0, `${kind} transparent corner`);
    let left = width, right = -1, top = height, bottom = -1;
    const colors = new Set();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const [red, green, blue, alpha] = pixel(artwork, x, y);
        if (alpha < 128) continue;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
        colors.add(`${red},${green},${blue}`);
      }
    }
    assert.ok(right >= left && bottom >= top, `${kind} visible`);
    assert.ok(right - left + 1 <= hitboxWidth, `${kind} hitbox width`);
    assert.ok(bottom - top + 1 <= hitboxHeight, `${kind} hitbox height`);
    assert.ok(Math.abs((left + right) / 2 - (width - 1) / 2) <= 1, `${kind} centered`);
    if (kind === 'wheelbarrow') assert.ok(bottom >= height - 2, 'wheel touches ground');
    assert.ok(colors.size >= 8, `${kind} color detail`);
  }
});

test('월드 3 공통 이미지의 기존 manifest 키와 필수 로드 계약을 유지한다', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'src/game/assets/assetManifest.json'), 'utf8'));
  const expected = new Map([
    ['world-03-background-far', '/assets/pixel/backgrounds/world-03/world-03-far.png'],
    ['world-03-foreground', '/assets/pixel/backgrounds/world-03/world-03-foreground.png'],
    ['world-03-construction-floor', '/assets/pixel/tiles/world-03/world-03-construction-floor.png'],
    ...['1', '2', '3', '4', 'boss'].map((stage) => [
      `world-03-background-mid-${stage}`,
      `/assets/pixel/backgrounds/world-03/world-03-mid-${stage}.png`,
    ]),
  ]);
  for (const [key, url] of expected) {
    const asset = manifest.find((entry) => entry.key === key);
    assert.ok(asset, key);
    assert.equal(asset.url, url);
    assert.equal(asset.required, true);
  }
});

test('월드 3 새 위험물 키는 필수 PNG이고 지상 카탈로그에는 두 장애물만 포함된다', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'src/game/assets/assetManifest.json'), 'utf8'));
  for (const kind of ['cable-drum', 'wheelbarrow', 'falling-steel-beam']) {
    const key = `world-03-${kind}`;
    const entries = manifest.filter((entry) => entry.key === key);
    assert.equal(entries.length, 1, key);
    assert.deepEqual(entries[0], {
      key,
      kind: 'image',
      url: `/assets/pixel/objects/world-03/${kind}.png`,
      worldId: 'world-03',
      required: true,
    });
  }
  const themes = await readFile(path.join(root, 'src/game/data/worldMaps.ts'), 'utf8');
  const catalog = themes.match(/createTheme\("world-03", "world-03-tileset", \[([^\]]+)\]/)?.[1] ?? '';
  assert.match(catalog, /world-03-cable-drum/);
  assert.match(catalog, /world-03-wheelbarrow/);
  assert.doesNotMatch(catalog, /world-03-falling-steel-beam/);
});
