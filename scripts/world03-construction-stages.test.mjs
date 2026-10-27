import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getWorld03CoinPositions, getWorld03CollapseZones, getWorld03Obstacles, WORLD03_OBSTACLE_SCALE } from '../src/game/data/world03Construction.ts';
import { NORMAL_MAP_WIDTH, getNextStageId } from '../src/game/core/constants.ts';

test('four construction stages each have eight stable, jumpable obstacles', () => {
  const all = [];
  for (let number = 1; number <= 4; number++) {
    const stageId = `world-03-stage-${number}`;
    const placements = getWorld03Obstacles(stageId);
    assert.equal(placements.length, 8);
    assert.deepEqual(getWorld03Obstacles(stageId), placements);
    assert.equal(new Set(placements.map(({id}) => id)).size, 8);
    assert.equal(placements.filter(({kind}) => kind === 'cable-drum').length, number === 1 ? 1 : 2);
    assert.equal(placements.filter(({kind}) => kind === 'wheelbarrow').length, number >= 3 ? 2 : 1);
    assert.equal(new Set(placements.map(({kind}) => kind)).size, 6);
    assert.ok(placements[0].x >= 300);
    assert.ok(placements.at(-1).x <= NORMAL_MAP_WIDTH - 300);
    for (const [index, obstacle] of placements.entries()) {
      assert.ok(obstacle.width <= 65 && obstacle.height <= 52.5, obstacle.id);
      assert.ok(Math.abs(obstacle.x - 2496) >= 150, obstacle.id);
      assert.ok(Math.abs(obstacle.x - 3728) >= 150, obstacle.id);
      if (index > 0) assert.ok(obstacle.x - placements[index - 1].x >= 300);
      all.push(obstacle.id);
    }
  }
  assert.equal(new Set(all).size, 32);
  assert.deepEqual(getWorld03Obstacles('world-03-stage-boss'), []);
  assert.equal(getNextStageId('world-03-stage-4'), 'world-03-stage-boss');
});

test('construction stages use bone coin positions clear of enlarged obstacles', () => {
  assert.equal(WORLD03_OBSTACLE_SCALE, 1.25);
  for (let number = 1; number <= 4; number++) {
    const stageId = `world-03-stage-${number}`;
    const coins = getWorld03CoinPositions(stageId);
    const obstacles = getWorld03Obstacles(stageId);
    assert.equal(coins.length, 15);
    assert.ok(coins[0] >= 96 && coins.at(-1) <= NORMAL_MAP_WIDTH - 96);
    for (const [index, coinX] of coins.entries()) {
      if (index > 0) assert.ok(coinX - coins[index - 1] >= 80);
      for (const obstacle of obstacles) {
        const left = obstacle.x - obstacle.width / 2 - (obstacle.kind === 'cable-drum' ? 160 : 0);
        const right = obstacle.x + obstacle.width / 2;
        assert.ok(coinX + 17 + 8 < left || coinX - 17 - 8 > right,
          `${stageId} coin ${index + 1} near ${obstacle.id}`);
      }
    }
    for (const gap of getWorld03CollapseZones(stageId)) {
      for (const obstacle of obstacles) {
        const left = obstacle.x - obstacle.width / 2 - (obstacle.kind === 'cable-drum' ? 160 : 0);
        const right = obstacle.x + obstacle.width / 2;
        assert.ok(right + 40 < gap.x || left - 40 > gap.x + gap.width,
          `${stageId} ${obstacle.id} too close to ${gap.id}`);
      }
    }
  }
  assert.deepEqual(getWorld03CoinPositions('world-03-stage-boss'), []);
});

test('construction runtime keeps its base floor and restores collapse sections on restart', async () => {
  const worlds = await readFile(new URL('../src/game/data/worlds.ts', import.meta.url), 'utf8');
  const scene = await readFile(new URL('../src/game/scenes/StageScene.ts', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../src/game/stages/StageRuntime.ts', import.meta.url), 'utf8');
  assert.match(worlds, /const continuousFloor/);
  assert.match(worlds, /width: NORMAL_MAP_WIDTH/);
  assert.match(scene, /createWorld03ConstructionFloor\(stage\)/);
  assert.match(scene, /this\.world03Obstacles\?\.resetForAttempt\(\)/);
  assert.match(scene, /this\.world03Obstacles\?\.update\(elapsed\)/);
  assert.match(scene, /this\.world03Obstacles\?\.destroy\(\)/);
  assert.match(scene, /this\.world03CollapsingFloor\?\.resetForAttempt\(\)/);
  assert.match(scene, /this\.world03CollapsingFloor\?\.destroy\(\)/);
  assert.match(runtime, /world-03-stage-\[1-4\]/);
  assert.match(runtime, /\? 444 : 460/);
});
