import type { CutsceneScript } from "@/game/cutscenes/types";

export const WORLD_CUTSCENES: readonly CutsceneScript[] = [
  { id: "world-01-intro", stageId: "world-01-stage-1", beats: [{ id: "alley", durationMs: 3200, narration: "무법지대 뒷골목. 왕갈비뼈를 훔쳐간 냥아치 연합의 흔적이 골목 끝으로 이어진다.", musicKey: "world-01-alley", skipAllowedAfterSeen: true }] },
  { id: "world-02-intro", stageId: "world-02-stage-1", beats: [{ id: "playground", durationMs: 3200, narration: "삐걱거리는 놀이터. 미끄럼틀 아래에서 고양이들의 수상한 웃음소리가 들린다.", musicKey: "world-02-amusement", skipAllowedAfterSeen: true }] },
  { id: "world-03-intro", stageId: "world-03-stage-1", beats: [{ id: "junkyard", durationMs: 3200, narration: "냥아치 연합 아지트, 버려진 고물상. 여기서부터 함정은 노골적으로 억까를 시작한다.", musicKey: "world-03-factory", skipAllowedAfterSeen: true }] },
  { id: "world-04-intro", stageId: "world-04-stage-1", beats: [{ id: "rooftop", durationMs: 3200, narration: "바람이 몰아치는 옥상 지대. 꼬리 모터가 돌기 시작하면 발밑의 상식도 함께 날아간다.", musicKey: "world-04-rooftop", skipAllowedAfterSeen: true }] },
  { id: "world-05-intro", stageId: "world-05-stage-1", beats: [{ id: "kingdom", durationMs: 3200, narration: "냥아치 연합 본거지. 갈비뼈의 냄새가 우두머리의 왕좌 뒤에서 진하게 풍겨온다.", musicKey: "world-05-kingdom", skipAllowedAfterSeen: true }] },
  { id: "world-01-boss-clear", stageId: "world-01-stage-boss", beats: [{ id: "bark-reward", durationMs: 2400, narration: "첫 우두머리를 넘어서자 코기의 목청이 한층 더 우렁차졌다.", dialogue: [{ speaker: "corgi", text: "멍!" }], soundCue: "bark", skipAllowedAfterSeen: true }] },
  { id: "world-02-boss-clear", stageId: "world-02-stage-boss", beats: [{ id: "bite-reward", durationMs: 2400, narration: "두 번째 승리. 이제 코기의 이빨은 간식 봉지도 긴장하게 만든다.", soundCue: "bark", skipAllowedAfterSeen: true }] },
  { id: "world-03-boss-clear", stageId: "world-03-stage-boss", beats: [{ id: "dash-reward", durationMs: 2400, narration: "세 번째 승리. 짧은 다리에서 믿을 수 없는 돌진이 튀어나온다.", soundCue: "stage-clear", skipAllowedAfterSeen: true }] },
  { id: "world-04-boss-clear", stageId: "world-04-stage-boss", beats: [{ id: "jump-reward", durationMs: 2400, narration: "네 번째 승리. 코기는 드디어 발끝이 바닥에서 멀어지는 기쁨을 알게 된다.", soundCue: "stage-clear", skipAllowedAfterSeen: true }] },
  { id: "world-05-boss-clear", stageId: "world-05-stage-boss", beats: [{ id: "rotor-reward", durationMs: 2400, narration: "마지막 우두머리가 쓰러졌다. 왕갈비뼈를 향한 마지막 꼬리 모터가 회전한다.", soundCue: "stage-clear", skipAllowedAfterSeen: true }] },
];
