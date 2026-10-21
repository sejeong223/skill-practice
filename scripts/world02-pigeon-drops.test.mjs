import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);

const {
  WORLD02_STAGE1_PIGEON_PASSES: definitions,
  WORLD02_PIGEON_DROP_OFFSETS: dropOffsets,
  WORLD02_PIGEON_SPAWN_INTERVAL_MS: spawnIntervalMs,
} = require("../src/game/data/world02PigeonDrops.ts");
const { WORLD02_STAGE1_OBSTACLES: obstacles } = require("../src/game/data/world02Obstacles.ts");
const { World02PigeonDropSystem } = require("../src/game/systems/World02PigeonDropSystem.ts");

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
    time: { now: 0 },
    add: {
      sprite(x, y, key) {
        const sprite = { ...object(x, y, key), createdAt: scene.time.now };
        birds.push(sprite); return sprite;
      },
      graphics() {
        const graphic = {
          ...object(0, 0, "warning"),
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
  const system = new World02PigeonDropSystem(scene, player, eventBus, "world-02-stage-1",
    definitions, () => "world-02-stage-1-checkpoint", () => playing);
  const tick = (count = 1, delta = 50) => {
    for (let i = 0; i < count; i += 1) {
      scene.time.now += delta;
      system.update(delta);
    }
  };
  return { scene, player, birds, droppings, warnings, splats, overlaps, events, system, tick,
    setPlaying(value) { playing = value; } };
}

test("세 비행 구간과 연속 낙하 지점은 놀이터 안전 경계 안에 있다", () => {
  assert.deepEqual(definitions.map(({ triggerX, dropX }) => [triggerX, dropX]), [
    [830, 1280], [1530, 1980], [2590, 3040],
  ]);
  assert.equal(new Set(definitions.map(({ id }) => id)).size, 3);
  assert.equal(spawnIntervalMs, 2000);
  assert.deepEqual(dropOffsets, [84, 0, -84]);
  for (const definition of definitions) {
    for (const offset of dropOffsets) {
      const x = definition.dropX + offset;
      assert.ok(x >= 192 && x < 3648);
      assert.ok(Math.abs(x - 2496) >= 250);
      for (const obstacle of obstacles) {
        const freeSpace = Math.abs(x - obstacle.x) - obstacle.hitbox.width / 2 - 7 - 36;
        assert.ok(freeSpace >= 20, `${definition.id} drop ${x} is too close to ${obstacle.id}`);
      }
    }
  }
});

test("한 비둘기가 왼쪽으로 날면서 세 위치에 차례대로 똥을 떨어뜨린다", () => {
  const h = harness();
  h.tick(5);
  assert.equal(h.birds.length, 0);
  h.player.x = 830;
  h.tick();
  assert.equal(h.birds[0].key, "world-02-pigeon-fly");
  assert.ok(h.birds[0].x < 1280 + 240);
  h.tick(20);
  assert.deepEqual(h.droppings.map((sprite) => sprite.x), [1364]);
  h.tick(11);
  assert.deepEqual(h.droppings.map((sprite) => sprite.x), [1364, 1280]);
  h.tick(11);
  assert.deepEqual(h.droppings.map((sprite) => sprite.x), [1364, 1280, 1196]);
  assert.equal(h.warnings.length, 0);
  assert.ok(h.droppings.every((sprite) => sprite.velocity.vx === 0 && sprite.velocity.vy === 770));
  assert.ok(h.droppings.every((sprite) => sprite.body.allowGravity === false &&
    sprite.body.width === 14 && sprite.body.height === 20));
  assert.equal(h.overlaps.length, 3);
  assert.equal(h.events.length, 0);
  h.system.destroy();
});

test("같은 구간에 머물러도 2초 간격으로 비둘기가 계속 등장한다", () => {
  const h = harness();
  h.player.x = 830;
  h.tick();
  h.tick(39);
  assert.equal(h.birds.length, 1);
  h.tick();
  assert.equal(h.birds.length, 2);
  h.tick(40);
  assert.equal(h.birds.length, 3);
  assert.deepEqual(h.birds.map(({ createdAt }) => createdAt), [50, 2050, 4050]);
  assert.ok(h.droppings.length >= 6);
  h.system.destroy();
});

test("낙하물 하나에 닿으면 모든 동시 비행을 정리하고 정확히 한 번 죽는다", () => {
  const h = harness();
  h.player.x = 830;
  h.tick(45);
  const first = h.overlaps[0];
  const second = h.overlaps[1];
  assert.equal(h.birds.length, 2);
  first.callback();
  first.callback();
  second.callback();
  assert.equal(h.events.filter(({ type }) => type === "death-requested").length, 1);
  assert.deepEqual(h.events[0].payload, {
    stageId: "world-02-stage-1", cause: "trap",
    checkpointId: "world-02-stage-1-checkpoint", now: h.scene.time.now,
  });
  assert.ok(h.birds.every(({ active }) => !active));
  assert.ok(h.droppings.every(({ active }) => !active));
  assert.ok(h.overlaps.every(({ active }) => !active));
  h.tick(80);
  assert.equal(h.birds.length, 2, "death pending must stop spawning until restart");
  h.player.x = 96;
  h.system.resetForAttempt(h.player.x);
  h.tick(10);
  assert.equal(h.birds.length, 2);
  h.player.x = 830;
  h.tick();
  assert.equal(h.birds.length, 3);
  h.system.destroy();
});

test("각 똥은 따로 착지해 무해한 자국을 남기고 사라진다", () => {
  const h = harness();
  h.player.x = 830;
  h.tick(42);
  assert.equal(h.droppings.length, 3);
  h.droppings[0].body.bottom = 504;
  h.tick();
  assert.equal(h.droppings[0].active, false);
  assert.equal(h.overlaps[0].active, false);
  assert.equal(h.droppings[1].active, true);
  assert.equal(h.splats.length, 1);
  assert.equal(h.splats[0].x, 1364);
  h.tick(6);
  assert.equal(h.splats[0].active, false);
  assert.equal(h.warnings.length, 0);
  assert.equal(h.events.length, 0);
  h.system.destroy();
});

test("체크포인트에서는 뒤쪽 구간만 재생성하고 출구 앞에서는 새가 멈춘다", () => {
  const h = harness();
  h.player.x = 2496;
  h.system.resetForAttempt(h.player.x);
  h.tick();
  assert.equal(h.birds.length, 1);
  assert.equal(h.birds[0].x, 3040 + 240 - 8);
  h.tick(40);
  assert.equal(h.birds.length, 2);
  h.player.x = 3300;
  h.tick(80);
  assert.equal(h.birds.length, 2);
  h.system.destroy();
});

test("일시정지·상점·장면 종료는 타이머와 모든 낙하 리소스를 멈추고 정리한다", () => {
  const h = harness();
  h.player.x = 830;
  h.tick(30);
  const birdX = h.birds[0].x;
  const collider = h.overlaps[0];
  h.setPlaying(false);
  h.tick(50, 1000);
  collider.callback();
  assert.equal(h.birds[0].x, birdX);
  assert.equal(h.birds.length, 1);
  assert.equal(h.events.length, 0);
  h.setPlaying(true);
  h.system.destroy();
  h.system.destroy();
  assert.ok(h.birds.every(({ active }) => !active));
  assert.ok(h.droppings.every(({ active }) => !active));
  assert.ok(h.warnings.every(({ active }) => !active));
  assert.ok(h.overlaps.every(({ active }) => !active));
  h.tick(80);
  collider.callback();
  assert.equal(h.birds.length, 1);
  assert.equal(h.events.length, 0);
});
