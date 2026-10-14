# Task: T02 월드 1 승리 뒤 짖기 해금 안내 화면

## Status: done

## Goal

월드 1 삼색이 승리 대사의 마지막 문장이 끝난 뒤, 기존 `[STAGE CLEAR!]`보다 먼저 짖기 해금 안내를 보여준다. 클릭 또는 Enter/Space로 안내를 넘겨 기존 클리어 화면으로 이동한다.

## Decision Summary

- 해금 문구 네 줄은 사용자 원문 그대로 사용한다. 새 Scene은 기존 월드 1 클리어 Scene과 같은 1280×720 화면·Galmuri11Pixel 글꼴·어두운 패널 톤으로 만든다.
- 보상과 클리어 저장 시점은 기존 `StageScene.handleCalicoDefeat()`에 둔다. 새 화면은 이미 저장된 상태를 보여주고 다음 Scene으로 넘기는 역할만 맡는다.

## Implementation

### I01. 기존 승리 후 전환을 새 화면으로 연결

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `StageScene.handleCalicoDefeat()`; modify.
  - `src/game/systems/SkillSystem.ts` :: `SkillSystem.unlockAfterBoss()`; read-only.
  - `src/game/stages/StageRuntime.ts` :: `StageRuntime.complete()`; read-only.
  - `src/game/scenes/PreloadScene.ts` :: 이미 완료된 월드 1의 클리어 화면 복원 경로; read-only.

#### Signatures & Types

```typescript
private async handleCalicoDefeat(): Promise<void>;
```

#### Data & Schema Fields

- `ProgressState.unlockedSkills: SkillId[]`에는 `bark`가 정확히 한 번, `ProgressState.clearedStages: StageId[]`에는 `world-01-stage-boss`가 정확히 한 번 들어간다. 새 영속 필드는 없다.
- 새 Scene 시작 데이터는 `{ stageId: "world-01-stage-boss", nextStageId: "world-02-stage-1", skillId: "bark" }`다.

#### Execution Flow / Logic

1. 기존 `victorySequenceStarted` 및 승리 대사 완료 후 `this.scene.isActive()`/보스 패배 검사, `bark` 중복 검사, `unlockAfterBoss("world-01-boss")`, `this.runtime?.complete()` 순서를 그대로 둔다.
2. 마지막 `this.scene.start("World01StageClearScene", ...)`만 `World01SkillUnlockScene` 시작으로 교체한다. 클리어 이벤트를 두 번 보내거나 `runtime.complete()`를 새 Scene에서 다시 호출하지 않는다.
3. `PreloadScene`의 완료된 저장 데이터 복원은 기존처럼 `World01StageClearScene`으로 곧바로 간다. 안내 화면을 봤는지에 대한 별도 저장 상태를 만들지 않는다.

### I02. 해금 안내 Scene 및 입력 경계

- Related Files:
  - `src/game/scenes/World01SkillUnlockScene.ts` :: `World01SkillUnlockScene`; new.
  - `src/game/config.ts` :: `createPhaserConfig()`의 `scene` 배열; modify.
  - `src/game/scenes/World01StageClearScene.ts` :: 기존 `World01StageClearSceneData`와 스타일 참고; read-only.

#### Signatures & Types

```typescript
export interface World01SkillUnlockSceneData {
  readonly stageId: "world-01-stage-boss";
  readonly nextStageId: "world-02-stage-1";
  readonly skillId: "bark";
}

export class World01SkillUnlockScene extends Phaser.Scene {
  private transitioning: boolean;
  private canContinue: boolean;
  private stageData?: World01SkillUnlockSceneData;
  private continueDelay?: Phaser.Time.TimerEvent;
  public constructor();
  public create(data?: Partial<World01SkillUnlockSceneData>): void;
  private continueToStageClear(): void;
  private cleanup(): void;
}
```

#### Data & Schema Fields

- 화면에 표시할 정확한 문자열은 다음 네 줄이다. 첫 줄의 대괄호·느낌표, 세 번째 줄의 종결 형태, 네 번째 줄의 `※`와 괄호를 유지한다.

```text
[SKILL UNLOCKED!]
짖기
맹렬한 멍멍 소리로 보스 고양이를 순간 당황시킵니다
(※ 보스 공격 패턴을 잠시 멈출 수 있습니다.)
```

- 입력 상태는 Scene 생명주기에만 존재한다: `transitioning=false`, `canContinue=false`, `stageData=undefined`로 시작한다. 유효한 입력 데이터를 `stageData`에 보관하고, 250ms 지연 후 `canContinue=true`가 된다.

#### Execution Flow / Logic

1. Scene key는 정확히 `World01SkillUnlockScene`으로 등록하고, 1280×720 카메라를 중앙에 맞춘다. `data` 값과 registry의 `gameEventBus: GameEventBus`, `progressState: ProgressState`, 저장된 `bark`/보스 클리어 기록을 검사한다. 누락 시 명확한 오류 문구를 표시하고 전환하지 않는다.
2. 기존 `World01StageClearScene`의 월드 1 배경(`world-01-roof-day-mid`), 쓰러진 삼색이 이미지(`world-01-calico-boss` frame 2), 어두운 배경 패널을 참고해 네 문구를 읽기 쉬운 위치에 중앙 정렬한다. 대사는 Phaser 텍스트로 표시하고 새 PNG는 만들지 않는다. 입력을 알리는 별도 작은 `계속하기` 힌트는 본문 네 줄과 구별한다.
3. 화면 전체 클릭과 `keydown-ENTER`/`keydown-SPACE`를 `continueToStageClear()`에 연결한다. `canContinue`와 `transitioning`으로 대사 종료 키의 연속 입력 및 중복 클릭을 막는다.
4. 유효 입력 한 번에 `scene.start("World01StageClearScene", { stageId, nextStageId })`를 호출한다. `[STAGE CLEAR!]`는 새 Scene에 그리지 않는다. `World01StageClearScene`의 `NEXT STAGE ->`와 `World02EntranceScene` 전환은 변경하지 않는다.
5. `Phaser.Scenes.Events.SHUTDOWN`에서 pointer/keyboard 리스너와 지연 타이머를 해제한다. 재진입 시 상태를 다시 초기화한다.

### I03. React HUD 숨김 이벤트

- Related Files:
  - `src/game/stages/stageEvents.ts` :: `StageEventMap`에 `skill-unlock-scene-opened`; modify.
  - `src/components/game/GameEventBridge.tsx` :: 구독 이벤트 목록; modify.
  - `src/components/game/GameShell.tsx` :: `handleEvent`, `mode`, `GameOverlay` 표시 조건; modify.

#### Signatures & Types

```typescript
interface StageEventMap {
  "skill-unlock-scene-opened": {
    stageId: "world-01-stage-boss";
    skillId: "bark";
  };
}
```

#### Data & Schema Fields

- 이벤트는 화면 표시용이다. `AutoSaveCoordinator.SAVE_EVENTS`에 넣거나 새 저장 스키마를 만들지 않는다.
- `GameShell`의 기존 `mode: "stage-clear"`를 새 화면에도 사용해 `GameOverlay`를 숨긴다. `stage-clear-scene-opened`가 나중에 와도 같은 mode를 유지한다.

#### Execution Flow / Logic

1. 새 Scene이 정상 데이터를 확인한 뒤 `gameEventBus.emit("skill-unlock-scene-opened", { stageId, skillId })`을 한 번 보낸다.
2. `GameEventBridge`가 이를 React로 전달하고 `GameShell.handleEvent()`는 `setMode("stage-clear")`를 실행한다. 기존 `stage-started`, `cutscene-finished`와 클리어 이벤트의 처리 순서는 유지한다.
3. 화면 전환 후 `World01StageClearScene`이 기존 `stage-clear-scene-opened`를 내고, 월드 2 첫 스테이지의 `stage-started`가 mode를 다시 플레이로 되돌린다.

## Acceptance Criteria

- [ ] 승리 대사 8줄이 끝난 뒤 위 네 줄의 해금 안내가 먼저 표시되고, 그동안 `[STAGE CLEAR!]`와 게임 HUD는 보이지 않는다.
- [ ] 클릭·Enter·Space 각각 한 번으로 클리어 화면으로 이동하며 연속 입력으로 클리어 화면까지 건너뛰지 않는다.
- [ ] `bark`와 보스 클리어·코인 정산은 한 번만 기록된다. 새로고침하면 기존 클리어 복원 경로로 돌아간다.
- [ ] 기존 `NEXT STAGE ->` → 월드 2 진입 컷신 경로가 유지된다.

## Validation

- `npx.cmd eslint src/game/scenes/StageScene.ts src/game/scenes/World01SkillUnlockScene.ts src/game/config.ts src/game/stages/stageEvents.ts src/components/game/GameEventBridge.tsx src/components/game/GameShell.tsx` — 관련 파일 린트 통과.
- `npx.cmd tsc --noEmit` — Scene 데이터·이벤트 타입 검사 통과.
- `node --test scripts/world01-respawn.test.mjs scripts/stage-progression.test.mjs` — 기존 저장·진행 경로 회귀 검사 통과.
- `npm.cmd run build` — 프로덕션 빌드 통과.
- 개발 실행에서 실제 보스 승리 대사 → 안내 → 입력 → 클리어 → 월드 2 진입을 확인하고, 안내 중 새로고침/연속 입력 시 저장된 스킬·클리어 기록에 중복이 없는지 확인한다.

## Commit Message

```text
feat(world01): 짖기 해금 안내를 클리어 전에 표시

Plan: 2026-10-14-world01-bark-unlock-and-korean-skills
Phase: P01-skill-ui-and-bark
Task: T02-world01-bark-unlock-scene

- 보스 승리 대사 뒤 해금 안내 Scene 연결
- 클릭과 키보드 진행 및 HUD 숨김 처리
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (eslint, TypeScript, 기존 테스트 9건, build, Scene 입력·전환 하네스)
- commit: pending
