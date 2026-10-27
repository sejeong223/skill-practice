# Task: T03 공용 클리어·스킬 해금 화면과 월드 3 진입

## Status: pending

## Goal

치즈 태비의 마지막 대사가 끝난 뒤 기존 `[STAGE CLEAR!]` 화면, 물기 내용으로 바뀐 기존 `[SKILL UNLOCKED!]` 화면을 차례로 보여주고 `world-03-stage-1`로 이동한다. 월드 1의 짖기 해금 → 클리어 → 월드 2 입장 흐름은 그대로 작동한다.

## Decision Summary

- 새 모달/Scene을 복제하지 않는다. 기존 `World01StageClearScene`과 `World01SkillUnlockScene`의 Phaser Scene key를 유지하고, 타입·표시 데이터·다음 화면 분기만 월드 1/2에 맞게 넓힌다.
- 월드 2의 `stage-completed` 자동 180ms 이동을 결과 화면보다 먼저 실행하지 않는다. `runtime.complete()`는 코인·클리어 저장을 위해 한 번만 실행한다.

## Implementation

### I01. 두 보스 공용 표시 데이터와 입력 계약

- Related Files:
  - `src/game/data/bossVictoryPresentation.ts` :: `BOSS_VICTORY_PRESENTATION`, `BossVictoryStageId`, `BossVictoryPresentation` — 화면 내용과 이동 대상의 단일 원천; new
  - `src/game/scenes/World01StageClearScene.ts` :: `World01StageClearSceneData`, `create`, `continueToNextStage` — 기존 화면을 두 월드에 사용; modify
  - `src/game/scenes/World01SkillUnlockScene.ts` :: `World01SkillUnlockSceneData`, `create`, `continueToStageClear` — 기존 해금 화면을 두 월드에 사용; modify
  - `src/game/stages/stageEvents.ts` :: `"stage-clear-scene-opened"`, `"skill-unlock-scene-opened"` — 월드 2 payload 허용; modify
  - `src/game/config.ts` :: Scene 등록 목록 — Scene key가 그대로 유지되는지 확인만; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  export type BossVictoryStageId = "world-01-stage-boss" | "world-02-stage-boss";
  export interface BossVictoryPresentation {
    readonly nextStageId: "world-02-stage-1" | "world-03-stage-1";
    readonly skillId: "bark" | "bite";
    readonly skillName: string;
    readonly skillDescription: string;
    readonly skillEffectNote: string;
    readonly backgroundKey: string;
    readonly bossTextureKey: string;
    readonly defeatedFrame: 2 | 3;
    readonly defeatedFlipX: boolean;
    readonly clearButtonLabel: string;
  }
  export const BOSS_VICTORY_PRESENTATION: Readonly<Record<BossVictoryStageId, BossVictoryPresentation>>;
  export interface World01StageClearSceneData {
    readonly stageId: BossVictoryStageId;
    readonly nextStageId: "world-02-stage-1" | "world-03-stage-1";
  }
  export interface World01SkillUnlockSceneData extends World01StageClearSceneData {
    readonly skillId: "bark" | "bite";
  }
  ```
- **Data & Schema Fields**:
  - `world-01-stage-boss`: `nextStageId="world-02-stage-1"`, `skillId="bark"`, `skillName="짖기"`, `skillDescription="맹렬한 멍멍 소리로 보스 고양이를 순간 당황시킵니다"`, `skillEffectNote="(※ 보스 공격 패턴을 잠시 멈출 수 있습니다.)"`, `backgroundKey="world-01-roof-day-mid"`, `bossTextureKey="world-01-calico-boss"`, `defeatedFrame=2`, 기존 시각 방향과 `clearButtonLabel="NEXT STAGE ->"` 보존.
  - `world-02-stage-boss`: `nextStageId="world-03-stage-1"`, `skillId="bite"`, `skillName="물기"`, `skillDescription="코기의 날카로운 이빨로 적을 앙숙처럼 물어뜯어 큰 피해를 줍니다."`, `skillEffectNote="(※ 보스의 체력이 2만큼 감소합니다.)"`, `backgroundKey="world-02-background-mid"`, `bossTextureKey="world-02-cheese-tabby-boss"`, `defeatedFrame=3`, `defeatedFlipX=true`, `clearButtonLabel="계속 ->"`.
  - `ProgressState.clearedStages: StageId[]`, `unlockedSkills: SkillId[]`, `selectedWorldId: "world-01" | "world-02" | null`은 기존 필드 그대로 사용한다. 새 영속 필드는 없다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: 두 화면은 `stageId`가 공용 config에 있고 전달된 `nextStageId`/`skillId`가 config와 맞는지, `GameEventBus`와 `progress`가 있는지 검증한다. 해금 화면은 해당 skill과 clear stage가 저장됐는지도 확인한다. 기존 오류 화면을 stage별 안내로 확장한다.
  2. Core Processing: 패널 크기·테두리·타이포그래피·키보드/포인터 입력·250ms 지연은 기존 Scene에서 공유한다. background와 쓰러진 보스 이미지만 config로 고르고, 해금 제목/설명/효과 문구를 config에서 렌더링한다. 월드 1 짖기 내용은 글자 그대로 유지한다.
  3. Error & Exception Handling: texture key가 없는 경우 기존처럼 이미지 없이 패널을 렌더링한다. 잘못된 데이터면 다음 Scene으로 이동하지 않는다. SHUTDOWN에서 입력 리스너와 타이머를 해제한다.
  4. State Transition & Return: 월드 1 해금 버튼 → `World01StageClearScene` → `World02EntranceScene` 기존 순서. 월드 2 클리어 버튼 → `World01SkillUnlockScene` → `StageScene`(`stageId="world-03-stage-1"`, `playerName=progress.playerName`) 새 순서. 각 단계에서 `transitioning`을 먼저 세워 중복 클릭을 막는다.

### I02. 월드 2 승리 핸들러와 저장

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `handleLaterBossDefeat`, `"stage-completed"` 구독 — 마지막 대사 뒤 수동 결과 화면으로 전환; modify
  - `src/game/scenes/PreloadScene.ts` :: `getSelectedWorldResume` 사용 — 저장 후 재진입 확인; read-only
  - `src/game/systems/worldSelection.ts` :: `getSelectedWorldResume` — `selectedWorldId=null`일 때 진행 목록으로 복귀하는 경로 확인; read-only
  - `src/game/stages/StageRuntime.ts` :: `complete` — 완료 이벤트·코인 정산 한 번 확인; read-only
  - `scripts/world02-victory-flow.test.mjs` :: 결과 화면 계약/순서/저장 회귀; new
  - `scripts/world-selection.test.mjs` :: 기존 월드 선택 저장 회귀; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  private async handleLaterBossDefeat(stage: StageDefinition): Promise<void>;
  // stage-completed: { stageId: StageId; nextStageId: StageId | null; bankedCoins: number }
  // runtime.complete(): void
  ```
- **Data & Schema Fields**: 월드 2 보상은 기존 `BOSS_COMBAT_CONFIG["world-02"].rewardSkill === "bite"`를 재사용한다. `SkillSystem.unlockAfterBoss("world-02-boss")`와 `progress.unlockedSkills`의 중복 방지 로직을 유지한다.
- **Execution Flow / Logic**:
  1. Precondition & Validation: `victorySequenceStarted`, `bossEncounter.isDefeated()`, 컷신 완료 후 `scene.isActive()`를 기존처럼 검사한다.
  2. Core Processing: world02 clear 컷신의 8번째 beat를 마칠 때까지 전투·입력을 잠그고 `await`한다. 그 뒤 bite를 한 번만 해금하고 `selectedWorldId=null`로 두어 새로고침 시 모두 클리어된 월드 2 첫 맵으로 돌아가는 현재 재개 버그를 막는다. `runtime.complete()`로 보상/코인/클리어를 저장한다. `"stage-completed"` 구독은 world02 boss도 월드 1처럼 자동 180ms StageScene 이동에서 제외하되 기존 `rememberWorld02Visit` 및 완료 처리는 수행한다. 마지막으로 `scene.start("World01StageClearScene", {stageId:"world-02-stage-boss",nextStageId:"world-03-stage-1"})`.
  3. Error & Exception Handling: 같은 승리 콜백 반복은 `victorySequenceStarted`로 무시하고, 컷신 중 Scene이 종료됐다면 저장/화면 전환을 진행하지 않는다. 월드 3~5는 기존 자동 진입/엔딩 흐름을 따른다.
  4. State Transition & Return: clear 모달이 처음 나타날 때 `clearedStages`에 world02 boss, `unlockedSkills`에 bite가 각각 한 번 기록되어 있다. 프로덕션 모드 새로고침 시 월드 3 첫 미클리어 스테이지로 재개된다. 개발 모드 `PreloadScene`의 의도적인 월드 2 보스 강제 시작은 별도 설정이다.

### I03. 결과 흐름 통합 검증

- Related Files:
  - `scripts/world02-victory-flow.test.mjs` :: `BOSS_VICTORY_PRESENTATION` 계약, 단계 순서 및 월드 1 회귀; new
  - `.memory/test-plans/2026-10-27-world02-cheese-tabby-victory-review.md` :: 브라우저 수동 검증 기록; new

#### Details

- 새 단위 테스트는 월드 1/2 config가 실제 `getNextStageId`와 일치하고, 해금 기술/문구/스프라이트 키/프레임이 맞는지 검사한다. Scene 간 전환은 실제 브라우저에서 월드 2 치명타 → 8줄 대화 → `[STAGE CLEAR!]` → `[SKILL UNLOCKED!]` 물기 → 월드 3 첫 맵 순서로 검증하고, world01 재도전의 기존 반대 순서도 확인한다. 결과 화면에서 여러 번 클릭해도 전환은 한 번만 일어나는지 확인한다.

## Acceptance Criteria

- [ ] 마지막 대사 직후 월드 2 `[STAGE CLEAR!]`가 먼저 뜨고, 다음에 물기 해금 화면이 뜬다.
- [ ] 물기 이름·설명·HP 2 안내가 정확히 표시되고 다음 입력 시 월드 3 첫 스테이지가 열린다.
- [ ] bite 해금/월드 2 완료가 저장되고 월드 1의 기존 화면 순서는 변하지 않는다.
- [ ] 월드 2 자동 이동 타이머가 결과 화면을 건너뛰지 않는다.

## Validation

- `node --test scripts/world02-victory-flow.test.mjs scripts/world-selection.test.mjs scripts/stage-progression.test.mjs` — 데이터 계약·기존 이동 순서 회귀 통과.
- `node node_modules/typescript/bin/tsc --noEmit` — 공용 Scene data/event 타입 검사 통과.
- `node node_modules/eslint/bin/eslint.js src/game/data/bossVictoryPresentation.ts src/game/scenes/World01StageClearScene.ts src/game/scenes/World01SkillUnlockScene.ts src/game/scenes/StageScene.ts src/game/stages/stageEvents.ts scripts/world02-victory-flow.test.mjs` — lint 오류 0개.
- `node node_modules/next/dist/bin/next build` — Scene 등록과 client bundle 빌드 통과.
- 브라우저 결과를 `.memory/test-plans/2026-10-27-world02-cheese-tabby-victory-review.md`에 기록한다.

## Commit Message

```text
feat(world02): 클리어와 물기 해금 화면을 재사용하기

Plan: 2026-10-27-world02-cheese-tabby-victory-story-bite
Phase: P01-boss-victory-flow
Task: T03-clear-unlock-flow

- 월드 2 전투 후 클리어와 물기 해금 화면을 차례로 연결
- 월드 1 화면 순서와 진행 저장을 유지하며 월드 3으로 전환
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
