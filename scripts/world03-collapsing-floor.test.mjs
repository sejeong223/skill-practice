import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { NORMAL_MAP_WIDTH } from '../src/game/core/constants.ts';
import {
  getWorld03CoinPositions,
  getWorld03CollapseZones,
  getWorld03Obstacles,
  WORLD03_COLLAPSE_WIDTH,
} from '../src/game/data/world03Construction.ts';
import { shouldCollapseWorld03Floor } from '../src/game/systems/world03CollapseTrigger.ts';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename },
).outputText, filename);
const { World03CollapsingFloor } = require('../src/game/systems/World03CollapsingFloor.ts');

test('every construction stage has four hidden, jumpable gaps clear of props and rewards', () => {
  assert.equal(WORLD03_COLLAPSE_WIDTH, 128);
  for (let number = 1; number <= 4; number++) {
    const stageId = `world-03-stage-${number}`;
    const gaps = getWorld03CollapseZones(stageId);
    assert.equal(gaps.length, 4);
    assert.equal(new Set(gaps.map(({ id }) => id)).size, gaps.length);
    for (const [index, gap] of gaps.entries()) {
      assert.ok(gap.x >= 300 && gap.x + gap.width < NORMAL_MAP_WIDTH - 300);
      assert.ok(Math.abs(gap.x - 2496) > 150);
      if (index > 0) assert.ok(gap.x - (gaps[index - 1].x + gaps[index - 1].width) >= 300);
      for (const obstacle of getWorld03Obstacles(stageId)) {
        const obstacleLeft = obstacle.x - obstacle.width / 2;
        const obstacleRight = obstacle.x + obstacle.width / 2;
        assert.ok(gap.x - obstacleRight >= 70 || obstacleLeft - (gap.x + gap.width) >= 70,
          `${gap.id} too close to ${obstacle.id}`);
      }
      for (const coinX of getWorld03CoinPositions(stageId)) {
        assert.ok(coinX + 17 < gap.x - 24 || coinX - 17 > gap.x + gap.width + 24,
          `${gap.id} overlaps coin at ${coinX}`);
      }
    }
  }
  assert.deepEqual(getWorld03CollapseZones('world-03-stage-boss'), []);
});

test('floor stays intact until the grounded corgi reaches the immediate edge', () => {
  const gap = { id: 'gap', x: 496, width: 128 };
  const approach = { left: 412, right: 484, velocityX: 240, velocityY: 0, grounded: true };
  assert.equal(shouldCollapseWorld03Floor(gap, { ...approach, left: 411, right: 483 }), false);
  assert.equal(shouldCollapseWorld03Floor(gap, approach), true);
  assert.equal(shouldCollapseWorld03Floor(gap, { ...approach, grounded: false }), false);
  assert.equal(shouldCollapseWorld03Floor(gap, { ...approach, velocityY: -460 }), false);
  assert.equal(shouldCollapseWorld03Floor(gap, { ...approach, velocityX: 0 }), false);
  assert.equal(shouldCollapseWorld03Floor(gap, { ...approach, velocityX: -240 }), false);
  assert.equal(shouldCollapseWorld03Floor(gap, {
    left: 636, right: 708, velocityX: -240, velocityY: 0, grounded: true,
  }), true);
  assert.equal(shouldCollapseWorld03Floor(gap, {
    left: 637, right: 709, velocityX: -240, velocityY: 0, grounded: true,
  }), false);
});

test('the floor loses collision only at activation and restores after a death restart', () => {
  const displays = [];
  const zones = [];
  const slabs = [];
  const makeDisplay = (x, y, width) => {
    const object = {
      x, y, width, visible: true, alpha: 1, destroyed: false,
      setOrigin() { return this; }, setDepth() { return this; },
      setTilePosition() { return this; }, setTileScale() { return this; },
      setVisible(value) { this.visible = value; return this; },
      setAlpha(value) { this.alpha = value; return this; },
      setY(value) { this.y = value; return this; },
      destroy() { this.destroyed = true; },
    };
    displays.push(object);
    return object;
  };
  const scene = {
    add: {
      zone(x, y, width) { const zone = makeDisplay(x, y, width); zones.push(zone); return zone; },
      rectangle: makeDisplay,
      tileSprite(...args) { const slab = makeDisplay(...args); slabs.push(slab); return slab; },
    },
    physics: { add: {
      existing(zone) { zone.body = { enable: true, updateFromGameObject() {} }; },
      collider() { return { destroy() {} }; },
    } },
    textures: { get() { return { getSourceImage() { return { height: 216 }; } }; } },
    tweens: { add() {}, killTweensOf() {} },
  };
  const player = { body: {
    left: 411, right: 483, velocity: { x: 240, y: 0 },
    blocked: { down: true }, touching: { down: false },
  } };
  const originalFloor = { body: { enable: true } };
  const floor = new World03CollapsingFloor(scene, player, 'world-03-stage-1', originalFloor, 3840, 720);
  const firstGap = zones.find(zone => zone.x === 560 && zone.width === 128);
  const firstCavity = displays.find(display => display.x === 496 && display.width === 128 && display !== firstGap);
  const firstSlab = slabs.find(slab => slab.x === 496 && slab.width === 128);
  assert.equal(originalFloor.body.enable, false);
  assert.equal(firstGap.body.enable, true);
  floor.update();
  assert.equal(firstGap.body.enable, true);
  assert.equal(firstCavity.visible, false);

  player.body.left = 412;
  player.body.right = 484;
  floor.update();
  assert.equal(firstGap.body.enable, false);
  assert.equal(firstCavity.visible, true);
  assert.equal(firstSlab.y, 499);
  floor.update(50);
  assert.ok(firstSlab.y > 499 && firstSlab.y < 595);
  const pausedY = firstSlab.y;
  floor.update(0);
  assert.equal(firstSlab.y, pausedY);
  for (let index = 0; index < 3; index++) floor.update(50);
  assert.equal(firstSlab.visible, false);

  floor.resetForAttempt();
  assert.equal(firstGap.body.enable, true);
  assert.equal(firstCavity.visible, false);
  assert.equal(firstSlab.y, 499);
  floor.destroy();
  assert.equal(originalFloor.body.enable, true);
  assert.ok(displays.every(display => display.destroyed));
});
