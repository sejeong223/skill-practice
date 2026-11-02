import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import { backgroundCrops } from './build-world04-backgrounds.mjs';
const manifest = JSON.parse(await readFile('src/game/assets/assetManifest.json', 'utf8'));
test('nine required image assets have correct dimensions, distinct backgrounds and transparent gameplay', async () => {
  const hashes = new Set();
  for (const c of backgroundCrops) {
    const key = `world-04-scrapyard-${c.name}`, entries = manifest.filter(a => a.key === key);
    assert.equal(entries.length, 1); const a = entries[0];
    assert.equal(a.required, true); assert.equal(a.kind, 'image'); assert.equal(a.worldId, 'world-04');
    const buffer = await readFile(`public${a.url}`), { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, c.outputWidth); assert.equal(info.height, c.name.startsWith('mid-') ? 720 : c.outputHeight);
    if (c.name.startsWith('mid-')) { hashes.add(buffer.toString('base64')); assert.ok(data.some((v, i) => i % 4 === 3 && v === 0)); }
    if (c.name === 'far' || c.folder === 'tiles') assert.ok(data.every((v, i) => i % 4 !== 3 || v === 255));
    if (c.name === 'foreground') for (let y = 120; y <= 548; y++) for (let x = 0; x < info.width; x++) assert.equal(data[(y * info.width + x) * 4 + 3], 0);
    if (c.name === 'floor') for (let y = 0; y < info.height; y++) assert.deepEqual(data.subarray(y * 128 * 4, y * 128 * 4 + 4), data.subarray((y * 128 + 127) * 4, (y * 128 + 128) * 4));
  }
  assert.equal(hashes.size, 4);
  assert.equal(manifest.filter(a => /world-04-scrapyard-(collapse|armed-rise)/.test(a.key)).length, 0);
});
