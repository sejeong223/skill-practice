import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename },
).outputText, filename);
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === 'phaser') return { Math: { Vector2: class Vector2 {
    constructor(x, y) { this.x = x; this.y = y; }
  } } };
  return originalLoad.call(this, request, parent, isMain);
};
const { RestartController } = require('../src/game/systems/RestartController.ts');
Module._load = originalLoad;
const { CheckpointSystem } = require('../src/game/systems/CheckpointSystem.ts');
const { DeathSystem } = require('../src/game/systems/DeathSystem.ts');
const { GameplayEventBus } = require('../src/game/core/events.ts');
const { createDefaultProgressState, createRuntimeStageState } = require('../src/game/core/constants.ts');
const { shouldActivateWorld03Checkpoint } = require('../src/game/systems/world03CheckpointCrossing.ts');

function createHarness(stageId) {
  const bus = new GameplayEventBus();
  const progress = createDefaultProgressState();
  const runtime = createRuntimeStageState(stageId, 13);
  const player = {
    x: 96, y: 440, facingLeft: false,
    clearAllControlOverrides() {},
    resetTo(position) { this.x = position.x; this.y = position.y; },
    setFlipX(value) { this.facingLeft = value; },
  };
  const reached = [];
  const restarts = [];
  bus.on('checkpoint-reached', event => reached.push(event));
  bus.on('restart', event => restarts.push(event));
  const checkpoint = new CheckpointSystem(player, bus, stageId, runtime);
  const restart = new RestartController(player, checkpoint, { x: 96, y: 440, facing: 1 }, stageId, runtime, bus);
  const death = new DeathSystem(progress, runtime, restart, bus);
  const cross = (playerCenterX, checkpointId = `${stageId}-checkpoint`, checkpointX = 2496) => {
    if (!shouldActivateWorld03Checkpoint({
      stageId, playerCenterX, checkpointX, latestActiveX: checkpoint.getSnapshot()?.x ?? null,
    })) return false;
    return checkpoint.activate(checkpointId, checkpointX, 504, 1, 100);
  };
  return { bus, progress, runtime, player, reached, restarts, checkpoint, death, cross };
}

test('world 3 crossing activates the flag at its center even during a high jump', () => {
  for (let stage = 1; stage <= 4; stage++) {
    const harness = createHarness(`world-03-stage-${stage}`);
    assert.equal(harness.cross(2495), false);
    assert.equal(harness.checkpoint.getSnapshot(), null);
    assert.equal(harness.cross(2496), true);
    assert.equal(harness.cross(2600), false);
    assert.equal(harness.reached.length, 1);
    assert.equal(harness.runtime.checkpointId, `world-03-stage-${stage}-checkpoint`);
    assert.deepEqual([harness.checkpoint.getSnapshot().x, harness.checkpoint.getSnapshot().y], [2496, 504]);
    harness.death.destroy();
  }
  assert.equal(shouldActivateWorld03Checkpoint({
    stageId: 'world-03-stage-boss', playerCenterX: 2600, checkpointX: 2496, latestActiveX: null,
  }), false);
  assert.equal(shouldActivateWorld03Checkpoint({
    stageId: 'world-02-stage-1', playerCenterX: 2600, checkpointX: 2496, latestActiveX: null,
  }), false);
  assert.equal(shouldActivateWorld03Checkpoint({
    stageId: 'world-03-stage-1', playerCenterX: Number.NaN, checkpointX: 2496, latestActiveX: null,
  }), false);
});

test('deaths before a flag use spawn; all later causes use the latest checkpoint', async () => {
  for (let stage = 1; stage <= 4; stage++) {
    const harness = createHarness(`world-03-stage-${stage}`);
    harness.death.handleDeath({ stageId: harness.runtime.stageId, cause: 'fall', checkpointId: null });
    assert.deepEqual([harness.player.x, harness.player.y], [96, 440]);
    assert.equal(harness.restarts.at(-1).checkpointId, null);
    await Promise.resolve();

    assert.equal(harness.cross(2496), true);
    for (const cause of ['trap', 'fall', 'enemy']) {
      harness.player.x = 3000;
      harness.player.y = 100;
      harness.death.handleDeath({
        stageId: harness.runtime.stageId, cause,
        checkpointId: cause === 'trap' ? null : harness.runtime.checkpointId,
        ...(cause === 'trap' ? { gimmickId: 'falling-steel-beam' } : {}),
      });
      assert.deepEqual([harness.player.x, harness.player.y], [2496, 504]);
      assert.equal(harness.restarts.at(-1).checkpointId, `${harness.runtime.stageId}-checkpoint`);
      assert.equal(harness.checkpoint.getSnapshot().x, 2496);
      await Promise.resolve();
    }
    assert.equal(harness.progress.deathsByStage[harness.runtime.stageId], 4);
    harness.death.destroy();
  }
});

test('a later distinct checkpoint replaces the respawn snapshot; duplicate overlap does not', () => {
  const harness = createHarness('world-03-stage-3');
  assert.equal(harness.cross(2496), true);
  assert.equal(harness.checkpoint.activate('later', 3200, 504, -1, 200), true);
  assert.equal(harness.checkpoint.activate('later', 3220, 504, 1, 201), false);
  assert.equal(harness.reached.length, 2);
  assert.equal(harness.runtime.checkpointId, 'later');
  harness.death.handleDeath({ stageId: harness.runtime.stageId, cause: 'trap', checkpointId: 'old' });
  assert.deepEqual([harness.player.x, harness.player.y, harness.player.facingLeft], [3200, 504, true]);
  assert.equal(harness.restarts.at(-1).checkpointId, 'later');
  harness.death.destroy();
});
