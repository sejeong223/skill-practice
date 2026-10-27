import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import {
  getWorld03CoinPositions,
  getWorld03CollapseZones,
  getWorld03Obstacles,
} from '../src/game/data/world03Construction.ts';
import {
  getWorld03SteelBeamDefinitions,
  WORLD03_STEEL_BEAM_HITBOX_WIDTH,
  WORLD03_STEEL_BEAM_SPEED_PX_PER_SECOND,
} from '../src/game/data/world03SteelBeams.ts';
import { sweptAabbOverlap } from '../src/game/systems/world03SteelBeamCollision.ts';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename },
).outputText, filename);
const { World03SteelBeamDropSystem } = require('../src/game/systems/World03SteelBeamDropSystem.ts');

function createHarness(stageId = 'world-03-stage-3') {
  const images = [];
  const events = [];
  const player = {
    body: { left: 60, right: 132, top: 464, bottom: 504, velocity: { x: 0 } },
    setVelocityX(value) { this.body.velocity.x = value; },
  };
  let canHandleContact = true;
  let backpedaling = false;
  const scene = {
    time: { now: 4321 },
    add: {
      image(x, y, key) {
        const sprite = {
          x, y, key, destroyed: false,
          setOrigin() { return this; },
          setDepth(depth) { this.depth = depth; return this; },
          setY(nextY) { this.y = nextY; return this; },
          destroy() { this.destroyed = true; },
        };
        images.push(sprite);
        return sprite;
      },
    },
  };
  const system = new World03SteelBeamDropSystem(
    scene, player, { emit: (name, payload) => events.push({ name, payload }) }, stageId,
    getWorld03SteelBeamDefinitions(stageId), () => 'checkpoint-1', () => canHandleContact,
    () => backpedaling,
  );
  return {
    system, player, images, events,
    setPlayerCenter(x) { player.body.left = x - 36; player.body.right = x + 36; },
    setContactAllowed(value) { canHandleContact = value; },
    setBackpedaling(value) { backpedaling = value; },
  };
}

test('fixed beam sites grow 1/2/3/3 and avoid coins, holes, props, drum routes and exits', () => {
  assert.equal(WORLD03_STEEL_BEAM_SPEED_PX_PER_SECOND, 1600);
  assert.equal(WORLD03_STEEL_BEAM_HITBOX_WIDTH, 56);
  for (let number = 1; number <= 4; number++) {
    const stageId = `world-03-stage-${number}`;
    const beams = getWorld03SteelBeamDefinitions(stageId);
    assert.deepEqual(beams.map(beam => beam.x), [1640, 2360, 3400].slice(0, number === 1 ? 1 : number === 2 ? 2 : 3));
    assert.equal(new Set(beams.map(beam => beam.id)).size, beams.length);
    for (const beam of beams) {
      assert.ok(Math.abs(beam.x - 2496) > 28 + 40);
      assert.ok(Math.abs(beam.x - 3728) > 28 + 40);
      for (const coinX of getWorld03CoinPositions(stageId)) {
        assert.ok(Math.abs(beam.x - coinX) > 28 + 17, `${beam.id} near coin ${coinX}`);
      }
      for (const gap of getWorld03CollapseZones(stageId)) {
        assert.ok(beam.x + 28 < gap.x || beam.x - 28 > gap.x + gap.width, `${beam.id} near ${gap.id}`);
      }
      for (const obstacle of getWorld03Obstacles(stageId)) {
        const left = obstacle.x - obstacle.width / 2 - (obstacle.kind === 'drum-barrel' ? 160 : 0);
        const right = obstacle.x + obstacle.width / 2;
        assert.ok(beam.x + 28 < left || beam.x - 28 > right, `${beam.id} near ${obstacle.id}`);
      }
    }
  }
  assert.deepEqual(getWorld03SteelBeamDefinitions('world-03-stage-boss'), []);
});

test('swept AABB catches a fast pass between frames without false envelope collisions', () => {
  const moving = { left: 0, right: 10, top: 0, bottom: 10 };
  const player = { left: 0, right: 10, top: 100, bottom: 140 };
  assert.equal(sweptAabbOverlap(moving, { ...moving, top: 200, bottom: 210 }, player, player), true);
  assert.equal(sweptAabbOverlap(moving, moving, moving, moving), true);
  assert.equal(sweptAabbOverlap(moving, moving, { left: 10, right: 20, top: 0, bottom: 10 }, { left: 10, right: 20, top: 0, bottom: 10 }), true);
  const diagonalAfter = { left: 100, right: 110, top: 100, bottom: 110 };
  const farPlayer = { left: 80, right: 90, top: 10, bottom: 20 };
  assert.equal(sweptAabbOverlap(moving, diagonalAfter, farPlayer, farPlayer), false);
  assert.equal(sweptAabbOverlap(moving, moving, { left: 20, right: 30, top: 0, bottom: 10 }, { left: 20, right: 30, top: 0, bottom: 10 }), false);
  assert.equal(sweptAabbOverlap({ ...moving, left: Number.NaN }, moving, player, player), false);
});

test('a direct hit kills once; restart re-arms ahead and skips sites behind the checkpoint', () => {
  const harness = createHarness();
  const { system, images, events, setPlayerCenter } = harness;
  setPlayerCenter(1550);
  system.update(50);
  assert.equal(images.length, 0);
  setPlayerCenter(1576);
  system.update(50);
  assert.equal(images.length, 1);
  assert.deepEqual([images[0].x, images[0].y, images[0].depth], [1640, -128, 11]);
  for (let index = 0; index < 10; index++) system.update(50);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    name: 'death-requested',
    payload: { stageId: 'world-03-stage-3', cause: 'trap', checkpointId: 'checkpoint-1', now: 4321 },
  });
  system.update(50);
  assert.equal(events.length, 1);
  setPlayerCenter(2496);
  system.resetForAttempt(2496);
  assert.equal(images[0].destroyed, true);
  system.update(50);
  assert.equal(images.length, 1);
  setPlayerCenter(3400);
  system.update(50);
  assert.equal(images.length, 2);
  assert.equal(images[1].x, 3400);
  setPlayerCenter(96);
  system.resetForAttempt(96);
  setPlayerCenter(1640);
  system.update(50);
  assert.equal(images.length, 3);
  system.destroy();
  system.destroy();
  assert.ok(images.every(image => image.destroyed));
  system.update(50);
  assert.equal(images.length, 3);
});

test('landing is harmless and vanishes after 300ms; pausing freezes the beam', () => {
  const harness = createHarness('world-03-stage-1');
  const { system, images, events, setPlayerCenter, setContactAllowed } = harness;
  setPlayerCenter(1640);
  system.update(50);
  const beam = images[0];
  assert.equal(beam.y, -128);
  setPlayerCenter(1800);
  setContactAllowed(false);
  system.update(50);
  assert.equal(beam.y, -128);
  setContactAllowed(true);
  for (let index = 0; index < 8; index++) system.update(50);
  assert.equal(beam.y, 494);
  assert.equal(events.length, 0);
  setPlayerCenter(1640);
  for (let index = 0; index < 5; index++) system.update(50);
  assert.equal(events.length, 0);
  assert.equal(beam.destroyed, false);
  system.update(50);
  assert.equal(beam.destroyed, true);
  system.update(50);
  assert.equal(images.length, 1);
  system.destroy();
});

test('running forward into the beam footprint is hit instead of passing beneath it', () => {
  const harness = createHarness('world-03-stage-1');
  const { system, images, events, setPlayerCenter } = harness;
  setPlayerCenter(1564);
  system.update(50);
  assert.equal(images.length, 0);
  setPlayerCenter(1576);
  system.update(50);
  assert.equal(images[0].y, -128);
  for (let step = 1; step <= 8; step++) {
    setPlayerCenter(1576 + step * 12);
    system.update(50);
  }
  assert.equal(events.length, 1);
  system.destroy();
});

test('a fast backward turn after the beam appears clears its landing path', () => {
  const harness = createHarness('world-03-stage-1');
  const { system, player, images, events, setPlayerCenter, setBackpedaling } = harness;
  let center = 1576;
  setPlayerCenter(center);
  player.body.velocity.x = 240;
  system.update(50);
  assert.equal(images[0].y, -128);
  for (let step = 1; step <= 8; step++) {
    if (step > 3) setBackpedaling(true);
    player.body.velocity.x = step > 3
      ? Math.max(-240, player.body.velocity.x - 90)
      : 240;
    system.update(50);
    if (step > 3) assert.equal(player.body.velocity.x, -240);
    center += player.body.velocity.x * 0.05;
    setPlayerCenter(center);
  }
  assert.equal(images[0].y, 494);
  assert.equal(events.length, 0);
  assert.ok(center < 1640 - 28 - 36);
  system.destroy();
});
