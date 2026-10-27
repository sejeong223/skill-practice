import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { BossEncounter } = require('../src/game/systems/BossEncounter.ts');
const { BOSS_COMBAT_CONFIG } = require('../src/game/data/bossCombat.ts');

function harness(worldId = 'world-02') {
  const log = { telegraphs: [], launches: [], clears: 0, deaths: [], victories: 0, hearts: [] };
  const hits = [];
  const paint = { setDepth() { return this; }, clear() { return this; }, fillStyle() { return this; }, fillRect() { return this; }, destroy() {} };
  const text = { setOrigin() { return this; }, setDepth() { return this; }, setVisible() { return this; }, setText() { return this; }, destroy() {} };
  const scene = { textures: { exists: () => true }, add: { graphics: () => paint, text: () => text }, time: { now: 0, delayedCall() {} } };
  const sprite = { x: 1280, y: 472, texture: { key: 'boss' }, frame: 0, flipX: false, tint: null,
    getBounds: () => ({ x: 1230, y: 420, width: 100, height: 100, centerX: 1280, centerY: 470 }),
    setFrame(frame) { this.frame = frame; return this; },
    setFlipX(value) { this.flipX = value; return this; },
    setTintFill(value) { this.tint = value; return this; },
    clearTint() { this.tint = null; return this; } };
  const player = { x: 1200, y: 504, flipX: false,
    body: { x: 1164, y: 464, left: 1164, right: 1236, top: 464, bottom: 504, width: 72, height: 40, center: { x: 1200, y: 484 } },
    setTintFill() { return this; }, clearTint() { return this; } };
  const pattern = { telegraph: (x, serial) => log.telegraphs.push([x, serial]),
    launch: (x, serial) => log.launches.push([x, serial]),
    update: () => hits.splice(0), clear: () => { log.clears++; sprite.setFrame(0); }, destroy() {} };
  const defense = { block: false, tryBlock: () => ({ blocked: defense.block }), resetForStage() {}, getToolId: () => 'upside-down-bowl' };
  const events = { emit: (kind, payload) => { if (kind === 'death-requested') log.deaths.push(payload); } };
  const boss = new BossEncounter(scene, player, sprite, `${worldId}-stage-boss`, BOSS_COMBAT_CONFIG[worldId], defense, events, pattern,
    hearts => log.hearts.push(hearts), () => { log.victories++; });
  return { boss, log, hits, defense, player, scene, sprite };
}

const advance = (boss, total) => { for (let t = 0; t < total; t += 50) boss.update(50); };
const contact = (id, toolId) => ({ attackId: id, toolId, kind: 'projectile', now: 0,
  bounds: { x: 1240, y: 445, width: 20, height: 20 }, facing: 1 });
const hazard = id => ({ id, bounds: { x: 1175, right: 1210, y: 468, bottom: 496 }, sourceX: 1280, kind: 'weak' });

test('첫 예고는 1.5초 뒤, 발사는 0.6초 뒤, 다음 예고는 첫 예고에서 3초 뒤', () => {
  const { boss, log } = harness();
  boss.start();
  advance(boss, 1450);
  assert.equal(log.telegraphs.length, 0);
  advance(boss, 50);
  assert.equal(log.telegraphs.length, 1);
  advance(boss, 600);
  assert.equal(log.launches.length, 1);
  advance(boss, 2400);
  assert.equal(log.telegraphs.length, 2);
});

test('고급 무기와 한 발 중복 명중 방지, 승리 콜백 한 번', () => {
  const { boss, log, sprite } = harness();
  boss.start();
  assert.equal(boss.acceptToolHit(contact('one', 'rolled-newspaper')), true);
  assert.equal(boss.getState().health, 13);
  assert.equal(boss.acceptToolHit(contact('one', 'rolled-newspaper')), false);
  assert.equal(boss.getState().health, 13);
  for (let n = 0; n < 4; n++) boss.acceptToolHit(contact(`frisbee-${n}`, 'plastic-frisbee'));
  assert.equal(boss.getState().health, 1);
  boss.acceptToolHit(contact('finish', 'rabbit-slipper'));
  assert.equal(boss.getState().health, 0);
  assert.equal(boss.isDefeated(), true);
  assert.ok(log.clears > 0);
  assert.equal(sprite.tint, null);
  assert.equal(sprite.frame, 3);
  assert.equal(sprite.flipX, true);
  boss.update(50);
  assert.equal(sprite.frame, 3);
  assert.equal(boss.acceptToolHit(contact('extra', 'plastic-frisbee')), false);
  assert.equal(log.victories, 1);
  boss.resetAttempt();
  assert.equal(sprite.frame, 0);
  assert.equal(sprite.tint, null);
});

test('방패, 900ms 무적, 하트 0 사망 한 번, 시도 초기화', () => {
  const { boss, hits, defense, log } = harness();
  boss.start();
  defense.block = true;
  hits.push(hazard('blocked'));
  boss.update(50);
  assert.equal(boss.getState().hearts, 3);
  defense.block = false;
  hits.push(hazard('a'));
  boss.update(50);
  assert.equal(boss.getState().hearts, 2);
  hits.push(hazard('b'));
  boss.update(50);
  assert.equal(boss.getState().hearts, 2);
  advance(boss, 900);
  hits.push(hazard('c'));
  boss.update(50);
  assert.equal(boss.getState().hearts, 1);
  advance(boss, 900);
  hits.push(hazard('d'), hazard('e'));
  boss.update(50);
  assert.equal(boss.getState().hearts, 0);
  assert.equal(log.deaths.length, 1);
  boss.resetAttempt();
  boss.start();
  assert.equal(boss.getState().hearts, 3);
  assert.equal(boss.getState().health, 15);
});

test('짖기 경직 중 공격 시계와 위험물이 멈추고 700ms 안전 시간이 생긴다', () => {
  const { boss, log, scene } = harness();
  boss.start();
  advance(boss, 1500);
  scene.time.now = 2000;
  assert.equal(boss.tryBarkStun(2000), true);
  const before = boss.getState().elapsedMs;
  advance(boss, 1200);
  assert.equal(boss.getState().elapsedMs, before);
  assert.ok(log.clears > 0);
  assert.equal(boss.tryBarkStun(2500), false);
  boss.destroy();
});
