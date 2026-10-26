import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { advanceCheeseBall, sweptCheeseBallBounds } from '../src/game/systems/cheeseTabbyBallPhysics.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('rubber ball asset is a required transparent 32px pixel image', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'src/game/assets/assetManifest.json'), 'utf8'));
  const entry = manifest.find(({key}) => key === 'world-02-boss-rubber-ball');
  assert.ok(entry);
  assert.equal(entry.required, true);
  const {data, info} = await sharp(await readFile(path.join(root, 'public', entry.url)))
    .ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width, 32);
  assert.equal(info.height, 32);
  assert.equal(data[3], 0);
  assert.equal(data[(16 * 32 + 16) * 4 + 3], 255);
});

test('ball arcs toward the ground, bounces once, then disappears on the next ground contact', () => {
  let motion = {x: 1238, y: 484, vx: -330, vy: -420, bounces: 0, ageMs: 0};
  let bounceCount = 0;
  let frames = 0;
  while (motion && frames++ < 190) {
    const next = advanceCheeseBall(motion, 16);
    if (next?.bounces === 1 && motion.bounces === 0) bounceCount++;
    motion = next;
  }
  assert.equal(bounceCount, 1);
  assert.equal(motion, null);
  assert.ok(frames < 188);
});

test('swept hitbox spans previous and new positions so fast frames do not tunnel', () => {
  const initial = {x: 200, y: 400, vx: 440, vy: 0, bounces: 0, ageMs: 0};
  const next = advanceCheeseBall(initial, 50);
  assert.ok(next);
  const bounds = sweptCheeseBallBounds(initial, next);
  assert.equal(bounds.x, 188);
  assert.ok(bounds.width >= 44);
  assert.equal(bounds.height >= 24, true);
  assert.equal(advanceCheeseBall({...initial, ageMs: 2990}, 20), null);
});
