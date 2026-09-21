# Task: T03 나레이터 컷신·스킵·사운드·음악 이벤트

## Status: pending

## Goal

도입부·월드 시작·보스 처치 후·주요 발견 지점·엔딩을 Phaser 카메라와 React 텍스트/일러스트 overlay로 연출하고, 첫 재생은 자동 실행하며 이미 본 컷신은 스킵 가능하게 만든다.

## Decision Summary

- 나레이터는 진지하고 장엄한 어조로 상황을 과장하고, 코기는 멍멍·끼잉·으르렁거림과 행동으로만 반응한다.
- 주인은 도입부와 엔딩에만 등장한다. 컷신은 귀여운 효과음과 불안하게 고조되는 음악을 대비시킨다.

## Implementation

### I01. 컷신 데이터와 타임라인

- Related Files:
  - src/game/cutscenes/CutsceneTimeline.ts :: CutsceneTimeline — new
  - src/game/cutscenes/CutsceneDirector.ts :: CutsceneDirector — new
  - src/game/data/cutscenes/intro.ts :: intro cutscene data — new
  - src/game/data/cutscenes/worlds.ts :: world cutscene data — new
  - src/game/data/cutscenes/ending.ts :: ending cutscene data — new

#### Details

- **Signatures & Types**:
  ~~~typescript
  export interface CutsceneBeat {
    id: string;
    durationMs: number;
    camera?: CameraAction[];
    actors?: ActorAction[];
    narration?: string;
    dialogue?: DialogueLine[];
    soundCue?: string;
    skipAllowedAfterSeen: boolean;
  }

  export class CutsceneDirector {
    play(id: string): Promise<void>;
    skip(): void;
    isPlaying(): boolean;
  }
  ~~~
- Intro beats must include: warm Sunday living room, black plastic bag, legendary rib item card, lore/stat icons, 기다려 command lock, tuxedo cat theft through balcony window, cat taunt, command break, rabbit slipper pickup, dog door escape, transition to 무법지대 뒷골목.
- The narrator must not say 최악의 생일. Final transition narration is “그렇게 코기는 생일 선물을 되찾기 위한 추격을 시작했다.”
- Ending beats must include exact owner sequence, .......멍?, [ TO BE CONTINUED...? ], and credits chase.

### I02. React overlay와 스킵

- Related Files:
  - src/components/game/CutsceneOverlay.tsx :: CutsceneOverlay — new
  - src/components/game/NarratorText.tsx :: NarratorText — new
  - src/components/game/DialogueBox.tsx :: DialogueBox — new
  - src/components/game/ItemCard.tsx :: ItemCard — new

#### Details

- first-seen cutscene은 StageScene이 player control을 lock하고 자동 실행한다.
- seenCutsceneIds에 있는 cutscene은 any key 또는 configured pause/confirm key로 skip할 수 있다.
- skip은 현재 beat audio/tween을 정리하고 scene state를 다음 stable gameplay state로 복귀시킨다.
- 나레이터 텍스트, owner dialogue, cat dialogue의 색상과 speaker label을 구분한다.

### I03. 사운드와 음악

- Related Files:
  - src/game/audio/AudioManager.ts :: AudioManager — new
  - src/game/audio/audioManifest.ts :: sound/music manifest — new
  - public/assets/audio/ — generated or authored audio; new

#### Details

- Sound keys include bark, whine, slipper-hit, sneeze, bowl-clang, stray-dog-rush, coin, checkpoint, death-cartoon, stage-clear, cat-taunt, rib-reveal.
- Music keys include birthday-warm, world-01-alley, world-02-amusement, world-03-factory, world-04-rooftop, world-05-kingdom, boss, ending-credits.
- first user gesture unlocks browser audio context. Stage transitions stop previous loops before starting new loops.
- event bus events drive sound cues; gameplay systems do not import React UI components.

## Acceptance Criteria

- [ ] 도입부 컷신이 지정된 순서와 나레이터 문장으로 재생된다.
- [ ] 첫 재생은 자동이고, 이미 본 컷신은 스킵 가능하다.
- [ ] 컷신 중 player input과 physics state가 안전하게 lock/unlock된다.
- [ ] 주인은 도입부와 엔딩에만 등장한다.
- [ ] 효과음·음악이 이벤트와 연결되고 scene 전환 후 이전 loop가 남지 않는다.

## Validation

- npm run lint — cutscene/audio overlay 타입 통과
- npm run build — cutscene data와 audio manifest build 통과
- npm run dev — intro·boss reward·ending·skip·audio unlock을 수동 확인

## Commit Message

~~~text
feat(presentation): add narrator cutscenes and audio timeline

Plan: 2026-09-21-legendary-rib-corgi
Phase: P03-progression-presentation
Task: T03-cutscenes-audio

- Add scripted intro, world beats, ending and skip rules
- Add event-driven sound effects and world music transitions
~~~

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
