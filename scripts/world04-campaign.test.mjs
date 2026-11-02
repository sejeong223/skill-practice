import assert from 'node:assert/strict';
import test from 'node:test';
import Module from 'node:module';
import { requireTS } from './world04-test-fixtures.mjs';
const originalLoad = Module._load;
Module._load = function(request, parent, main) {
  if (request === 'phaser') return { Physics: { Arcade: { Sprite: class {}, Image: class {} } }, GameObjects: { Rectangle: class {} } };
  return originalLoad.call(this, request, parent, main);
};
const { StageRuntime } = requireTS('../src/game/stages/StageRuntime.ts');
Module._load = originalLoad;
const { STAGE_DEFINITIONS } = requireTS('../src/game/data/worlds.ts');
const { WORLD_MAP_THEMES, getWorld04StageTheme } = requireTS('../src/game/data/worldMaps.ts');
const { getWorld04Layout } = requireTS('../src/game/data/world04Scrapyard.ts');
const { getNextStageId } = requireTS('../src/game/core/constants.ts');
test('actual stage definitions/runtime route four dense maps with 15 bone coins and one floor-aligned flag', () => {
  const base = WORLD_MAP_THEMES.find(t => t.worldId === 'world-04');
  for (let n = 1; n <= 4; n++) {
    const id = `world-04-stage-${n}`, s = STAGE_DEFINITIONS.find(s => s.id === id), l = getWorld04Layout(id);
    assert.deepEqual(s.spawn, l.spawn); assert.equal(s.mapWidth, 3840); assert.equal(s.mapHeight, 720);
    assert.equal(s.segments.length, 5); assert.equal(s.checkpointSectionIndex, 4);
    assert.ok(s.segments.every(s => !s.platforms.length && !s.traps.length && !s.enemies.length));
    assert.deepEqual(s.map.gimmicks, []); assert.deepEqual(s.map.chainRules, []);
    assert.equal(s.map.objectDefinitions.find(o => o.kind === 'checkpoint').y, 384);
    const theme = getWorld04StageTheme(id, base); assert.equal(theme.layers.find(l => l.kind === 'background-mid').assetKey, `world-04-scrapyard-mid-${n}`);
    assert.deepEqual(theme.layers, s.map.layers);
    const requests = [], factory = { create(scene, request) { requests.push(request); return { active: true, setVisible() { return this; }, setActive() { return this; }, destroy() {} }; } };
    const runtime = new StageRuntime({}, s, undefined, undefined, factory); runtime.build(); runtime.start();
    const coins = requests.filter(r => r.kind === 'coin'); assert.equal(coins.length, 15);
    for (let i = 0; i < coins.length; i++) assert.deepEqual(coins[i], { kind: 'coin', id: l.coins[i].id, appearance: 'bone', x: l.coins[i].x, y: l.coins[i].y });
    const flag = requests.find(r => r.kind === 'checkpoint'); assert.deepEqual([flag.x, flag.y], [2496, 444]);
    assert.equal(runtime.getEntities('platform').length, 0); assert.equal(getNextStageId(id), `world-04-stage-${n === 4 ? 'boss' : n + 1}`);
    runtime.destroy();
  }
  assert.equal(getWorld04StageTheme('world-04-stage-boss', base), base);
  assert.equal(getWorld04StageTheme('world-03-stage-1', base), base);
  assert.ok(STAGE_DEFINITIONS.find(s => s.id === 'world-04-stage-boss').segments[0].platforms.length > 0);
});
