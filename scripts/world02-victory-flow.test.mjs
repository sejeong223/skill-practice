import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { BOSS_VICTORY_PRESENTATION, getBossVictoryPresentation } = require('../src/game/data/bossVictoryPresentation.ts');
const { getNextStageId } = require('../src/game/core/constants.ts');

test('월드 1/2 결과 화면은 캠페인의 실제 다음 스테이지와 같은 대상을 가리킨다', () => {
  for (const stageId of ['world-01-stage-boss', 'world-02-stage-boss']) {
    const presentation = getBossVictoryPresentation(stageId);
    assert.equal(presentation, BOSS_VICTORY_PRESENTATION[stageId]);
    assert.equal(presentation.nextStageId, getNextStageId(stageId));
    assert.ok(presentation.skillName && presentation.skillDescription && presentation.skillEffectNote);
  }
  assert.equal(getBossVictoryPresentation('world-03-stage-boss'), null);
  assert.equal(getBossVictoryPresentation('__proto__'), null);
});

test('월드 2 클리어와 물기 안내에 쓰러진 치즈 태비와 정확한 보상 문구를 쓴다', () => {
  const world2 = BOSS_VICTORY_PRESENTATION['world-02-stage-boss'];
  assert.equal(world2.skillId, 'bite');
  assert.equal(world2.skillName, '물기');
  assert.equal(world2.skillDescription, '코기의 날카로운 이빨로 적을 앙숙처럼 물어뜯어 큰 피해를 줍니다.');
  assert.equal(world2.skillEffectNote, '(※ 보스의 체력이 2만큼 감소합니다.)');
  assert.equal(world2.backgroundKey, 'world-02-background-mid');
  assert.equal(world2.bossTextureKey, 'world-02-cheese-tabby-boss');
  assert.equal(world2.defeatedFrame, 3);
  assert.equal(world2.defeatedFlipX, true);
});

test('월드 1의 짖기 안내와 결과 화면 내용은 유지한다', () => {
  const world1 = BOSS_VICTORY_PRESENTATION['world-01-stage-boss'];
  assert.equal(world1.skillId, 'bark');
  assert.equal(world1.skillName, '짖기');
  assert.equal(world1.skillEffectNote, '(※ 보스 공격 패턴을 잠시 멈출 수 있습니다.)');
  assert.equal(world1.clearButtonLabel, 'NEXT STAGE ->');
  assert.equal(world1.defeatedFrame, 2);
});
