import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compile = filename => ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText;
require.extensions['.ts'] = (module, filename) => module._compile(compile(filename), filename);
const { createDefaultProgressState, createRuntimeStageState, getNextStageId, getPreviousWorld02StageId } =
  require('../src/game/core/constants.ts');
const { canBacktrackWorld02, getWorld02EntryPosition, readWorld02TravelState, saveWorld02Visit } =
  require('../src/game/data/world02Travel.ts');
const { getWorld02StageHazards } = require('../src/game/data/world02StageHazards.ts');
const { GameEventBus } = require('../src/game/bridge/GameEventBus.ts');
const { EconomySystem } = require('../src/game/systems/EconomySystem.ts');

function loadStageRuntime() {
  const filename = path.resolve('src/game/stages/StageRuntime.ts');
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const actualRequire = loaded.require.bind(loaded);
  loaded.require = id => id === './StageEntityFactory' ? { StageEntityFactory: class {} } : actualRequire(id);
  loaded._compile(compile(filename), filename);
  return loaded.exports.StageRuntime;
}
const StageRuntime = loadStageRuntime();

test('왼쪽 이동은 맵 2·3의 플레이 가능한 경계에서만 허용된다', () => {
  const ready = { stageId: 'world-02-stage-2', status: 'play', left: true,
    playerLeft: 48, controlLocked: false, controlOverridden: false,
    transitionStarted: false, menuOpen: false };
  assert.equal(canBacktrackWorld02(ready), true);
  assert.equal(canBacktrackWorld02({ ...ready, stageId: 'world-02-stage-3' }), true);
  for (const stageId of ['world-02-stage-1', 'world-02-stage-boss', 'world-01-stage-2']) {
    assert.equal(canBacktrackWorld02({ ...ready, stageId }), false);
  }
  for (const change of [{ status: 'paused' }, { status: 'dying' }, { left: false },
    { playerLeft: 49 }, { controlLocked: true }, { controlOverridden: true },
    { transitionStarted: true }, { menuOpen: true }]) {
    assert.equal(canBacktrackWorld02({ ...ready, ...change }), false, JSON.stringify(change));
  }
  assert.equal(getPreviousWorld02StageId('world-02-stage-2'), 'world-02-stage-1');
  assert.equal(getPreviousWorld02StageId('world-02-stage-3'), 'world-02-stage-2');
  assert.deepEqual(getWorld02EntryPosition('right', 3840, { x: 96, y: 440 }),
    { x: 3696, y: 440, facing: -1 });
  assert.deepEqual(getWorld02EntryPosition('left', 3840, { x: 96, y: 440 }),
    { x: 96, y: 440, facing: 1 });
});

test('방문 상태는 스테이지별 시드와 체크포인트를 보관하고 잘못된 기록을 버린다', () => {
  const snapshot = { stageId: 'world-02-stage-2', checkpointId: 'world-02-stage-2-checkpoint',
    x: 2496, y: 440, facing: 1, randomSeed: 123, mapSnapshotVersion: 0 };
  const first = saveWorld02Visit({}, 'world-02-stage-2', 123, snapshot);
  snapshot.x = 10;
  assert.equal(first['world-02-stage-2'].checkpointSnapshot.x, 2496);
  const second = saveWorld02Visit(first, 'world-02-stage-3', 123, null);
  assert.deepEqual(readWorld02TravelState(second), second);
  assert.deepEqual(getWorld02StageHazards('world-02-stage-2', second['world-02-stage-2'].seed),
    getWorld02StageHazards('world-02-stage-2', 123));
  assert.deepEqual(readWorld02TravelState({ ...second,
    'world-02-stage-1': { seed: -1, checkpointSnapshot: null },
    'world-02-stage-3': { seed: 123, checkpointSnapshot: { ...snapshot, stageId: 'world-02-stage-1' } },
    'world-03-stage-1': { seed: 123, checkpointSnapshot: null },
  }), first);
});

test('역방향 방문은 클리어 이벤트·정산 없이 코인 장부를 유지한다', () => {
  const progress = createDefaultProgressState();
  const bus = new GameEventBus();
  const completed = [];
  bus.on('stage-completed', payload => completed.push(payload));
  const runtimeState = createRuntimeStageState('world-02-stage-2', 123);
  const economy = new EconomySystem(progress, runtimeState, bus);
  assert.equal(economy.collectCoin('world-02-stage-2', 1, 'bone-a'), true);
  const before = progress.bankedCoins;
  saveWorld02Visit({}, 'world-02-stage-2', 123, null);
  assert.equal(progress.bankedCoins, before);
  assert.deepEqual(completed, []);
  assert.equal(economy.collectCoin('world-02-stage-2', 1, 'bone-a'), false);
  assert.equal(progress.bankedCoins, before);
});

test('맵 3 클리어 이벤트와 저장 복귀는 맵 4를 지나지 않는다', () => {
  const bus = new GameEventBus();
  const events = [];
  bus.on('stage-completed', event => events.push(event));
  const progress = createDefaultProgressState();
  const definition = { id: 'world-02-stage-3', worldId: 'world-02', kind: 'normal',
    mapWidth: 3840, segments: [] };
  const runtime = new StageRuntime({}, definition, createRuntimeStageState(definition.id),
    bus, { create() { throw new Error('no entity should be created'); } }, progress);
  runtime.start();
  runtime.complete();
  assert.equal(events.length, 1);
  assert.equal(events[0].nextStageId, 'world-02-stage-boss');
  assert.equal(getNextStageId('world-02-stage-3'), events[0].nextStageId);
  assert.ok(progress.clearedStages.includes('world-02-stage-3'));
  assert.ok(!progress.clearedStages.includes('world-02-stage-4'));
  runtime.destroy();
});
