import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
import { MackerelAttackSchedule } from '../src/game/systems/mackerelAttackSchedule.ts';
import { WORLD_CUTSCENES } from '../src/game/data/cutscenes/worlds.ts';
import { BOSS_VICTORY_PRESENTATION } from '../src/game/data/bossVictoryPresentation.ts';
import { getWorld04Entry } from '../src/game/systems/world04IntroRouting.ts';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { BossEncounter } = require('../src/game/systems/BossEncounter.ts');
const { PlayerAnimator, DASH_PRESENTATION_MS } = require('../src/game/entities/PlayerAnimator.ts');
const { GameplayEventBus } = require('../src/game/core/events.ts');
const { BOSS_COMBAT_CONFIG } = require('../src/game/data/bossCombat.ts');

function harness(attempt = 1) {
  const log = { prep: [], launch: [], clears: 0, victories: 0, hearts: [], defenseResets: 0 };
  const schedule = new MackerelAttackSchedule('world-03-stage-boss', attempt);
  const pendingHits = [];
  const paint = { setDepth() { return this; }, clear() {}, fillStyle() {}, fillRect() {}, destroy() {} };
  const label = { setOrigin() { return this; }, setDepth() { return this; }, setVisible() { return this; },
    setText() { return this; }, destroy() {} };
  const scene = { textures: { exists: () => true }, add: { graphics: () => paint, text: () => Object.create(label) },
    cameras: { main: { worldView: { left: 0, right: 1440 } } }, time: { now: 0, delayedCall() {} } };
  const sprite = { x: 1280, y: 454, texture: { key: 'world-03-mackerel-boss' }, frame: 0, flipX: true,
    setFrame(frame) { this.frame = frame; return this; }, setFlipX(value) { this.flipX = value; return this; },
    setTintFill() { return this; }, clearTint() { return this; } };
  const player = { x: 920, flipX: false, body: { left: 884, right: 956, top: 464, bottom: 504,
    center: { x: 920, y: 484 } }, unlockControl() {}, clearTint() {}, setTintFill() {} };
  let boss;
  const pattern = {
    telegraph(_x, serial) { log.prep.push({ serial, kind: schedule.reserve(), at: boss.getState().elapsedMs }); },
    launch(_x, serial) { log.launch.push({ serial, kind: schedule.commit(), at: boss.getState().elapsedMs }); },
    update: () => pendingHits.splice(0),
    clear() { schedule.cancel(); log.clears++; },
    resetForAttempt(next) { schedule.reset(next); }, destroy() {},
  };
  const defense = { getToolId: () => null, resetForStage() { log.defenseResets++; },
    tryBlock: () => ({ blocked: false }) };
  const dogs = { clear() {} };
  let dashing = false;
  boss = new BossEncounter(scene, player, sprite, 'world-03-stage-boss', BOSS_COMBAT_CONFIG['world-03'],
    defense, dogs, new GameplayEventBus(), pattern, hearts => log.hearts.push(hearts),
    () => { log.victories++; }, () => dashing);
  return { boss, sprite, player, pattern, pendingHits, log, setDashing(value) { dashing = value; },
    advance(ms) { for (let elapsed = 0; elapsed < ms; elapsed += 50) boss.update(50); },
    hit(index) { return boss.acceptToolHit({ attackId: `tool-${index}`, toolId: 'rolled-newspaper',
      kind: 'projectile', now: index, bounds: { x: 1250, y: 450, width: 20, height: 20 }, facing: 1 }); } };
}

test('first dialogue, three distinct attacks, HP10 combo, defeat dialogue and clear route', () => {
  const intro = WORLD_CUTSCENES.find(script => script.id === 'world-03-boss-intro');
  const clear = WORLD_CUTSCENES.find(script => script.id === 'world-03-boss-clear');
  const game = harness();
  assert.equal(intro.beats.length, 6);
  game.advance(2000);
  assert.equal(game.log.prep.length, 0, 'boss cannot attack during dialogue');
  game.boss.start();
  game.advance(7200);
  assert.deepEqual(new Set(game.log.launch.slice(0, 3).map(attack => attack.kind)),
    new Set(['brick', 'cement-wave', 'cement-lump']));
  for (let index = 0; index < 5; index++) assert.equal(game.hit(index), true);
  assert.equal(game.boss.getState().health, 10);
  const launchesBefore = game.log.launch.length;
  game.advance(4000);
  const launches = game.log.launch.slice(launchesBefore);
  assert.ok(launches.length >= 2);
  assert.notEqual(launches[0].kind, launches[1].kind);
  assert.ok(launches[1].at - launches[0].at <= 1150, 'combo launches about 1.1s apart');
  const clearsBefore = game.log.clears;
  assert.equal(game.boss.tryBarkStun(12000), true);
  assert.ok(game.log.clears > clearsBefore);
  const count = game.log.launch.length;
  game.advance(650);
  assert.equal(game.log.launch.length, count);
  for (let index = 5; index < 10; index++) assert.equal(game.hit(index), true);
  assert.equal(game.boss.isDefeated(), true);
  assert.equal(game.sprite.frame, 3);
  assert.equal(game.log.victories, 1);
  assert.equal(game.hit(10), false);
  assert.equal(game.log.victories, 1);
  assert.equal(clear.beats.length, 8);
  const progress = { playerName: '코기', seenCutsceneIds: [] };
  assert.equal(BOSS_VICTORY_PRESENTATION['world-03-stage-boss'].skillId, 'dash');
  assert.equal(getWorld04Entry(progress).sceneKey, 'World04EntranceScene');
  progress.seenCutsceneIds.push('world-04-intro');
  assert.equal(getWorld04Entry(progress).sceneKey, 'StageScene');
  game.boss.destroy();
});

test('dash consumes only the current hazard; retry restores hearts and reseeds attack order', () => {
  const game = harness();
  game.boss.start();
  game.setDashing(true);
  const hazard = id => ({ id, bounds: { x: 900, right: 940, y: 470, bottom: 495 }, sourceX: 1280, kind: 'weak' });
  game.pendingHits.push(hazard('old'));
  game.advance(50);
  assert.equal(game.boss.getState().hearts, 3);
  game.setDashing(false);
  game.pendingHits.push(hazard('old'), hazard('new'));
  game.advance(50);
  assert.equal(game.boss.getState().hearts, 2);
  game.boss.resetAttempt(2);
  assert.equal(game.boss.getState().hearts, 3);
  assert.equal(game.boss.getState().health, 20);
  assert.equal(game.boss.getState().phase, 'intro');
  assert.equal(game.log.defenseResets, 1);
  game.boss.start();
  game.advance(7200);
  assert.deepEqual(new Set(game.log.launch.slice(0, 3).map(attack => attack.kind)),
    new Set(['brick', 'cement-wave', 'cement-lump']));
  game.boss.destroy();
});

test('dash pose starts on the launch frame and stays for the same 250ms as movement', () => {
  let stopped = 0;
  const playback = { dashRemainingMs: DASH_PRESENTATION_MS, dashStartedSinceLastUpdate: true,
    stopDash() { stopped++; this.dashRemainingMs = 0; } };
  PlayerAnimator.prototype.tickDash.call(playback, 16);
  assert.equal(playback.dashRemainingMs, 250, 'launch frame elapsed before dash began');
  for (let index = 0; index < 4; index++) PlayerAnimator.prototype.tickDash.call(playback, 50);
  assert.equal(playback.dashRemainingMs, 50);
  PlayerAnimator.prototype.tickDash.call(playback, 50);
  assert.equal(playback.dashRemainingMs, 0);
  assert.equal(stopped, 1);
});
