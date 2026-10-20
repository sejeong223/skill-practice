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

test('작은 사물 다섯 종만 확대하고 기본 점프 한 번으로 모두 넘어간다', () => {
  const sizes = new Map([
    ['crushed-cola-can', [72, 50]],
    ['empty-snack-bag', [80, 84]],
    ['pink-sand-shovel', [64, 84]],
    ['orange-traffic-cone', [72, 78]],
    ['sleeping-fat-cat', [128, 75]],
  ]);
  for (const obstacle of obstacles) {
    const size = sizes.get(obstacle.kind);
    if (size) assert.deepEqual(obstacle.displaySize, { width: size[0], height: size[1] });
    else assert.equal(obstacle.displaySize, undefined, `${obstacle.kind} spring size must stay native`);

    // Clearance time above the collision zone, times horizontal speed, must
    // exceed the zone width plus the corgi's 72 px Arcade body.
    const v = 460;
    const gravity = 1200;
    const speed = 240;
    const clearance = 2 * Math.sqrt(v * v - 2 * gravity * obstacle.hitbox.height) / gravity * speed;
    assert.ok(clearance > obstacle.hitbox.width + 72, `${obstacle.kind} must remain jumpable`);
  }
  assert.deepEqual(obstacles.filter(({ kind }) => kind.endsWith('-spring')).map(({ hitbox }) => hitbox), [
    { width: 42, height: 44 }, { width: 44, height: 44 }, { width: 42, height: 44 },
  ]);
});

test('첫 스테이지 임시 함정·적만 사라지고 모래 발판과 후속 스테이지 요소는 남는다', () => {
  assert.ok(stage.segments.every(({ traps, enemies }) => traps.length === 0 && enemies.length === 0));
  assert.equal(stage.segments.flatMap(({ platforms }) => platforms).length, 1);
  const second = STAGE_DEFINITIONS.find(({ id }) => id === 'world-02-stage-2');
  assert.ok(second.segments.some(({ traps, enemies }) => traps.length > 0 || enemies.length > 0));
});
