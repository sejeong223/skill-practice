import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { BOSS_VICTORY_PRESENTATION } from '../src/game/data/bossVictoryPresentation.ts';
import { getNextStageId } from '../src/game/core/constants.ts';

test('world 3 clear presents dash with accurate immunity and next stage', () => {
  const reward = BOSS_VICTORY_PRESENTATION['world-03-stage-boss'];
  assert.equal(reward.nextStageId, getNextStageId('world-03-stage-boss'));
  assert.equal(reward.skillId, 'dash');
  assert.equal(reward.skillName, '대시');
  assert.match(reward.skillDescription, /숫자 1/);
  assert.match(reward.skillEffectNote, /0\.25초.*공격 피해.*1\.4초/);
  assert.doesNotMatch(reward.skillDescription + reward.skillEffectNote, /벽돌.*통과|바닥.*통과/);
  assert.equal(reward.defeatedFrame, 3);
  assert.equal(reward.defeatedFlipX, true);
});

test('world 3 victory stays in arena until clear then unlock, and world 1/2 routes remain', async () => {
  const stage = await readFile(new URL('../src/game/scenes/StageScene.ts', import.meta.url), 'utf8');
  const clear = await readFile(new URL('../src/game/scenes/World01StageClearScene.ts', import.meta.url), 'utf8');
  const unlock = await readFile(new URL('../src/game/scenes/World01SkillUnlockScene.ts', import.meta.url), 'utf8');
  assert.match(stage, /stageId === "world-03-stage-boss"\) return;/);
  assert.match(stage, /this\.scene\.start\("World01StageClearScene", \{[\s\S]*?nextStageId: stage\.id === "world-02-stage-boss" \? "world-03-stage-1" : "world-04-stage-1"/);
  assert.match(clear, /stageId === "world-02-stage-boss" \|\| this\.stageData\.stageId === "world-03-stage-boss"/);
  assert.match(unlock, /stageId === "world-03-stage-boss"\) \{[\s\S]*?getWorld04Entry/);
  assert.match(unlock, /this\.scene\.start\("World01StageClearScene"/);
  assert.equal(BOSS_VICTORY_PRESENTATION['world-01-stage-boss'].skillId, 'bark');
  assert.equal(BOSS_VICTORY_PRESENTATION['world-02-stage-boss'].skillId, 'bite');
});
