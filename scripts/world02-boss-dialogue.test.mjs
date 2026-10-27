import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
}).outputText, filename);
const { WORLD_CUTSCENES } = require('../src/game/data/cutscenes/worlds.ts');

const intro = [
  ['cheese-tabby', '뭐냥? 이 잘 구워진 인절미 같은 녀석은?'],
  ['corgi', '네 녀석이 치즈 태비냐? 턱시도는 어디로 갔어!'],
  ['cheese-tabby', "턱시도 형님? 이미 왕갈비뼈를 물고 '공사장'으로 가셨다냥!"],
  ['cheese-tabby', '하지만 넌 절대 여기서 못 나간다냥!'],
  ['corgi', '당장 길을 비키지 않으면 네 귀여운 노란 털을 몽땅 뽑아버리겠다!'],
  ['cheese-tabby', '지옥의 놀이터에 온 걸 환영한다냥!'],
  ['cheese-tabby', '내 얌체 탱탱볼에 머리통 깨져서 집으로 돌아가라냥! 자, 난사 개시다냥!'],
];
const clear = [
  ['cheese-tabby', '냥?! 내 무적의 탱탱볼 계산법이 틀렸단 말이냐냥...?!'],
  ['corgi', '공놀이는 내가 너보다 백배는 더 많이 해봤다 멍! 이제 턱시도가 간 곳을 불어라!'],
  ['cheese-tabby', '크윽... 억울하다냥! 어차피 넌 다음 구역에서 바비큐가 될 거다냥!'],
  ['cheese-tabby', "턱시도 형님은 '위험천만한 공사장' 구역으로 넘어가셨다냥!"],
  ['corgi', '공사장? 철근과 시멘트 가루가 날리는 그 위험한 곳 말이냐?'],
  ['cheese-tabby', "그래냥! 그곳을 지키는 베테랑 간부 '고등어 태비' 형님이 널 시멘트에 반죽해 버릴 거다냥!"],
  ['cheese-tabby', '네 짧은 다리로는 굳지 않은 시멘트에 발이 묶여서 평생 공사장 마스코트나 될 거다냥!'],
  ['cheese-tabby', '눈이 골뱅이가 된 채 핑글핑글 돌며 기절한다.'],
];

for (const [kind, expected] of [['intro', intro], ['clear', clear]]) {
  test(`치즈 태비 ${kind} 대사와 화자 순서`, () => {
    const id = `world-02-boss-${kind}`;
    const scripts = WORLD_CUTSCENES.filter(script => script.id === id);
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].stageId, 'world-02-stage-boss');
    assert.deepEqual(scripts[0].beats.map(beat => [beat.dialogue?.[0]?.speaker, beat.dialogue?.[0]?.text]), expected);
    assert.deepEqual(scripts[0].beats.map(beat => beat.id), expected.map((_, index) => `cheese-${kind}-${index + 1}`));
    assert.ok(scripts[0].beats.every(beat => beat.durationMs === 3000 && beat.skipAllowedAfterSeen));
  });
}
