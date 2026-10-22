import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'src/game/assets/assetManifest.json'), 'utf8'));
const expected = [
  ['world-03-background-far', 960, 720],
  ...[1, 2, 3, 4].map(index => [`world-03-background-mid-${index}`, 960, 720]),
  ['world-03-foreground', 960, 720],
  ['world-03-construction-floor', 128, 216],
  ['world-03-tileset', 64, 32],
  ['world-03-traffic-cone', 32, 40],
  ['world-03-brick-stack', 36, 35],
  ['world-03-cement-bag', 34, 36],
  ['world-03-steel-pipe', 40, 30],
];

test('construction art is registered once as real required PNG assets', async () => {
  assert.equal(new Set(manifest.map(({key}) => key)).size, manifest.length);
  for (const [key, width, height] of expected) {
    const item = manifest.find(entry => entry.key === key);
    assert.ok(item, key);
    assert.equal(item.required, true, key);
    assert.equal(item.worldId, 'world-03');
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
  for (const name of ['traffic-cone', 'brick-stack', 'cement-bag', 'steel-pipe']) {
    const file = path.join(root, `public/assets/pixel/objects/world-03/${name}.png`);
    const {data, info} = await sharp(await readFile(file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let visible = 0;
    for (let p = 3; p < data.length; p += 4) if (data[p] > 127) visible++;
    assert.ok(visible > info.width * info.height * .08, `${name} must be identifiable`);
    assert.equal(data[3], 0, `${name} has transparent corners`);
  }
});
