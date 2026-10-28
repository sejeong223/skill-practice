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

function bounds(zone) {
  return {
    left: zone.x - zone.width / 2,
    right: zone.x + zone.width / 2,
    top: zone.y - zone.height / 2,
    bottom: zone.y + zone.height / 2,
  };
}

function contains(zone, x, y) {
  const { left, right, top, bottom } = bounds(zone);
  return x >= left && x < right && y >= top && y < bottom;
}

test('cone and cement use four silhouette bands while other obstacles retain one box', () => {
  const stage1 = createHarness('world-03-stage-1');
  const { system, images, zones, colliders, events, setContactAllowed } = stage1;
  assert.equal(images.length, 8);
  assert.equal(zones.length, 17);
  assert.equal(colliders.length, 17);
  const coneTop = zones.find(zone => zone.x === 379.375 && zone.y === 464 && zone.width === 8.75);
  const coneBottom = zones.find(zone => zone.x === 379.375 && zone.width === 28.75 && zone.height === 13.75);
  const cementTop = zones.find(zone => zone.x === 738.75 && zone.y === 466.5 && zone.width === 27.5);
  const cementBottom = zones.find(zone => zone.x === 739.375 && zone.width === 36.25 && zone.height === 12.5);
  assert.ok(coneTop && coneBottom && cementTop && cementBottom);
  assert.deepEqual(bounds(coneTop), { left: 375, right: 383.75, top: 461.5, bottom: 466.5 });
  assert.equal(bounds(coneBottom).bottom, 504);
  assert.deepEqual(bounds(cementTop), { left: 725, right: 752.5, top: 464, bottom: 469 });
  assert.equal(bounds(cementBottom).bottom, 504);
  // These points were inside the old full-width rectangles at both heights.
  assert.equal(zones.some(zone => contains(zone, 370, 463)), false);
  assert.equal(zones.some(zone => contains(zone, 723, 466)), false);
  assert.equal(zones.some(zone => contains(zone, 370, 497)), true);
  assert.equal(zones.some(zone => contains(zone, 723, 497)), true);

  const coneContact = colliders.find(collider => collider.zone === coneTop);
  const cementContact = colliders.find(collider => collider.zone === cementTop);
  assert.ok(coneContact && cementContact);
  setContactAllowed(false);
  coneContact.callback();
  assert.equal(events.length, 0);
  setContactAllowed(true);
  coneContact.callback();
  cementContact.callback();
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], {
    name: 'death-requested',
    payload: { stageId: 'world-03-stage-1', cause: 'trap', checkpointId: 'checkpoint-1', now: 1234 },
  });
  system.resetForAttempt();
  cementContact.callback();
  assert.equal(events.length, 2);
  system.destroy();
  assert.ok(zones.every(zone => zone.destroyed));
  assert.ok(colliders.every(collider => collider.destroyed));

  const stage3 = createHarness('world-03-stage-3');
  assert.equal(stage3.images.length, 8);
  assert.equal(stage3.zones.length, 14);
  assert.equal(stage3.colliders.length, 14);
  stage3.system.destroy();
});

test('drum waits until 240px ahead, then image and static body roll together for 160px', () => {
  const harness = createHarness();
  const { system, player, images, zones } = harness;
  const drum = images.find(image => image.key === 'world-03-drum-barrel');
  const zone = zones.find(candidate => candidate.x === drum.x && candidate.width === 52.5 && candidate.height === 37.5);
  assert.ok(zone);
  assert.equal(images.length, 8);
  assert.deepEqual(drum.origin, [0.5, 0.5]);
  assert.equal(drum.scale, 1.25);
  assert.equal(drum.y, 504 - 37.5 / 2);
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
  assert.equal(drum.angle, -160 / (37.5 / 2));
  system.update(50);
  assert.equal(drum.x, 940);
  system.destroy();
});

test('wheelbarrow stays put and drum resets after death, pausing, and scene shutdown', () => {
  const harness = createHarness('world-03-stage-1');
  const { system, player, images, zones, colliders, events, setContactAllowed } = harness;
  const drum = images.find(image => image.key === 'world-03-drum-barrel');
  const drumZone = zones.find(candidate => candidate.x === drum.x && candidate.width === 52.5 && candidate.height === 37.5);
  const wheelbarrow = images.find(image => image.key === 'world-03-wheelbarrow');
  const wheelZone = zones.find(candidate => candidate.x === wheelbarrow.x + 6 && candidate.width === 37.5 && candidate.height === 35);
  assert.ok(drumZone && wheelZone);
  assert.deepEqual(wheelbarrow.origin, [0.5, 1]);
  assert.equal(wheelbarrow.scale, 1.25);
  assert.equal(wheelZone.x, wheelbarrow.x + 6);
  assert.equal(wheelZone.y, 504 - 35 / 2);
  assert.equal(wheelZone.width, 37.5);
  assert.equal(wheelZone.height, 35);
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
  assert.equal(wheelZone.x, 1826);
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
