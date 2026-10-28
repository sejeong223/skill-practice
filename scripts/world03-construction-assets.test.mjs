import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { WORLD03_TAPERED_HITBOXES } from '../src/game/data/world03Construction.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'src/game/assets/assetManifest.json'), 'utf8'));
const expected = [
  ['world-03-background-far', 1672, 941],
  ...[1, 2, 3, 4, 'boss'].map(index => [`world-03-background-mid-${index}`, 1672, 941]),
  ['world-03-foreground', 1672, 941],
  ['world-03-construction-floor', 128, 216],
  ['world-03-tileset', 64, 32],
  ['world-03-traffic-cone', 32, 40],
  ['world-03-brick-stack', 36, 35],
  ['world-03-cement-bag', 34, 36],
  ['world-03-steel-pipe', 40, 30],
  ['world-03-drum-barrel', 48, 48],
  ['world-03-wheelbarrow', 56, 44],
  ['world-03-falling-steel-beam', 64, 28],
];

test('construction art is registered once as real required PNG assets', async () => {
  assert.equal(new Set(manifest.map(({key}) => key)).size, manifest.length);
  for (const [key, width, height] of expected) {
    const item = manifest.find(entry => entry.key === key);
    assert.ok(item, key);
    assert.equal(item.kind, 'image', key);
    assert.equal(item.required, true, key);
    assert.equal(item.worldId, 'world-03');
    assert.ok(item.url.startsWith('/assets/pixel/') && item.url.endsWith('.png'), `${key} URL`);
    const bytes = await readFile(path.join(root, 'public', item.url));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, height);
  }
});

test('each construction area has different pixels and every obstacle has a visible silhouette', async () => {
  const images = await Promise.all([1, 2, 3, 4].map(index => readFile(path.join(root, `public/assets/pixel/backgrounds/world-03/world-03-mid-${index}.png`))));
  assert.equal(new Set(images.map(bytes => bytes.toString('base64'))).size, 4);
  for (const name of ['traffic-cone', 'brick-stack', 'cement-bag', 'steel-pipe', 'drum-barrel', 'wheelbarrow', 'falling-steel-beam']) {
    const file = path.join(root, `public/assets/pixel/objects/world-03/${name}.png`);
    const {data, info} = await sharp(await readFile(file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let visible = 0;
    for (let p = 3; p < data.length; p += 4) if (data[p] > 127) visible++;
    assert.ok(visible > info.width * info.height * .08, `${name} must be identifiable`);
    assert.equal(data[3], 0, `${name} has transparent corners`);
  }
});

test('cone and cement collision bands match each PNG silhouette at every height', async () => {
  for (const [kind, profile] of Object.entries(WORLD03_TAPERED_HITBOXES)) {
    const file = path.join(root, `public/assets/pixel/objects/world-03/${kind}.png`);
    const {data, info} = await sharp(await readFile(file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(profile.sourceWidth, info.width, `${kind} source width`);
    assert.equal(profile.sourceHeight, info.height, `${kind} source height`);
    assert.equal(profile.bands.length, 4, `${kind} band count`);

    let previousBottom = profile.bands[0].top;
    for (const band of profile.bands) {
      assert.equal(band.top, previousBottom, `${kind} vertical bands must touch`);
      assert.ok(band.left >= 0 && band.right <= info.width && band.left < band.right, kind);
      assert.ok(band.top >= 0 && band.bottom <= info.height && band.top < band.bottom, kind);
      let left = info.width;
      let right = 0;
      let top = info.height;
      let bottom = 0;
      for (let y = band.top; y < band.bottom; y++) {
        for (let x = 0; x < info.width; x++) {
          if (data[(y * info.width + x) * info.channels + 3] === 0) continue;
          left = Math.min(left, x);
          right = Math.max(right, x + 1);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y + 1);
        }
      }
      assert.deepEqual({left, top, right, bottom}, band, `${kind} alpha bounds`);
      previousBottom = band.bottom;
    }
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * info.channels + 3] === 0) continue;
        assert.ok(profile.bands.some(band =>
          x >= band.left && x < band.right && y >= band.top && y < band.bottom),
        `${kind} opaque pixel outside collision bands: ${x},${y}`);
      }
    }
  }
});
