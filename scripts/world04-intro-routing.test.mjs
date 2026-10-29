import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getWorld04Entry } from '../src/game/systems/world04IntroRouting.ts';
import { WORLD_CUTSCENES } from '../src/game/data/cutscenes/worlds.ts';

test('first world 4 visit sees existing scrapyard intro once; return enters stage', () => {
  const progress = { playerName: '코기', seenCutsceneIds: [] };
  assert.deepEqual(getWorld04Entry(progress), {
    sceneKey: 'World04EntranceScene', data: { nextStageId: 'world-04-stage-1' },
  });
  progress.seenCutsceneIds.push('world-04-intro');
  assert.deepEqual(getWorld04Entry(progress), {
    sceneKey: 'StageScene', data: { stageId: 'world-04-stage-1', playerName: '코기' },
  });
  const intro = WORLD_CUTSCENES.find(script => script.id === 'world-04-intro');
  assert.equal(intro.beats.length, 1);
  assert.equal(intro.beats[0].musicKey, 'world-04-rooftop');
  assert.match(intro.beats[0].narration, /고물상/);
});

test('both saved first-stage routes use the world 4 intro helper', async () => {
  const preload = await readFile(new URL('../src/game/scenes/PreloadScene.ts', import.meta.url), 'utf8');
  const config = await readFile(new URL('../src/game/config.ts', import.meta.url), 'utf8');
  const scene = await readFile(new URL('../src/game/scenes/World04EntranceScene.ts', import.meta.url), 'utf8');
  assert.match(preload, /selectedWorldResume\.stageId === "world-04-stage-1"/);
  assert.match(preload, /firstUncleared === "world-04-stage-1"/);
  assert.match(config, /World04EntranceScene\]/);
  assert.match(scene, /cutscene-finished/);
  assert.match(scene, /this\.canSkip = progress\.seenCutsceneIds\.includes\(INTRO_ID\)/);
});
