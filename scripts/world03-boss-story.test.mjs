import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { WORLD_CUTSCENES } from '../src/game/data/cutscenes/worlds.ts';

const expectedIntro = [
  ['mackerel-tabby', '요란하게 짖어대며 기어오더니, 꼴이 이게 뭐냥.'],
  ['corgi', '네 녀석이 고등어 태비냐? 내 왕갈비뼈를 가져간 턱시도의 위치를 불어!'],
  ['mackerel-tabby', '턱시도 형님 말이지? 그라운드 작업은 이미 끝내고 우리의 아지트로 떴다냥.'],
  ['mackerel-tabby', '너 같은 숏다리가 여기까지 쫓아온 건 가상하지만... 선은 여기서 긋는다냥.'],
  ['corgi', '휑한 공사장 따위가 내 전진을 막을 줄 알았냐 멍!'],
  ['mackerel-tabby', '입만 살아가지고... 뼈도 못 추리게 공사장 자갈맛을 보여주마. 자, 오늘은 네 제삿날이다냥!'],
];
const expectedClear = [
  ['mackerel-tabby', '큭... 이 숏다리한테 내 공격이 무산되다니, 뼈가 으스러지는구만...'],
  ['corgi', '동네 철근 좀 씹어먹었다고 유세 떨더니 별 것도 아니네 멍! 당장 턱시도가 어디로 갔는지 불어라!'],
  ['mackerel-tabby', '허... 성깔 하난 대단하네. 어차피 턱시도 형님 구역으로 가면 넌 보신탕 거리가 될 거다냥.'],
  ['mackerel-tabby', '턱시도 형님은 지금 고물상 아지트에 계시다냥!'],
  ['corgi', '고물상 아지트? 거긴 또 어떤 잡동사니가 기다리고 있는 거냐!'],
  ['mackerel-tabby', '그래냥! 거긴 우리 연합의 진짜 행동대장인 턱시도 형님이 버티고 있는 본진이다냥.'],
  ['mackerel-tabby', '그 녀석의 교란에 걸려 영영 고물상 쓰레기 더미에 파묻힐 거다냥!'],
  ['mackerel-tabby', '철근 파편 사이로 정신을 잃고 뻗어버린다.'],
];

test('mackerel boss keeps all 6/8 supplied lines, speakers and order', () => {
  for (const [kind, expected] of [['intro', expectedIntro], ['clear', expectedClear]]) {
    const script = WORLD_CUTSCENES.find(value => value.id === `world-03-boss-${kind}`);
    assert.equal(script?.stageId, 'world-03-stage-boss');
    assert.deepEqual(script.beats.map(beat => [beat.dialogue?.[0]?.speaker, beat.dialogue?.[0]?.text]), expected);
    assert.deepEqual(script.beats.map(beat => beat.id), expected.map((_, index) => `mackerel-${kind}-${index + 1}`));
    assert.ok(script.beats.every(beat => beat.skipAllowedAfterSeen));
  }
});

test('dialogue scene is manual, camera follows both speakers, and fight starts after dialogue', async () => {
  const director = await readFile(new URL('../src/game/cutscenes/CutsceneDirector.ts', import.meta.url), 'utf8');
  const stage = await readFile(new URL('../src/game/scenes/StageScene.ts', import.meta.url), 'utf8');
  const names = await readFile(new URL('../src/components/game/DialogueBox.tsx', import.meta.url), 'utf8');
  assert.match(director, /id === "world-03-boss-intro" \|\| id === "world-03-boss-clear"/);
  assert.match(stage, /speaker === "cheese-tabby" \|\| speaker === "mackerel-tabby"/);
  assert.match(stage, /speaker === "corgi" \? this\.player/);
  assert.match(stage, /this\.runtime\.setStatus\("cutscene"\);[\s\S]*?this\.cutsceneDirector\.play\(introId\)/);
  assert.match(names, /"mackerel-tabby": "고등어 태비"/);
});
