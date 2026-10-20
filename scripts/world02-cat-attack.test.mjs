import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);

const { WORLD02_STAGE1_OBSTACLES } = require('../src/game/data/world02Obstacles.ts');
const { World02ObstacleSystem } = require('../src/game/systems/World02ObstacleSystem.ts');

function harness() {
  const images = [];
  const zones = [];
  const overlaps = [];
  const graphics = [];
  const events = [];
  const locks = new Set();
  let playing = true;
  const player = {
    x: 2100,
    lockControl: reason => locks.add(reason),
    unlockControl: reason => locks.delete(reason),
    setVelocity(x, y) { this.velocity = { x, y }; },
  };
  const scene = {
    time: { now: 100 },
    add: {
      image(x, y, key) {
        const image = { x, y, key, destroyed: false, setOrigin() { return this; }, setDepth() { return this; },
          setDisplaySize(width, height) { this.displayWidth = width; this.displayHeight = height; return this; },
          setTexture(next) { if (this.destroyed) throw new Error('Cannot set a texture after scene shutdown');
            this.key = next; return this; }, destroy() { this.destroyed = true; } };
        images.push(image); return image;
      },
      zone(x, y, width, height) {
        const zone = { x, y, width, height, body: { updateFromGameObject() {} }, destroyed: false,
          destroy() { this.destroyed = true; } };
        zones.push(zone); return zone;
      },
      graphics() {
        const marks = { destroyed: false, rectangles: [], setPosition() { return this; }, setDepth() { return this; },
          fillStyle() { return this; }, fillRect(...args) { this.rectangles.push(args); return this; },
          destroy() { this.destroyed = true; } };
        graphics.push(marks); return marks;
      },
    },
    physics: { add: {
      existing() {},
      overlap(_player, zone, callback) {
        const collider = { zone, callback, destroyed: false, destroy() { this.destroyed = true; } };
        overlaps.push(collider); return collider;
      },
    } },
  };
  const eventBus = { emit(type, payload) { events.push({ type, payload }); } };
  const system = new World02ObstacleSystem(scene, player, eventBus, 'world-02-stage-1',
    WORLD02_STAGE1_OBSTACLES, () => 'world-02-stage-1-checkpoint', () => playing);
  return { scene, player, images, zones, overlaps, graphics, events, locks, system,
    cat: overlaps.find(({ zone }) => zone.x === 2160), setPlaying(value) { playing = value; } };
}

test('잠자는 고양이를 점프로 피하면 연출이 없고, 닿을 때 한 번만 할퀸다', () => {
  const h = harness();
  assert.equal(h.images.length, 8);
  assert.equal(h.overlaps.length, 8);
  assert.equal(h.images[5].key, 'world-02-obstacle-sleeping-fat-cat');
  assert.deepEqual([h.images[5].displayWidth, h.images[5].displayHeight], [128, 75]);
  assert.equal(h.events.length, 0);
  h.cat.callback();
  h.cat.callback();
  assert.equal(h.events.filter(({ type }) => type === 'world02-cat-scratch').length, 1);
  assert.equal(h.images[5].key, 'world-02-obstacle-scratching-fat-cat');
  assert.deepEqual([h.images[5].displayWidth, h.images[5].displayHeight], [128, 75]);
  assert.deepEqual(h.player.velocity, { x: 0, y: 0 });
  assert.ok(h.locks.has('world02-cat-scratch'));
  assert.equal(h.graphics[0].rectangles.length, 18);
  h.system.update(179);
  assert.equal(h.events.filter(({ type }) => type === 'death-requested').length, 0);
  assert.equal(h.graphics[0].destroyed, false);
  h.system.update(181);
  const deaths = h.events.filter(({ type }) => type === 'death-requested');
  assert.equal(deaths.length, 1);
  assert.equal(deaths[0].payload.checkpointId, 'world-02-stage-1-checkpoint');
  assert.equal(deaths[0].payload.cause, 'trap');
  assert.equal(h.graphics[0].destroyed, true);
  assert.equal(h.locks.size, 0);
  h.system.update(1000);
  assert.equal(h.events.filter(({ type }) => type === 'death-requested').length, 1);
  h.system.destroy();
});

test('정지·재시작·종료가 고양이 연출의 시간과 수명을 정리한다', () => {
  const h = harness();
  h.setPlaying(false);
  h.cat.callback();
  assert.equal(h.events.length, 0);
  h.setPlaying(true);
  h.cat.callback();
  h.system.update(100);
  h.setPlaying(false); // StageScene does not call system.update while paused.
  h.cat.callback();
  assert.equal(h.events.filter(({ type }) => type === 'world02-cat-scratch').length, 1);
  h.setPlaying(true);
  h.system.update(259);
  assert.equal(h.events.filter(({ type }) => type === 'death-requested').length, 0);
  h.system.resetForAttempt();
  assert.equal(h.images[5].key, 'world-02-obstacle-sleeping-fat-cat');
  assert.deepEqual([h.images[5].displayWidth, h.images[5].displayHeight], [128, 75]);
  assert.equal(h.locks.size, 0);
  h.system.update(1000);
  assert.equal(h.events.filter(({ type }) => type === 'death-requested').length, 0);
  h.cat.callback();
  h.system.destroy();
  assert.ok(h.overlaps.every(({ destroyed }) => destroyed));
  assert.ok(h.zones.every(({ destroyed }) => destroyed));
  assert.ok(h.images.every(({ destroyed }) => destroyed));
  h.system.update(1000);
  h.cat.callback();
  assert.equal(h.events.filter(({ type }) => type === 'death-requested').length, 0);
});

test('장면 종료로 이미지가 먼저 파괴돼도 고양이 정리가 전환을 막지 않는다', () => {
  const h = harness();
  h.cat.callback();
  h.images.forEach(image => image.destroy());
  assert.doesNotThrow(() => h.system.destroy());
  assert.equal(h.locks.size, 0);
  assert.ok(h.overlaps.every(({ destroyed }) => destroyed));
});

test('고양이 하악질 WAV는 44.1 kHz 단일 채널 16-bit PCM이며 0.95초 실제 신호다', () => {
  const bytes = fs.readFileSync(path.resolve('public/assets/audio/world-02-cat-hiss.wav'));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  assert.equal(bytes.readUInt16LE(20), 1);
  assert.equal(bytes.readUInt16LE(22), 1);
  assert.equal(bytes.readUInt32LE(24), 44100);
  assert.equal(bytes.readUInt16LE(34), 16);
  const dataLength = bytes.readUInt32LE(40);
  assert.ok(dataLength / 2 / 44100 >= 0.5 && dataLength / 2 / 44100 <= 1.0);
  let peak = 0;
  for (let offset = 44; offset < 44 + dataLength; offset += 2) {
    peak = Math.max(peak, Math.abs(bytes.readInt16LE(offset)));
  }
  assert.ok(peak > 4000 && peak < 32767);
  const attribution = fs.readFileSync('public/assets/audio/ATTRIBUTION.md', 'utf8');
  assert.match(attribution, /Zabuhailo/);
  assert.match(attribution, /CC0/);
  assert.match(attribution, new RegExp(createHash('sha256').update(bytes).digest('hex')));
});
