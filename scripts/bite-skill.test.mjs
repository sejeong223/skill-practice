import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { GameplayEventBus } = require('../src/game/core/events.ts');
const { SkillSystem } = require('../src/game/systems/SkillSystem.ts');
const { SlipperAttackController } = require('../src/game/systems/SlipperAttack.ts');
const { isCalicoInSlipperReach } = require('../src/game/systems/calicoMeleeHitbox.ts');
const { SKILL_DEFINITIONS } = require('../src/game/data/skills.ts');

test('E 물기는 미해금에서 거절되고 사용 시 6초를 소비한다', () => {
  const player = { setAnimationState(state) { this.state = state; } };
  const events = [];
  const bus = new GameplayEventBus();
  bus.on('skill-used', event => events.push(event));
  const locked = new SkillSystem(player, SKILL_DEFINITIONS, bus);
  assert.equal(locked.use('bite', 0).accepted, false);
  const skills = new SkillSystem(player, SKILL_DEFINITIONS, bus, undefined, ['bite']);
  assert.equal(skills.use('bite', 0).accepted, true);
  assert.equal(player.state, 'attack-bite');
  assert.equal(skills.getRemainingCooldown('bite', 5999), 1);
  assert.equal(skills.use('bite', 5999).accepted, false);
  assert.equal(skills.use('bite', 6000).accepted, true);
  assert.deepEqual(events.map(event => event.now), [0, 6000]);
});

test('Q 슬리퍼 세 번째 공격은 재채기하고 이후 Q는 다시 슬리퍼 공격이다', () => {
  const events = [];
  const locks = new Set();
  const player = { flipX: false, setAnimationState() {}, setVelocityX() {}, setVelocityY() {},
    lockControl: reason => locks.add(reason), unlockControl: reason => locks.delete(reason) };
  const bus = new GameplayEventBus();
  bus.on('bite-hit', () => events.push('bite'));
  const slipper = new SlipperAttackController(player, bus);
  assert.equal(slipper.tryAttack(0).kind, 'slipper-hit');
  assert.equal(slipper.tryAttack(150).kind, 'slipper-hit');
  assert.equal(slipper.tryAttack(300).kind, 'slipper-sneeze');
  assert.ok(locks.has('slipper-sneeze'));
  assert.equal(slipper.tryAttack(649).accepted, false);
  slipper.update(650);
  assert.equal(slipper.tryAttack(650).kind, 'slipper-hit');
  assert.deepEqual(events, []);
});

test('물기 근접 판정은 얼굴 앞 방향과 높이를 함께 확인한다', () => {
  const target = { x: 1240, y: 445, width: 60, height: 60 };
  assert.equal(isCalicoInSlipperReach(1200, 480, 1, target), true);
  assert.equal(isCalicoInSlipperReach(1200, 480, -1, target), false);
  assert.equal(isCalicoInSlipperReach(900, 480, 1, target), false);
  assert.equal(isCalicoInSlipperReach(1200, 600, 1, target), false);
});
