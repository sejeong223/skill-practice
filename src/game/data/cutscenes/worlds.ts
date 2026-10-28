import type { CutsceneScript } from "@/game/cutscenes/types";

const WORLD01_BOSS_INTRO_LINES = [
  { speaker: "calico", text: "넌 누구냐옹?" },
  { speaker: "corgi", text: "턱시도 그 녀석 어디 있어! 내 왕갈비뼈를 내놔!" },
  { speaker: "calico", text: "아~ 그 영롱하고 육즙 터지는 갈비뼈?" },
  { speaker: "calico", text: "그건 이미 우리 행동대장 턱시도 형님이 본부로 모셔갔다냥." },
  { speaker: "corgi", text: "당장 비켜라, 냥아치!" },
  { speaker: "calico", text: "캬하학! 다리도 15cm밖에 안되는 게 어디서 행패냐옹?" },
  { speaker: "calico", text: "쫄병인 나 하나도 못 넘을 녀석이 형님을 쫓아가겠다고?" },
  { speaker: "calico", text: "억울하면 어디 한 번 지나가 봐라냥! 자, 간다냥!" },
] as const;

const WORLD01_BOSS_CLEAR_LINES = [
  { speaker: "calico", text: "윽... 이 둔해보이는 애가 대체 어떻게 날 때린 거냐옹...?!" },
  { speaker: "corgi", text: "패배자는 말이 없다! 턱시도 그 녀석 어디로 갔냐 멍?!" },
  { speaker: "calico", text: "칫... 어차피 턱시도 형님을 따라가 봤자 넌 끝이다냥!" },
  { speaker: "calico", text: "형님은 '동네 놀이터'로 가셨다냥!" },
  { speaker: "corgi", text: "놀이터? 그 모래사장과 미끄럼틀이 난무하는 곳을 말하는 건가?" },
  { speaker: "calico", text: "그래냥! 그곳을 지키는 우리 연합의 '치즈 태비' 녀석은 나랑 차원이 다르다냥!" },
  { speaker: "calico", text: "네 짧은 다리로는 미끄럼틀 하나도 못 올라가고 미끄러져서 평생 태초마을이나 빙빙 돌 거다냥!" },
  { speaker: "calico", text: "말을 마친 후 기절한다." },
] as const;

const WORLD02_BOSS_INTRO_LINES = [
  { speaker: "cheese-tabby", text: "뭐냥? 이 잘 구워진 인절미 같은 녀석은?" },
  { speaker: "corgi", text: "네 녀석이 치즈 태비냐? 턱시도는 어디로 갔어!" },
  { speaker: "cheese-tabby", text: "턱시도 형님? 이미 왕갈비뼈를 물고 '공사장'으로 가셨다냥!" },
  { speaker: "cheese-tabby", text: "하지만 넌 절대 여기서 못 나간다냥!" },
  { speaker: "corgi", text: "당장 길을 비키지 않으면 네 귀여운 노란 털을 몽땅 뽑아버리겠다!" },
  { speaker: "cheese-tabby", text: "지옥의 놀이터에 온 걸 환영한다냥!" },
  { speaker: "cheese-tabby", text: "내 얌체 탱탱볼에 머리통 깨져서 집으로 돌아가라냥! 자, 난사 개시다냥!" },
] as const;

const WORLD02_BOSS_CLEAR_LINES = [
  { speaker: "cheese-tabby", text: "냥?! 내 무적의 탱탱볼 계산법이 틀렸단 말이냐냥...?!" },
  { speaker: "corgi", text: "공놀이는 내가 너보다 백배는 더 많이 해봤다 멍! 이제 턱시도가 간 곳을 불어라!" },
  { speaker: "cheese-tabby", text: "크윽... 억울하다냥! 어차피 넌 다음 구역에서 바비큐가 될 거다냥!" },
  { speaker: "cheese-tabby", text: "턱시도 형님은 '위험천만한 공사장' 구역으로 넘어가셨다냥!" },
  { speaker: "corgi", text: "공사장? 철근과 시멘트 가루가 날리는 그 위험한 곳 말이냐?" },
  { speaker: "cheese-tabby", text: "그래냥! 그곳을 지키는 베테랑 간부 '고등어 태비' 형님이 널 시멘트에 반죽해 버릴 거다냥!" },
  { speaker: "cheese-tabby", text: "네 짧은 다리로는 굳지 않은 시멘트에 발이 묶여서 평생 공사장 마스코트나 될 거다냥!" },
  { speaker: "cheese-tabby", text: "눈이 골뱅이가 된 채 핑글핑글 돌며 기절한다." },
] as const;

export const WORLD02_ENTRANCE_CUTSCENE: CutsceneScript = {
  id: "world-02-intro",
  stageId: "world-02-stage-1",
  beats: [
    {
      id: "playground-narration-1",
      durationMs: 6500,
      narration: "골목길의 그늘을 벗어난 코기의 눈앞에 나타난 것은... 인간 어린이들의 웃음소리가 깃들었던 평화의 땅, 놀이터.",
      skipAllowedAfterSeen: true,
    },
    {
      id: "playground-narration-2",
      durationMs: 6500,
      narration: "그러나 이곳은 15cm 다리를 가진 강아지에게 있어 거대한 시련의 던전이자, 고양이들이 개조한 무자비한 장소였다.",
      skipAllowedAfterSeen: true,
    },
    {
      id: "corgi-nervous-line",
      durationMs: 4000,
      dialogue: [{ speaker: "corgi", text: "...저 높이실화냐. 미끄럼틀이 아니라 까마득한 절벽이잖아." }],
      skipAllowedAfterSeen: true,
    },
    {
      id: "corgi-nervous-narration",
      durationMs: 4000,
      narration: "슬개골이 비명을 지르고 엉덩이가 공포로 떨려왔지만, 녀석은 멈추지 않는다.",
      skipAllowedAfterSeen: true,
    },
    {
      id: "corgi-nervous-narration-2",
      durationMs: 4000,
      narration: "녀석의 뇌리를 스치는 단 하나의 향기... [투뿔 한우 육즙]!",
      skipAllowedAfterSeen: true,
    },
    {
      id: "corgi-resolved-narration",
      durationMs: 4500,
      narration: "15cm 짧은 다리가 모래사장을 힘차게 박차며 앞으로 한 걸음 내딛는다.",
      skipAllowedAfterSeen: true,
    },
    {
      id: "corgi-resolved-line",
      durationMs: 3200,
      dialogue: [{ speaker: "corgi", text: "...가자! 육즙은 기다려주지 않는다!" }],
      skipAllowedAfterSeen: true,
    },
  ],
};

export const WORLD03_ENTRANCE_CUTSCENE: CutsceneScript = {
  id: "world-03-intro",
  stageId: "world-03-stage-1",
  beats: [
    {
      id: "construction-reveal",
      durationMs: 7500,
      narration: "지옥의 놀이터를 헤쳐 나온 코기의 앞에 웅장한 위엄을 드러낸 곳은... 철근과 시멘트 가루가 춤추는 위험천만 공사장.",
      musicKey: "world-03-factory",
      skipAllowedAfterSeen: true,
    },
    {
      id: "construction-noise",
      durationMs: 7000,
      narration: "사방에서 들려오는 진동드릴 소음과 굴착기의 굉음 속에서, 냥아치들은 이미 자신들만의 요새를 구축하고 있었다.",
      soundCue: "world-03-drill",
      skipAllowedAfterSeen: true,
    },
    {
      id: "corgi-cough",
      durationMs: 5000,
      dialogue: [{ speaker: "corgi", text: "콜록콜록! 이 먼지 구덩이에 시멘트 냄새까지... 강아지 호흡기 다 망가지겠네!" }],
      skipAllowedAfterSeen: true,
    },
    {
      id: "rebar-cement",
      durationMs: 7500,
      narration: "시뻘건 철근이 사방으로 널려 있고, 발 밑은 아직 굳지 않은 촉촉한 시멘트가 코기의 짧은 다리를 유혹하고 있었다.",
      skipAllowedAfterSeen: true,
    },
    {
      id: "rib-instinct",
      durationMs: 6500,
      narration: "누가 봐도 냥아치들의 덫이지만, 15cm 다리의 왕갈비뼈 집착 본능은 위험을 아예 지워버렸다.",
      skipAllowedAfterSeen: true,
    },
    {
      id: "corgi-resolved",
      durationMs: 4800,
      dialogue: [{ speaker: "corgi", text: "먼지 좀 마시면 어때! 내 갈비뼈만 찾으면 그만이다, 기다려라 냥아치들!" }],
      skipAllowedAfterSeen: true,
    },
  ],
};

export const WORLD_CUTSCENES: readonly CutsceneScript[] = [
  { id: "world-01-intro", stageId: "world-01-stage-1", beats: [{ id: "alley", durationMs: 3200, narration: "무법지대 뒷골목. 왕갈비뼈를 훔쳐간 냥아치 연합의 흔적이 골목 끝으로 이어진다.", musicKey: "world-01-peaceful", skipAllowedAfterSeen: true }] },
  WORLD02_ENTRANCE_CUTSCENE,
  WORLD03_ENTRANCE_CUTSCENE,
  { id: "world-04-intro", stageId: "world-04-stage-1", beats: [{ id: "rooftop", durationMs: 3200, narration: "냥아치 아지트가 된 고물상. 쌓인 고철과 자석 뒤에 행동대장 턱시도가 숨어 있다.", musicKey: "world-04-rooftop", skipAllowedAfterSeen: true }] },
  { id: "world-05-intro", stageId: "world-05-stage-1", beats: [{ id: "kingdom", durationMs: 3200, narration: "최종 캣타워 공성전. 왕갈비뼈의 냄새가 메인쿤의 왕좌 뒤에서 진하게 풍겨온다.", musicKey: "world-05-kingdom", skipAllowedAfterSeen: true }] },
  { id: "world-02-boss-intro", stageId: "world-02-stage-boss", beats: WORLD02_BOSS_INTRO_LINES.map((line, index) => ({
    id: `cheese-intro-${index + 1}`, durationMs: 3000, dialogue: [line], skipAllowedAfterSeen: true,
  })) },
  { id: "world-03-boss-intro", stageId: "world-03-stage-boss", beats: [{ id: "mackerel", durationMs: 3000, narration: "공사장 감독 고등어가 벽돌 조각을 집어 든다. 날아온 벽돌은 잠깐 바닥을 막는다!", skipAllowedAfterSeen: true }] },
  { id: "world-04-boss-intro", stageId: "world-04-stage-boss", beats: [{ id: "tuxedo", durationMs: 3000, narration: "고물상 한가운데, 턱시도가 고철을 떨어뜨린다. 자석 신호가 나면 고철이 한 번 더 움직인다!", skipAllowedAfterSeen: true }] },
  { id: "world-05-boss-intro", stageId: "world-05-stage-boss", beats: [{ id: "maine-coon", durationMs: 3000, narration: "캣타워의 메인쿤이 코기를 계속 노리는 생쥐를 난사한다. 털뭉치 낙하 지점도 살펴야 한다!", skipAllowedAfterSeen: true }] },
  {
    id: "world-01-boss-intro",
    stageId: "world-01-stage-boss",
    beats: WORLD01_BOSS_INTRO_LINES.map((line, index) => ({
      id: `calico-intro-${index + 1}`,
      durationMs: 3000,
      dialogue: [line],
      skipAllowedAfterSeen: true,
    })),
  },
  {
    id: "world-01-boss-clear",
    stageId: "world-01-stage-boss",
    beats: WORLD01_BOSS_CLEAR_LINES.map((line, index) => ({
      id: `calico-clear-${index + 1}`,
      durationMs: 3000,
      dialogue: [line],
      skipAllowedAfterSeen: true,
    })),
  },
  { id: "world-02-boss-clear", stageId: "world-02-stage-boss", beats: WORLD02_BOSS_CLEAR_LINES.map((line, index) => ({
    id: `cheese-clear-${index + 1}`, durationMs: 3000, dialogue: [line], skipAllowedAfterSeen: true,
  })) },
  { id: "world-03-boss-clear", stageId: "world-03-stage-boss", beats: [{ id: "dash-reward", durationMs: 2400, narration: "고등어를 이겼다! 코기는 새 기술 '대시'를 배웠다. 짧은 다리에도 이제 돌진의 힘이 생겼다.", soundCue: "stage-clear", skipAllowedAfterSeen: true }] },
  { id: "world-04-boss-clear", stageId: "world-04-stage-boss", beats: [{ id: "jump-reward", durationMs: 2400, narration: "턱시도를 이겼다! 코기는 새 기술 '더블 점프'를 배웠다. 다음은 최종 캣타워다.", soundCue: "stage-clear", skipAllowedAfterSeen: true }] },
  { id: "world-05-boss-clear", stageId: "world-05-stage-boss", beats: [{ id: "rotor-reward", durationMs: 2400, narration: "메인쿤을 이겼다! 코기는 마지막 기술 '꼬리 모터'를 배웠다. 이제 왕갈비뼈를 들고 집으로 돌아가자!", soundCue: "stage-clear", skipAllowedAfterSeen: true }] },
];
