import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);

const { WORLD02_STAGE1_OBSTACLES: obstacles } = require('../src/game/data/world02Obstacles.ts');
const { STAGE_DEFINITIONS } = require('../src/game/data/worlds.ts');
const stage = STAGE_DEFINITIONS.find(({ id }) => id === 'world-02-stage-1');

test('첫 스테이지에는 서로 다른 8종이 모래 위에 안전 간격으로 배치된다', () => {
  assert.equal(obstacles.length, 8);
  assert.equal(new Set(obstacles.map(({ kind }) => kind)).size, 8);
  assert.equal(new Set(obstacles.map(({ id }) => id)).size, 8);
  assert.ok(stage);
  assert.equal(stage.mapWidth, 3840);
  assert.ok(obstacles.every(({ groundY }) => groundY === 504));
  assert.ok(obstacles.every(({ x, hitbox }) => x - hitbox.width / 2 >= 192));
  assert.ok(obstacles.every(({ x, hitbox }) => x + hitbox.width / 2 < 3648));
  assert.ok(obstacles.every(({ x, hitbox }) => Math.abs(x - 2496) - hitbox.width / 2 >= 250));
  for (let index = 1; index < obstacles.length; index++) {
    assert.ok(obstacles[index].x - obstacles[index - 1].x >= 300);
  }
});

test('장애물 7개는 즉시 사망이고 잠자는 고양이만 할퀴기 접촉이다', () => {
  for (const obstacle of obstacles) {
    assert.equal(obstacle.id, `world-02-stage-1-obstacle-${obstacle.kind}`);
    assert.equal(obstacle.textureKey, `world-02-obstacle-${obstacle.kind}`);
    assert.ok(obstacle.hitbox.width > 0 && obstacle.hitbox.height > 0);
    assert.ok(obstacle.hitbox.height <= 44);
  }
  assert.equal(obstacles.filter(({ contact }) => contact === 'instant-death').length, 7);
  assert.deepEqual(obstacles.filter(({ contact }) => contact === 'cat-scratch').map(({ kind }) => kind), ['sleeping-fat-cat']);
});

test('첫 스테이지 임시 함정·적만 사라지고 모래 발판과 후속 스테이지 요소는 남는다', () => {
  assert.ok(stage.segments.every(({ traps, enemies }) => traps.length === 0 && enemies.length === 0));
  assert.equal(stage.segments.flatMap(({ platforms }) => platforms).length, 1);
  const second = STAGE_DEFINITIONS.find(({ id }) => id === 'world-02-stage-2');
  assert.ok(second.segments.some(({ traps, enemies }) => traps.length > 0 || enemies.length > 0));
});
