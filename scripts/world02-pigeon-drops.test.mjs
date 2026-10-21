import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);

const { WORLD02_STAGE1_PIGEON_PASSES: definitions } = require('../src/game/data/world02PigeonDrops.ts');
const { WORLD02_STAGE1_OBSTACLES: obstacles } = require('../src/game/data/world02Obstacles.ts');
const { World02PigeonDropSystem } = require('../src/game/systems/World02PigeonDropSystem.ts');

function harness() {
  const birds = [];
  const droppings = [];
  const warnings = [];
  const splats = [];
  const overlaps = [];
  const events = [];
  const player = { x: 96 };
  let playing = true;
  const object = (x, y, key) => ({
    x, y, key, active: true, depth: 0,
    setDepth(value) { this.depth = value; return this; },
    setOrigin() { return this; },
    setFrame(value) { this.frame = value; return this; },
    destroy() { this.active = false; },
  });
  const scene = {
    time: { now: 100 },
    add: {
      sprite(x, y, key) { const sprite = object(x, y, key); birds.push(sprite); return sprite; },
      graphics() {
        const graphic = {
          ...object(0, 0, 'warning'),
          setPosition(x, y) { this.x = x; this.y = y; return this; },
          fillStyle() { return this; },
          fillEllipse() { return this; },
        };
        warnings.push(graphic); return graphic;
      },
      image(x, y, key) { const image = object(x, y, key); splats.push(image); return image; },
    },
    physics: { add: {
      sprite(x, y, key) {
        const sprite = {
          ...object(x, y, key),
          body: {
            bottom: y + 10,
            setAllowGravity(value) { this.allowGravity = value; },
            setSize(width, height) { this.width = width; this.height = height; },
          },
          setVelocity(vx, vy) { this.velocity = { vx, vy }; return this; },
        };
        droppings.push(sprite); return sprite;
      },
      overlap(_player, dropping, callback) {
        const collider = { dropping, callback, active: true, destroy() { this.active = false; } };
        overlaps.push(collider); return collider;
      },
    } },
  };
  const eventBus = { emit(type, payload) { events.push({ type, payload }); } };
  const system = new World02PigeonDropSystem(scene, player, eventBus, 'world-02-stage-1',
    definitions, () => 'world-02-stage-1-checkpoint', () => playing);
  const tick = (count = 1, delta = 50) => { for (let i = 0; i < count; i++) system.update(delta); };
  return { scene, player, birds, droppings, warnings, splats, overlaps, events, system, tick,
    setPlaying(value) { playing = value; } };
}

test('세 낙하 지점은 기존 장애물 사이에 있고 시작·체크포인트·출구를 비운다', () => {
  assert.deepEqual(definitions.map(({ triggerX, dropX }) => [triggerX, dropX]), [
    [830, 1280], [1530, 1980], [2590, 3040],
  ]);
  assert.equal(new Set(definitions.map(({ id }) => id)).size, 3);
  for (const definition of definitions) {
    assert.ok(definition.triggerX < definition.dropX);
    assert.ok(definition.dropX >= 192 && definition.dropX < 3648);
    assert.ok(Math.abs(definition.dropX - 2496) >= 250);
    for (const obstacle of obstacles) {
      const freeSpace = Math.abs(definition.dropX - obstacle.x) - obstacle.hitbox.width / 2 - 7 - 36;
      assert.ok(freeSpace >= 72, `${definition.id} is too close to ${obstacle.id}`);
    }
  }
});

test('비둘기는 오른쪽에서 왼쪽으로 날고 예고 후 똥을 떨어뜨린다', () => {
  const h = harness();
  h.tick(5);
  assert.equal(h.birds.length, 0);
  h.player.x = 830;
  h.tick();
  const bird = h.birds[0];
  assert.equal(bird.key, 'world-02-pigeon-fly');
  assert.ok(bird.x < 1280 + 240);
  h.tick(19);
  assert.equal(h.warnings.length, 1);
  assert.equal(h.warnings[0].x, 1280);
  assert.equal(h.droppings.length, 0);
  h.tick(10);
  assert.equal(h.droppings.length, 1);
  assert.equal(h.droppings[0].x, 1280);
  assert.deepEqual(h.droppings[0].velocity, { vx: 0, vy: 770 });
  assert.equal(h.droppings[0].body.allowGravity, false);
  assert.deepEqual([h.droppings[0].body.width, h.droppings[0].body.height], [14, 20]);
  assert.equal(h.overlaps.length, 1);
  assert.equal(h.events.length, 0);
  assert.ok(bird.frame >= 0 && bird.frame <= 2);
  h.system.destroy();
});

test('낙하물 접촉은 동기 재시작 중에도 정확히 한 번 즉시 사망한다', () => {
  const h = harness();
  h.player.x = 830;
  h.tick(30);
  const collider = h.overlaps[0];
  assert.ok(collider.active);
  collider.callback();
  collider.callback();
  const deaths = h.events.filter(({ type }) => type === 'death-requested');
  assert.equal(deaths.length, 1);
  assert.equal(deaths[0].payload.stageId, 'world-02-stage-1');
  assert.equal(deaths[0].payload.cause, 'trap');
  assert.equal(deaths[0].payload.checkpointId, 'world-02-stage-1-checkpoint');
  assert.equal(collider.active, false);
  assert.equal(h.droppings[0].active, false);
  h.player.x = 96;
  h.system.resetForAttempt(h.player.x);
  h.tick(5);
  assert.equal(h.events.length, 1);
  h.player.x = 830;
  h.tick();
  assert.equal(h.birds.length, 2, 'a new attempt rearms the first bird');
  h.system.destroy();
});

test('똥이 모래에 닿으면 무해한 자국을 남기고 정리한다', () => {
  const h = harness();
  h.player.x = 830;
  h.tick(30);
  h.droppings[0].body.bottom = 504;
  h.tick();
  assert.equal(h.droppings[0].active, false);
  assert.equal(h.overlaps[0].active, false);
  assert.equal(h.splats.length, 1);
  assert.equal(h.splats[0].key, 'world-02-pigeon-splat');
  h.tick(6);
  assert.equal(h.splats[0].active, false);
  assert.equal(h.events.length, 0);
  h.tick(40);
  assert.equal(h.birds[0].active, false);
  assert.equal(h.warnings[0].active, false);
  h.system.destroy();
});

test('체크포인트 재개는 지난 새를 건너뛰고 다음 새만 활성화한다', () => {
  const h = harness();
  h.player.x = 2536;
  h.system.resetForAttempt(h.player.x);
  h.tick();
  assert.equal(h.birds.length, 0);
  h.player.x = 2590;
  h.tick();
  assert.equal(h.birds.length, 1);
  assert.equal(h.birds[0].x, 3040 + 240 - 8);
  h.system.destroy();
});

test('일시정지·장면 종료 중에는 움직임·충돌이 진행되지 않는다', () => {
  const h = harness();
  h.player.x = 830;
  h.tick(30);
  const birdX = h.birds[0].x;
  const collider = h.overlaps[0];
  h.setPlaying(false);
  h.tick(5, 1000);
  collider.callback();
  assert.equal(h.birds[0].x, birdX);
  assert.equal(h.events.length, 0);
  h.setPlaying(true);
  h.system.destroy();
  h.system.destroy();
  assert.ok(h.birds.every(({ active }) => !active));
  assert.ok(h.droppings.every(({ active }) => !active));
  assert.ok(h.warnings.every(({ active }) => !active));
  assert.ok(h.overlaps.every(({ active }) => !active));
  h.tick(20);
  collider.callback();
  assert.equal(h.events.length, 0);
});
