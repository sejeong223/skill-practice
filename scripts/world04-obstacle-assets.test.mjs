import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import { obstacleCrops } from './build-world04-obstacles.mjs';
const manifest = JSON.parse(await readFile('src/game/assets/assetManifest.json', 'utf8'));
test('fourteen distinct required assets, frame dimensions, transparency and nonempty foot/center anchors', async () => {
  for (const c of obstacleCrops) {
    const found = manifest.filter(a => a.key === `world-04-scrapyard-${c.name}`);
    assert.equal(found.length, 1); const a = found[0];
    assert.equal(a.required, true); assert.equal(a.worldId, 'world-04');
    assert.equal(a.kind, c.crops.length > 1 ? 'spritesheet' : 'image');
    const image = sharp(`public${a.url}`), m = await image.metadata();
    assert.equal(m.width, c.frameWidth * c.crops.length); assert.equal(m.height, c.frameHeight); assert.equal(m.hasAlpha, true);
    if (c.crops.length > 1) { assert.equal(a.frameWidth, c.frameWidth); assert.equal(a.frameHeight, c.frameHeight); assert.equal(a.frameCount, c.crops.length); }
    const frames = [];
    for (let frame = 0; frame < c.crops.length; frame++) {
      const data = await image.clone().extract({ left: frame * c.frameWidth, top: 0, width: c.frameWidth, height: c.frameHeight }).ensureAlpha().raw().toBuffer();
      assert.ok(data.some((v, i) => i % 4 === 3 && v > 128), `${c.name} frame ${frame} blank`);
      assert.ok(data.some((v, i) => i % 4 === 3 && v === 0), `${c.name} missing transparency`);
      assert.ok(data.subarray(Math.floor(data.length / 2)).some((v, i) => i % 4 === 3 && v > 128), c.name);
      frames.push(data.toString('base64'));
      if (c.name === 'saw' || c.name === 'swing') for (const i of [3, c.frameWidth * 4 - 1, data.length - 1, data.length - c.frameWidth * 4 + 3]) assert.ok(data[i] < 128);
    }
    assert.equal(new Set(frames).size, c.crops.length, `${c.name} duplicated frames`);
  }
});
