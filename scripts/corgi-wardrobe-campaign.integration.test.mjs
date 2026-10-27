import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);

const { createDefaultProgressState, getNextStageId } = require('../src/game/core/constants.ts');
const { ProgressStore } = require('../src/game/persistence/ProgressStore.ts');
const { PROGRESS_STORAGE_KEY } = require('../src/game/persistence/saveTypes.ts');
const { getOwnedCatalogEntries } = require('../src/game/data/ownedItemCatalog.ts');
const { BOSS_COMBAT_CONFIG, getBossDamage } = require('../src/game/data/bossCombat.ts');
const { SKILL_DEFINITIONS } = require('../src/game/data/skills.ts');
const { STAGE_DEFINITIONS, BOSS_DEFINITIONS } = require('../src/game/data/worlds.ts');
const { getWorld03Obstacles } = require('../src/game/data/world03Construction.ts');

const stamp = '2026-10-22T00:00:00.000Z';
const design = (slot, color) => ({
  id: `custom-outfit-${slot}`,
  cells: Array(56 * 32).fill(color),
  updatedAt: stamp,
});

test('v3 save becomes a reusable three-slot wardrobe without losing coins or equipment', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const old = createDefaultProgressState();
  old.bankedCoins = 35;
  old.ownedCosmeticIds = ['bee-bodysuit', 'birthday-party-hat'];
  old.equippedOutfitId = 'bee-bodysuit';
  old.equippedAccessoryId = 'birthday-party-hat';
  values.set(PROGRESS_STORAGE_KEY, JSON.stringify({ schemaVersion: 3, progress: old }));
  const store = new ProgressStore(storage);
  const migrated = store.load();
  assert.equal(migrated.version, 5);
  assert.equal(migrated.bankedCoins, 35);
  assert.equal(migrated.equippedOutfitId, 'bee-bodysuit');

  store.save({ ...migrated, customOutfits: [design(1, '#FF0000'), design(2, '#00FF00'), design(3, '#0000FF')], equippedCustomOutfitId: 'custom-outfit-2', equippedOutfitId: null });
  let loaded = store.load();
  assert.equal(loaded.equippedOutfitId, null);
  assert.equal(loaded.equippedCustomOutfitId, 'custom-outfit-2');
  assert.deepEqual(getOwnedCatalogEntries(loaded).filter(entry => entry.category === 'outfit').map(entry => entry.id), [
    'bee-bodysuit', 'custom-outfit-1', 'custom-outfit-2', 'custom-outfit-3',
  ]);

  store.save({ ...loaded, customOutfits: [design(1, '#FF0000'), design(2, '#FFFF00'), design(3, '#0000FF')], equippedCustomOutfitId: null, equippedOutfitId: 'bee-bodysuit' });
  loaded = store.load();
  assert.equal(loaded.customOutfits[1].cells[0], '#FFFF00');
  assert.equal(loaded.equippedOutfitId, 'bee-bodysuit');
  assert.equal(loaded.equippedCustomOutfitId, null);
  store.save({ ...loaded, equippedOutfitId: null });
  loaded = store.load();
  assert.equal(loaded.equippedOutfitId, null);
  assert.equal(loaded.bankedCoins, 35);
  assert.equal(loaded.equippedAccessoryId, 'birthday-party-hat');
  assert.equal(loaded.customOutfits.length, 3);
});

test('boss health, weapon tiers, rewards, and onward stages form one campaign', () => {
  const slipper = 'rabbit-slipper';
  const premium = 'plastic-frisbee';
  assert.equal(getBossDamage(slipper), 1);
  assert.equal(getBossDamage(premium), 3);
  for (let world = 2; world <= 5; world++) {
    const worldId = `world-0${world}`;
    const stageId = `${worldId}-stage-boss`;
    const stage = STAGE_DEFINITIONS.find(item => item.id === stageId);
    const boss = BOSS_DEFINITIONS.find(item => item.id === stage?.bossId);
    const config = BOSS_COMBAT_CONFIG[worldId];
    const reward = SKILL_DEFINITIONS.find(item => item.id === config.rewardSkill);
    assert.ok(stage && boss && reward, worldId);
    assert.equal(boss.rewardSkill, config.rewardSkill);
    assert.equal(reward.unlockAfterBossId, boss.id);
    assert.equal(Math.ceil(config.maxHealth / getBossDamage(slipper)), config.maxHealth);
    assert.ok(Math.ceil(config.maxHealth / getBossDamage(premium)) < config.maxHealth);
    if (world < 5) assert.equal(getNextStageId(stageId), `world-0${world + 1}-stage-1`);
    else assert.equal(getNextStageId(stageId), null);
  }
});

test('all four construction maps lead to the mackerel boss with checkpoints and obstacles', () => {
  for (let number = 1; number <= 4; number++) {
    const stageId = `world-03-stage-${number}`;
    const stage = STAGE_DEFINITIONS.find(item => item.id === stageId);
    assert.ok(stage, stageId);
    assert.equal(stage.map.objectDefinitions.filter(item => item.kind === 'checkpoint').length, 1);
    assert.equal(getWorld03Obstacles(stageId).length, 8);
    assert.equal(getNextStageId(stageId), number === 4 ? 'world-03-stage-boss' : `world-03-stage-${number + 1}`);
  }
});
