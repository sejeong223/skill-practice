import assert from 'node:assert/strict';
import test from 'node:test';
import Module from 'node:module';
import { requireTS, world04Harness } from './world04-test-fixtures.mjs';
const originalLoad = Module._load;
Module._load = function(request, parent, main) {
  if (request === 'phaser') return { Math: { Vector2: class { constructor(x, y) { this.x = x; this.y = y; } } } };
  return originalLoad.call(this, request, parent, main);
};
const { RestartController } = requireTS('../src/game/systems/RestartController.ts');
Module._load = originalLoad;
const { World04HazardSystem } = requireTS('../src/game/systems/World04HazardSystem.ts');
const { GameplayEventBus } = requireTS('../src/game/core/events.ts');
const { CheckpointSystem } = requireTS('../src/game/systems/CheckpointSystem.ts');
const { DeathSystem } = requireTS('../src/game/systems/DeathSystem.ts');
const { createDefaultProgressState, createRuntimeStageState } = requireTS('../src/game/core/constants.ts');
const { getWorld04Layout } = requireTS('../src/game/data/world04Scrapyard.ts');
const { shouldActivateWorld04Checkpoint } = requireTS('../src/game/systems/world04Checkpoint.ts');
test('all actual child systems use one death request and restore safely before/after checkpoint', async () => {
  const l = getWorld04Layout('world-04-stage-4'), h = world04Harness(), bus = new GameplayEventBus();
  h.scene.time = { now: 123 }; h.player.clearAllControlOverrides = () => {};
  h.player.resetTo = p => { h.move(p.x, p.y); };
  const runtime = createRuntimeStageState(l.stageId, 1), progress = createDefaultProgressState();
  const cp = new CheckpointSystem(h.player, bus, l.stageId, runtime);
  const restart = new RestartController(h.player, cp, { ...l.spawn, facing: 1 }, l.stageId, runtime, bus);
  const death = new DeathSystem(progress, runtime, restart, bus);
  let active = true, dashing = false, modifier = null;
  const controller = { isDashing: () => dashing, clearSurfaceModifier() { modifier = null; }, setSurfaceModifier(m) { modifier = m; }, launchFromSurface() { return true; } };
  const system = new World04HazardSystem(h.scene, h.player, controller, l, bus, () => runtime.checkpointId, () => active);
  const requests = []; bus.on('death-requested', p => requests.push(p)); bus.on('restart', () => system.resetForAttempt(h.player.x));
  const scrap = l.objects.find(o => o.kind === 'scrap');
  h.move(scrap.rect.x); dashing = true; system.beforePlayerUpdate(); assert.equal(system.afterPlayerUpdate(16), true);
  assert.equal(requests.length, 1); assert.equal(requests[0].outcome, 'instant-death'); assert.equal(progress.deathsTotal, 1);
  assert.deepEqual([h.player.x, h.player.y], [96, 504]); assert.equal(system.afterPlayerUpdate(16), false);
  await Promise.resolve();
  assert.equal(shouldActivateWorld04Checkpoint({ previousCenterX: 2480, currentCenterX: 2510, checkpointX: 2496, alreadyActive: false }), true);
  cp.activate(`${l.stageId}-checkpoint`, 2496, 504, 1, 124);
  h.move(2900, 710); assert.equal(system.afterPlayerUpdate(16), true);
  assert.equal(requests.length, 2); assert.equal(requests[1].cause, 'fall'); assert.deepEqual([h.player.x, h.player.y], [2496, 504]);
  const before = structuredClone(system.getDebugState()); active = false;
  system.beforePlayerUpdate(); assert.equal(modifier, null); system.afterPlayerUpdate(50); assert.deepEqual(system.getDebugState(), before);
  system.destroy(); system.destroy(); death.destroy(); assert.ok(h.objects.every(o => o.destroyed));
});
test('checkpoint requires a finite forward crossing and is not repeatedly activated', () => {
  for (const input of [
    { previousCenterX: 2500, currentCenterX: 2400, checkpointX: 2496, alreadyActive: false },
    { previousCenterX: 2400, currentCenterX: 2500, checkpointX: 2496, alreadyActive: true },
    { previousCenterX: NaN, currentCenterX: 2500, checkpointX: 2496, alreadyActive: false },
  ]) assert.equal(shouldActivateWorld04Checkpoint(input), false);
});
