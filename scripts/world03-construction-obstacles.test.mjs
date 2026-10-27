import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename },
).outputText, filename);
const { World03ConstructionObstacles } = require('../src/game/systems/World03ConstructionObstacles.ts');

function createHarness(stageId = 'world-03-stage-3') {
  const images = [];
  const zones = [];
  const colliders = [];
  const events = [];
  const player = { x: 200 };
  let canHandleContact = true;
  const scene = {
    time: { now: 1234 },
    add: {
      image(x, y, key) {
        const image = {
          x, y, key, angle: 0, destroyed: false,
          setOrigin(originX, originY) { this.origin = [originX, originY]; return this; },
          setScale(scale) { this.scale = scale; return this; },
          setDepth(depth) { this.depth = depth; return this; },
          setX(nextX) { this.x = nextX; return this; },
          setRotation(angle) { this.angle = angle; return this; },
          destroy() { this.destroyed = true; },
        };
        images.push(image);
        return image;
      },
      zone(x, y, width, height) {
        const zone = {
          x, y, width, height, destroyed: false,
          setX(nextX) { this.x = nextX; return this; },
          destroy() { this.destroyed = true; },
        };
        zones.push(zone);
        return zone;
      },
    },
    physics: { add: {
      existing(zone) {
        zone.body = {
          syncCount: 0,
          updateFromGameObject() { this.syncCount++; },
        };
      },
      overlap(_player, zone, callback) {
        const collider = { zone, callback, destroyed: false, destroy() { this.destroyed = true; } };
        colliders.push(collider);
        return collider;
      },
    } },
  };
  const system = new World03ConstructionObstacles(
    scene, player, stageId, { emit: (name, payload) => events.push({ name, payload }) },
    () => 'checkpoint-1', () => canHandleContact,
  );
  return { system, player, images, zones, colliders, events, setContactAllowed: value => { canHandleContact = value; } };
}

test('drum waits until 240px ahead, then image and static body roll together for 160px', () => {
  const harness = createHarness();
  const { system, player, images, zones } = harness;
  const drum = images.find(image => image.key === 'world-03-cable-drum');
  const zone = zones[images.indexOf(drum)];
  assert.equal(images.length, 8);
  assert.deepEqual(drum.origin, [0.5, 0.5]);
  assert.equal(drum.scale, 1.25);
  assert.equal(drum.y, 504 - 52.5 / 2);
  player.x = 1101;
  system.update(50);
  assert.equal(drum.x, 1100);
  player.x = 859;
  system.update(50);
  assert.equal(drum.x, 1100);
  player.x = 860;
  system.update(50);
  assert.equal(drum.x, 1092);
  assert.equal(zone.x, drum.x);
  assert.ok(zone.body.syncCount > 1);
  assert.ok(drum.angle < 0);
  for (let index = 0; index < 30; index++) system.update(50);
  assert.equal(drum.x, 940);
  assert.equal(zone.x, 940);
  assert.equal(drum.angle, -160 / (52.5 / 2));
  system.update(50);
  assert.equal(drum.x, 940);
  system.destroy();
});

test('wheelbarrow stays put and drum resets after death, pausing, and scene shutdown', () => {
  const harness = createHarness('world-03-stage-1');
  const { system, player, images, zones, colliders, events, setContactAllowed } = harness;
  const drum = images.find(image => image.key === 'world-03-cable-drum');
  const drumZone = zones[images.indexOf(drum)];
  const wheelbarrow = images.find(image => image.key === 'world-03-wheelbarrow');
  const wheelZone = zones[images.indexOf(wheelbarrow)];
  assert.deepEqual(wheelbarrow.origin, [0.5, 1]);
  player.x = 900;
  setContactAllowed(false);
  system.update(50);
  assert.equal(drum.x, 1100);
  setContactAllowed(true);
  system.update(50);
  assert.equal(drum.x, 1092);
  system.update(Number.NaN);
  assert.equal(drum.x, 1092);
  assert.equal(wheelbarrow.x, 1820);
  assert.equal(wheelZone.x, 1820);
  const wheelContact = colliders.find(collider => collider.zone === wheelZone);
  wheelContact.callback();
  wheelContact.callback();
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    name: 'death-requested',
    payload: { stageId: 'world-03-stage-1', cause: 'trap', checkpointId: 'checkpoint-1', now: 1234 },
  });
  system.resetForAttempt();
  assert.equal(drum.x, 1100);
  assert.equal(drumZone.x, 1100);
  assert.equal(drum.angle, 0);
  system.update(50);
  assert.equal(drum.x, 1092);
  wheelContact.callback();
  assert.equal(events.length, 2);
  system.destroy();
  system.destroy();
  system.update(50);
  system.resetForAttempt();
  assert.ok(images.every(image => image.destroyed));
  assert.ok(zones.every(zone => zone.destroyed));
  assert.ok(colliders.every(collider => collider.destroyed));
});
