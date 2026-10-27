import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
require.cache[require.resolve('phaser')] = {
  exports: { Input: { Keyboard: { JustDown: key => {
    const pressed = key.justDown;
    key.justDown = false;
    return pressed;
  } } } },
};

const { createDefaultProgressState } = require('../src/game/core/constants.ts');
const { migrateSave } = require('../src/game/persistence/migrations.ts');
const { DEFAULT_KEYBINDS, InputManager, toKeybindMap } = require('../src/game/input/InputManager.ts');
const { BITE_COOLDOWN_MS, SKILL_DEFINITIONS } = require('../src/game/data/skills.ts');

test('새 게임은 Q 공격, W 짖기, E 물기이며 W는 위쪽 이동에 쓰이지 않는다', () => {
  const progress = createDefaultProgressState();
  assert.equal(progress.version, 5);
  assert.deepEqual([progress.keybinds.attack, progress.keybinds.bark, progress.keybinds.bite, progress.keybinds.up],
    ['KeyQ', 'KeyW', 'KeyE', 'ArrowUp']);
  assert.deepEqual(toKeybindMap(progress.keybinds), {
    left: ['LEFT'], right: ['RIGHT'], up: ['UP'], down: ['DOWN'],
    jump: ['SPACE'], attack: ['Q'], dash: ['K'], bark: ['W'], bite: ['E'], pause: ['ESC'],
  });
  assert.deepEqual([DEFAULT_KEYBINDS.attack, DEFAULT_KEYBINDS.bark, DEFAULT_KEYBINDS.bite, DEFAULT_KEYBINDS.up],
    [['Q'], ['W'], ['E'], ['UP']]);
  assert.equal(BITE_COOLDOWN_MS, 6000);
  assert.equal(SKILL_DEFINITIONS.find(skill => skill.id === 'bite').inputAction, 'bite');
});

test('스키마 4 저장은 진행 자산을 보존하며 키 충돌만 새 배치로 옮긴다', () => {
  const progress = createDefaultProgressState();
  progress.bankedCoins = 42;
  progress.ownedToolIds.push('squeaky-ball');
  progress.clearedStages.push('world-01-stage-boss');
  progress.unlockedSkills.push('bark');
  progress.customOutfits = [{ id: 'custom-outfit-1', cells: Array(56 * 32).fill('#ABCDEF'), updatedAt: '2026-10-22T00:00:00.000Z' }];
  progress.equippedCustomOutfitId = 'custom-outfit-1';
  progress.keybinds = { ...progress.keybinds, up: 'KeyW', attack: 'KeyJ', bark: 'KeyL', dash: 'KeyE', pause: 'KeyQ' };
  delete progress.keybinds.bite;
  const restored = migrateSave({ schemaVersion: 4, progress });
  assert.equal(restored.version, 5);
  assert.deepEqual([restored.keybinds.up, restored.keybinds.attack, restored.keybinds.bark, restored.keybinds.bite,
    restored.keybinds.dash, restored.keybinds.pause], ['ArrowUp', 'KeyQ', 'KeyW', 'KeyE', 'KeyK', 'Escape']);
  assert.equal(restored.bankedCoins, 42);
  assert.ok(restored.ownedToolIds.includes('squeaky-ball'));
  assert.deepEqual(restored.clearedStages, ['world-01-stage-boss']);
  assert.deepEqual(restored.unlockedSkills, ['bark']);
  assert.equal(restored.customOutfits[0].cells[0], '#ABCDEF');
  assert.equal(restored.equippedCustomOutfitId, 'custom-outfit-1');
});

test('스키마 5의 사용자가 바꾼 Q/W/E 키는 재마이그레이션하지 않는다', () => {
  const progress = createDefaultProgressState();
  progress.keybinds.attack = 'KeyZ';
  progress.keybinds.bark = 'KeyX';
  progress.keybinds.bite = 'KeyC';
  const restored = migrateSave({ schemaVersion: 5, progress });
  assert.deepEqual([restored.keybinds.attack, restored.keybinds.bark, restored.keybinds.bite], ['KeyZ', 'KeyX', 'KeyC']);
});

test('InputManager는 Q/W/E를 서로 다른 한 프레임 입력으로 보고한다', () => {
  const keys = new Map();
  const scene = { game: { loop: { frame: 1 } }, input: { keyboard: {
    addKey(code) { const key = { isDown: false, justDown: false }; keys.set(code, key); return key; },
    removeKey(code) { keys.delete(code); },
  } } };
  const input = new InputManager(scene, toKeybindMap(createDefaultProgressState().keybinds));
  for (const code of ['Q', 'W', 'E']) keys.get(code).justDown = true;
  let snapshot = input.getSnapshot();
  assert.deepEqual([snapshot.attackPressed, snapshot.barkPressed, snapshot.bitePressed], [true, true, true]);
  assert.equal(input.getSnapshot(), snapshot);
  scene.game.loop.frame++;
  snapshot = input.getSnapshot();
  assert.deepEqual([snapshot.attackPressed, snapshot.barkPressed, snapshot.bitePressed], [false, false, false]);
  input.destroy();
});
