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

export const WORLD_CUTSCENES: readonly CutsceneScript[] = [
  { id: "world-01-intro", stageId: "world-01-stage-1", beats: [{ id: "alley", durationMs: 3200, narration: "무법지대 뒷골목. 왕갈비뼈를 훔쳐간 냥아치 연합의 흔적이 골목 끝으로 이어진다.", musicKey: "world-01-peaceful", skipAllowedAfterSeen: true }] },
  WORLD02_ENTRANCE_CUTSCENE,
  { id: "world-03-intro", stageId: "world-03-stage-1", beats: [{ id: "junkyard", durationMs: 3200, narration: "공사장 진입로. 크레인과 레미콘 차 사이로 냥아치 고등어의 발자국이 이어진다.", musicKey: "world-03-factory", skipAllowedAfterSeen: true }] },
  { id: "world-04-intro", stageId: "world-04-stage-1", beats: [{ id: "rooftop", durationMs: 3200, narration: "냥아치 아지트가 된 고물상. 쌓인 고철과 자석 뒤에 행동대장 턱시도가 숨어 있다.", musicKey: "world-04-rooftop", skipAllowedAfterSeen: true }] },
  { id: "world-05-intro", stageId: "world-05-stage-1", beats: [{ id: "kingdom", durationMs: 3200, narration: "최종 캣타워 공성전. 왕갈비뼈의 냄새가 메인쿤의 왕좌 뒤에서 진하게 풍겨온다.", musicKey: "world-05-kingdom", skipAllowedAfterSeen: true }] },
  { id: "world-02-boss-intro", stageId: "world-02-stage-boss", beats: [{ id: "cheese-tabby", durationMs: 3000, narration: "놀이터 대장 치즈 태비가 호루라기를 불고 고무공을 집어 든다.", skipAllowedAfterSeen: true }] },
  { id: "world-03-boss-intro", stageId: "world-03-stage-boss", beats: [{ id: "mackerel", durationMs: 3000, narration: "공사장 감독 고등어가 발밑에 벽돌 조각을 쌓으며 길을 막는다.", skipAllowedAfterSeen: true }] },
  { id: "world-04-boss-intro", stageId: "world-04-stage-boss", beats: [{ id: "tuxedo", durationMs: 3000, narration: "고물상 한가운데, 턱시도가 자석에 매단 고철을 코기 쪽으로 끌어당긴다.", skipAllowedAfterSeen: true }] },
  { id: "world-05-boss-intro", stageId: "world-05-stage-boss", beats: [{ id: "maine-coon", durationMs: 3000, narration: "캣타워 꼭대기의 메인쿤이 생쥐를 겨누고 털뭉치를 흩뿌린다.", skipAllowedAfterSeen: true }] },
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
  { id: "world-02-boss-clear", stageId: "world-02-stage-boss", beats: [{ id: "bite-reward", durationMs: 2400, narration: "치즈 태비를 이겼다! 코기는 새 기술 '물기'를 배웠다. 이제 간식 봉지도 긴장하겠군.", soundCue: "stage-clear", skipAllowedAfterSeen: true }] },
  { id: "world-03-boss-clear", stageId: "world-03-stage-boss", beats: [{ id: "dash-reward", durationMs: 2400, narration: "세 번째 승리. 짧은 다리에서 믿을 수 없는 돌진이 튀어나온다.", soundCue: "stage-clear", skipAllowedAfterSeen: true }] },
  { id: "world-04-boss-clear", stageId: "world-04-stage-boss", beats: [{ id: "jump-reward", durationMs: 2400, narration: "네 번째 승리. 코기는 드디어 발끝이 바닥에서 멀어지는 기쁨을 알게 된다.", soundCue: "stage-clear", skipAllowedAfterSeen: true }] },
  { id: "world-05-boss-clear", stageId: "world-05-stage-boss", beats: [{ id: "rotor-reward", durationMs: 2400, narration: "마지막 우두머리가 쓰러졌다. 왕갈비뼈를 향한 마지막 꼬리 모터가 회전한다.", soundCue: "stage-clear", skipAllowedAfterSeen: true }] },
];
