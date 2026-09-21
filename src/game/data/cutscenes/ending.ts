import type { CutsceneScript } from "@/game/cutscenes/types";

export const ENDING_CUTSCENE: CutsceneScript = {
  id: "ending-homecoming",
  stageId: "world-05-stage-boss",
  beats: [
    { id: "homecoming", durationMs: 3600, narration: "모든 스테이지를 돌파한 코기는 마침내 전설의 무한 육즙 왕갈비뼈를 되찾아 집으로 돌아왔다.", actors: [{ actor: "corgi", action: "hold" }], musicKey: "ending-credits", skipAllowedAfterSeen: true },
    { id: "owner-praise", durationMs: 3000, dialogue: [{ speaker: "owner", text: "잘 기다렸어, 코기야!" }], actors: [{ actor: "owner", action: "enter" }], soundCue: "bark", skipAllowedAfterSeen: true },
    { id: "rib-pull", durationMs: 2600, narration: "주인은 코기의 머리를 쓰다듬으며 입에 물고 있던 전설의 갈비뼈를 쑥 빼냈다.", actors: [{ actor: "rib", action: "steal" }], skipAllowedAfterSeen: true },
    { id: "window-throw", durationMs: 3600, dialogue: [{ speaker: "owner", text: "자, 코기야!! 물어와!!!!" }], actors: [{ actor: "rib", action: "throw" }], camera: [{ kind: "pan", x: 1100, y: 210, durationMs: 850 }], soundCue: "cat-taunt", skipAllowedAfterSeen: true },
    { id: "confused-bark", durationMs: 2200, dialogue: [{ speaker: "corgi", text: ".......멍?" }], actors: [{ actor: "corgi", action: "hold" }], soundCue: "whine", skipAllowedAfterSeen: true },
    { id: "final-leap", durationMs: 3800, narration: "코기는 방금 전까지 사투를 벌였던 창문 밖을 향해 또다시 몸을 날렸다.", actors: [{ actor: "corgi", action: "leap" }, { actor: "rib", action: "throw" }], camera: [{ kind: "zoom", value: 1.3, durationMs: 700 }], skipAllowedAfterSeen: true },
    { id: "to-be-continued", durationMs: 2600, narration: "[ TO BE CONTINUED...? ]", camera: [{ kind: "fade", durationMs: 700 }], skipAllowedAfterSeen: true },
    { id: "credits-chase", durationMs: 7000, narration: "CREDITS — 코기는 아직도 갈비뼈를 향해 달려가고 있다.", actors: [{ actor: "corgi", action: "leap" }, { actor: "rib", action: "throw" }], musicKey: "ending-credits", skipAllowedAfterSeen: true },
  ],
};
