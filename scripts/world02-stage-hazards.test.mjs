import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { getWorld02StageHazards } = require('../src/game/data/world02StageHazards.ts');
const { WORLD02_STAGE1_OBSTACLES } = require('../src/game/data/world02Obstacles.ts');
const { WORLD02_STAGE1_PIGEON_PASSES, WORLD02_PIGEON_DROP_OFFSETS } = require('../src/game/data/world02PigeonDrops.ts');

test('첫 맵의 고정 장애물과 비둘기 구간은 같은 참조로 유지한다', () => {
  for (const seed of [1, 42, 999]) {
    const hazards = getWorld02StageHazards('world-02-stage-1', seed);
    assert.equal(hazards.obstacles, WORLD02_STAGE1_OBSTACLES);
    assert.equal(hazards.pigeonPasses, WORLD02_STAGE1_PIGEON_PASSES);
  }
});

test('두 새 맵은 200개 시드에서 재현 가능하고 안전한 장애물·비둘기를 만든다', () => {
  for (const stageId of ['world-02-stage-2', 'world-02-stage-3']) {
    const arrangements = new Set();
    for (let seed = 1; seed <= 200; seed++) {
      const result = getWorld02StageHazards(stageId, seed);
      assert.deepEqual(result, getWorld02StageHazards(stageId, seed));
      arrangements.add(JSON.stringify(result));
      const { obstacles, pigeonPasses } = result;
      assert.equal(obstacles.length, 8);
      assert.equal(pigeonPasses.length, 3);
      assert.deepEqual(obstacles.map(({ id }) => id), obstacles.map((_, index) => `${stageId}-obstacle-${index + 1}`));
      assert.deepEqual(pigeonPasses.map(({ id }) => id), pigeonPasses.map((_, index) => `${stageId}-pigeon-${index + 1}`));
      for (const kind of ['crushed-cider-can', 'crushed-fanta-can', 'empty-cheetos-bag', 'sleeping-orange-cat', 'sleeping-tuxedo-cat']) {
        assert.equal(obstacles.filter((obstacle) => obstacle.kind === kind).length, 1);
      }
      for (const [index, obstacle] of obstacles.entries()) {
        assert.equal(obstacle.groundY, 504);
        assert.ok(obstacle.x - obstacle.hitbox.width / 2 >= 192);
        assert.ok(obstacle.x + obstacle.hitbox.width / 2 < 3648);
        assert.ok(Math.abs(obstacle.x - 2496) - obstacle.hitbox.width / 2 >= 250);
        if (index) assert.ok(obstacle.x - obstacles[index - 1].x >= 300);
        const v = 460, gravity = 1200, speed = 240;
        const clearance = 2 * Math.sqrt(v * v - 2 * gravity * obstacle.hitbox.height) / gravity * speed;
        assert.ok(clearance > obstacle.hitbox.width + 72);
        if (obstacle.contact === 'cat-scratch') assert.ok(obstacle.scratchTextureKey);
        if (obstacle.kind.includes('bag')) assert.equal(obstacle.originY, 0.88);
      }
      for (const pass of pigeonPasses) {
        assert.equal(pass.triggerX, pass.dropX - 450);
        assert.deepEqual([pass.flightY, pass.birdSpeedX, pass.droppingSpeedY], [190, 102, 770]);
        for (const offset of WORLD02_PIGEON_DROP_OFFSETS) {
          const dropX = pass.dropX + offset;
          assert.ok(dropX >= 192 && dropX < 3648 && Math.abs(dropX - 2496) >= 250);
          for (const obstacle of obstacles) {
            assert.ok(Math.abs(dropX - obstacle.x) - obstacle.hitbox.width / 2 - 7 - 36 >= 20);
          }
        }
      }
    }
    assert.ok(arrangements.size > 100, `${stageId} must vary by seed`);
  }
});
