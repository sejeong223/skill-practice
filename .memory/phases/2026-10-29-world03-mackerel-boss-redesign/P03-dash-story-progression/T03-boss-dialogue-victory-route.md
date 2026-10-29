# Task: T03 고등어 태비 전후 대화·승리 화면·월드 4 진입

## Status: pending

## Goal

사용자가 제공한 전투 전 6줄과 전투 후 8줄을 원문·순서대로 보여준다. 승리 후 `STAGE CLEAR!`→대시 해금→월드 4 인트로를 월드 1·2에서 쓰던 모달로 연결하고 저장·재방문에서 중복/건너뛰기를 올바르게 처리한다.

## Decision Summary

- 최종 수정된 순서는 **승리 대화→STAGE CLEAR→대시 해금→월드 4 인트로**다. 처음 눌렀던 ‘대시 해금→클리어’ 순서는 적용하지 않는다.
- 월드 3 보스 전후 임시 한 줄 나레이션을 정확한 6/8줄 대사로 교체한다. 월드 4는 이미 있는 `world-04-intro` 한 줄과 기존 고물상 배경을 활용하고 새 월드 4 대본·배경 제작은 하지 않는다.

## Implementation

### I01. 원문 대사 모델·화자·카메라

- Related Files:
  - `src/game/data/cutscenes/worlds.ts` :: 월드 3 보스 intro/clear beat — modify
  - `src/game/cutscenes/types.ts` :: `CutsceneSpeaker`에 `mackerel-tabby` — modify
  - `src/components/game/DialogueBox.tsx` :: 화자 `고등어 태비` 표시 — modify
  - `src/game/cutscenes/CutsceneDirector.ts` :: `isBossDialogue`에 월드 3 전후 ID — modify
  - `src/game/scenes/StageScene.ts` :: 월드 3 화자별 카메라 초점·전투 잠금·패배 프레임 — modify
  - `scripts/world03-boss-story.test.mjs` :: 원문·순서·화자·카메라·대화 잠금 — new
  - `scripts/stage-progression.test.mjs` :: 임시 월드 3 대사 기대값 교체 — modify

#### Details

- **Signatures & Types**:
  ```typescript
  type CutsceneSpeaker = /* existing */ | "mackerel-tabby";
  CutsceneDirector.play(id: "world-03-boss-intro" | "world-03-boss-clear"): Promise<void>;
  ```
- **Data & Schema Fields**: 전투 전 beat id `mackerel-intro-1`~`6`, 후 beat id `mackerel-clear-1`~`8`; 각 `dialogue:[{speaker,text}]`, 기본 durationMs 3000, `skipAllowedAfterSeen:true`. 첫 감상은 자동 진행/수동 다음 대사만, ESC 스킵 불가. 이후 재관람은 기록에 따라 스킵 가능. 마지막 줄도 `mackerel-tabby` 화자의 장면 지시 beat로 표시하며 텍스트를 바꾸지 않는다.
- **Execution Flow / Logic**:
  1. Precondition: `seenCutsceneIds`에 intro가 없으면 보스 `runtime.status="cutscene"`, 공격·코기 이동 잠금. 대사가 끝난 뒤에만 play/보스 공격 시작. 이미 본 intro는 기존 재대결 안내 후 시작한다.
  2. Core: `CutsceneDirector.isBossDialogue`에 두 World3 ID를 추가해 W1/2와 같은 수동 넘김을 허용한다. `StageScene`의 `cutscene-beat` listener는 `mackerel-tabby`일 때 보스, `corgi`일 때 코기로 초점을 이동한다. 후 대화는 HP0·공격/시멘트 제거·3번 쓰러짐 프레임·코기 조작 잠금 상태에서 재생한다.
  3. Error handling: 중복 승리 콜백은 `victorySequenceStarted`로 막고, scene 종료/스킵 뒤 비동기 continuation이 두 번째 모달이나 플레이 상태를 만들지 않게 `scene.isActive()`를 검사한다.
  4. State/return: 대화 완료는 `seenCutsceneIds`에 각각 한 번 기록한다. 대화 자체에는 대시 해금 문구를 끼워 넣지 않는다.

#### 확정 원고 — 전투 전

1. 고등어 태비: 요란하게 짖어대며 기어오더니, 꼴이 이게 뭐냥.
2. 코기: 네 녀석이 고등어 태비냐? 내 왕갈비뼈를 가져간 턱시도의 위치를 불어!
3. 고등어 태비: 턱시도 형님 말이지? 그라운드 작업은 이미 끝내고 우리의 아지트로 떴다냥.
4. 고등어 태비: 너 같은 숏다리가 여기까지 쫓아온 건 가상하지만... 선은 여기서 긋는다냥.
5. 코기: 휑한 공사장 따위가 내 전진을 막을 줄 알았냐 멍!
6. 고등어 태비: 입만 살아가지고... 뼈도 못 추리게 공사장 자갈맛을 보여주마. 자, 오늘은 네 제삿날이다냥!

#### 확정 원고 — 전투 후

1. 고등어 태비: 큭... 이 숏다리한테 내 공격이 무산되다니, 뼈가 으스러지는구만...
2. 코기: 동네 철근 좀 씹어먹었다고 유세 떨더니 별 것도 아니네 멍! 당장 턱시도가 어디로 갔는지 불어라!
3. 고등어 태비: 허... 성깔 하난 대단하네. 어차피 턱시도 형님 구역으로 가면 넌 보신탕 거리가 될 거다냥.
4. 고등어 태비: 턱시도 형님은 지금 고물상 아지트에 계시다냥!
5. 코기: 고물상 아지트? 거긴 또 어떤 잡동사니가 기다리고 있는 거냐!
6. 고등어 태비: 그래냥! 거긴 우리 연합의 진짜 행동대장인 턱시도 형님이 버티고 있는 본진이다냥.
7. 고등어 태비: 그 녀석의 교란에 걸려 영영 고물상 쓰레기 더미에 파묻힐 거다냥!
8. 고등어 태비: 철근 파편 사이로 정신을 잃고 뻗어버린다.

### I02. 기존 모달 재사용과 월드 3 자동 전환 차단

- Related Files:
  - `src/game/data/bossVictoryPresentation.ts` :: World3 boss→World4 + dash 데이터 — modify
  - `src/game/scenes/World01StageClearScene.ts` :: World3 입력 타입·클리어→해금 분기 — modify
  - `src/game/scenes/World01SkillUnlockScene.ts` :: World3 입력 타입·해금→World4 분기 — modify
  - `src/game/scenes/StageScene.ts` :: `handleLaterBossDefeat`, `stage-completed` 공통 리스너 — modify
  - `scripts/world02-victory-flow.test.mjs` :: W1/2 보존, W3 추가 — modify
  - `scripts/world03-victory-flow.test.mjs` :: 대화→두 모달→World4 순서 — new

#### Details

- **Signatures & Types**:
  ```typescript
  type BossVictoryStageId = "world-01-stage-boss" | "world-02-stage-boss" | "world-03-stage-boss";
  interface BossVictoryPresentation {
    nextStageId: "world-02-stage-1" | "world-03-stage-1" | "world-04-stage-1";
    skillId: "bark" | "bite" | "dash";
    /* existing display fields preserved */
  }
  ```
- **Data & Schema Fields**: World3 presentation `stageId="world-03-stage-boss"`, `nextStageId="world-04-stage-1"`, `skillId="dash"`, `skillName="대시"`, `skillDescription="숫자 1을 누르면 바라보는 방향으로 짧고 빠르게 돌진합니다."`, `skillEffectNote="(※ 0.25초 동안 공격 피해를 무시합니다. 재사용 대기 1.4초.)"`, `backgroundKey="world-03-background-mid-boss"`, `bossTextureKey="world-03-mackerel-boss"`, `defeatedFrame=3`, `defeatedFlipX=true`, `clearButtonLabel="계속 ->"`. 벽돌·바닥 틈을 통과한다는 문구는 쓰지 않는다.
- **Execution Flow / Logic**:
  1. Precondition: `handleLaterBossDefeat`가 clear 대화를 끝내고 `dash`를 해금·저장한 뒤 `runtime.complete()`를 호출한다.
  2. Core: `StageScene`의 일반 `stage-completed` 리스너에서 **월드 3 보스도 월드 1·2처럼 자동 전환 제외**한다. 현재는 W1/2만 제외하므로 이 조건을 바꾸지 않으면 180ms 뒤 World4 StageScene이 모달을 덮어쓴다. 대화 후 `World01StageClearScene`을 시작하고, 확인 시 `World01SkillUnlockScene`으로, 다시 확인 시 월드 4 인트로 경로로 이동한다. 두 모달의 누락/불일치 데이터 검증·250ms 연속 클릭 방지는 유지한다.
  3. Error handling: 해금/클리어 저장과 모달 이벤트를 한 번만 발행한다. 재도전에서 이미 해금한 경우에도 승리 화면 순서는 유지하되 중복 `skill-unlocked` 적립은 하지 않는다. 기존 W1 짖기→클리어 및 W2 클리어→물기 순서는 바꾸지 않는다.
  4. State/return: 보스 화면이 사라지기 전에 W3 clear 모달이 보이고, 다음 월드로 자동 이동하지 않는다.

### I03. 기존 한 줄 월드 4 인트로 연결

- Related Files:
  - `src/game/systems/world04IntroRouting.ts` :: 미시청/시청 진입 판별 — new
  - `src/game/scenes/World04EntranceScene.ts` :: 기존 대본과 기존 고물상 배경 1장으로 1 beat 표시 — new
  - `src/game/config.ts` :: 새 scene 등록 — modify
  - `src/game/scenes/World01SkillUnlockScene.ts` :: 해금 뒤 `getWorld04Entry` — modify
  - `src/game/scenes/PreloadScene.ts` :: 일반 저장의 첫 월드 4 재진입만 동일 라우팅 — modify
  - `src/game/data/cutscenes/worlds.ts` :: 기존 `world-04-intro` 원고 — read-only
  - `src/game/assets/assetManifest.json` :: 기존 `world-04-boss-scrapyard` 배경 — read-only
  - `scripts/world04-intro-routing.test.mjs` :: 첫 진입·시청 후·저장 복귀 — new

#### Details

- **Signatures & Types**:
  ```typescript
  type World04Entry =
    | { sceneKey: "World04EntranceScene"; data: { nextStageId: "world-04-stage-1" } }
    | { sceneKey: "StageScene"; data: { stageId: "world-04-stage-1"; playerName: string } };
  getWorld04Entry(progress: Pick<ProgressState, "seenCutsceneIds" | "playerName">): World04Entry;
  interface World04EntranceSceneData { readonly nextStageId: "world-04-stage-1" }
  ```
- **Data & Schema Fields**: 인트로 ID `world-04-intro`, 현행 대본 **“냥아치 아지트가 된 고물상. 쌓인 고철과 자석 뒤에 행동대장 턱시도가 숨어 있다.”**, durationMs 3200, musicKey `world-04-rooftop`. `World04EntranceScene`의 배경은 이미 필수 등록된 `world-04-boss-scrapyard`를 사용한다. 새 월드 4 아트·대사는 만들지 않는다.
- **Execution Flow / Logic**:
  1. Precondition: `seenCutsceneIds`에 `world-04-intro`가 없으면 전용 장면, 있으면 StageScene 직접 진입한다. 기존 개발 모드의 World3 강제 시작 정책은 변경하지 않는다.
  2. Core: Scene은 `cutscene-started/beat/finished` 이벤트를 기존 입장 장면과 같은 계약으로 보내고 첫 관람 자동 진행/ESC 스킵 불가, 이미 본 재관람만 스킵 허용한다. 종료 시 본 기록을 저장하고 `world-04-stage-1` StageScene을 시작한다.
  3. Error/cleanup: 잘못된 nextStageId·배경 누락은 오류 화면을 보여주고, 타이머/오디오/키 리스너는 shutdown에서 정리한다. 저장 재접속의 `firstUncleared===world-04-stage-1`과 `selectedWorldResume.stageId===world-04-stage-1` 중 인트로 미시청 경우도 같은 helper를 사용한다. 다른 단계의 직접 복귀는 우회시키지 않는다.
  4. State/return: 대시 해금 안내 종료 후 첫 월드 4 진입에서는 인트로를 보고, 같은 저장으로 돌아오면 인트로를 반복하지 않는다.

## Acceptance Criteria

- [ ] 전 6줄·후 8줄이 정확한 화자·문구·순서로 나오고 대화 중 공격/이동은 멈춘다.
- [ ] 후 대화 뒤 자동 World4 전환 없이 클리어→대시 해금 순서의 두 기존 모달이 표시된다.
- [ ] 첫 월드 4 진입은 기존 한 줄 인트로, 재진입은 바로 스테이지다.
- [ ] W1/W2 모달 순서와 스킵·저장 규칙은 유지된다.

## Validation

- `node --experimental-strip-types --test scripts/world03-boss-story.test.mjs scripts/world03-victory-flow.test.mjs scripts/world04-intro-routing.test.mjs scripts/world02-victory-flow.test.mjs scripts/stage-progression.test.mjs` — 대사·모달·월드 진입·W1/2 회귀 통과.
- `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build` — 타입·정적·빌드 통과.
- 실제 승리 UI에서 대사 14 beat, 모달 2장, 월드 4 인트로 한 번, 클릭/Enter 연타·저장 복귀 확인.

## Commit Message

```text
feat(월드3): 고등어 대화와 클리어 대시 해금 연결

Plan: 2026-10-29-world03-mackerel-boss-redesign
Phase: P03-dash-story-progression
Task: T03-boss-dialogue-victory-route

- 전후 대사 원문과 화자 카메라·쓰러짐 연출 반영
- 클리어 다음 대시 해금과 월드 4 인트로 라우팅 연결
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
