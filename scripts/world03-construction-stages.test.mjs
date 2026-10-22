import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getWorld03Obstacles } from '../src/game/data/world03Construction.ts';
import { NORMAL_MAP_WIDTH, getNextStageId } from '../src/game/core/constants.ts';

test('four construction stages each have eight stable, jumpable obstacles', () => {
  const all = [];
  for (let number = 1; number <= 4; number++) {
    const stageId = `world-03-stage-${number}`;
    const placements = getWorld03Obstacles(stageId);
    assert.equal(placements.length, 8);
    assert.deepEqual(getWorld03Obstacles(stageId), placements);
    assert.equal(new Set(placements.map(({id}) => id)).size, 8);
    assert.ok(placements[0].x >= 300);
    assert.ok(placements.at(-1).x <= NORMAL_MAP_WIDTH - 300);
    for (const [index, obstacle] of placements.entries()) {
      assert.ok(obstacle.width <= 40 && obstacle.height <= 40, obstacle.id);
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

test('construction runtime uses one continuous collision plane and clears obstacles on shutdown', async () => {
  const worlds = await readFile(new URL('../src/game/data/worlds.ts', import.meta.url), 'utf8');
  const scene = await readFile(new URL('../src/game/scenes/StageScene.ts', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../src/game/stages/StageRuntime.ts', import.meta.url), 'utf8');
  assert.match(worlds, /const continuousFloor/);
  assert.match(worlds, /width: NORMAL_MAP_WIDTH/);
  assert.match(scene, /createWorld03ConstructionFloor\(stage\)/);
  assert.match(scene, /this\.world03Obstacles\?\.resetForAttempt\(\)/);
  assert.match(scene, /this\.world03Obstacles\?\.destroy\(\)/);
  assert.match(runtime, /world-03-stage-\[1-4\]/);
  assert.match(runtime, /\? 444 : 460/);
});
