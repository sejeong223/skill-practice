# Task: T01 저장된 온보딩은 한 번만 표시

## Status: done

## Goal
온보딩을 마친 사용자가 새로고침하거나 다시 접속해도 오프닝과 이름 입력을 다시 보지 않도록 저장 상태를 읽기 전에 게임 장면이 시작되는 초기화 경쟁을 막는다.

## Decision Summary
- `ProgressState`에 명시적인 `onboardingCompleted` 불리언을 저장한다. 기본값은 `false`; 이름 확인 시 `true`가 된다.
- 저장 envelope schema를 2로 올리되 localStorage key `legendary-rib-corgi:progress:v1`은 유지한다. schema 0/1 세이브는 `seenCutsceneIds`에 `intro-home`이 있으면 온보딩 완료로 마이그레이션한다.
- 세이브를 React에 hydrate하기 전에는 Phaser를 마운트하지 않는다. 저장된 온보딩 상태에 따라 기존 월드 1 Stage 1 또는 최초 오프닝을 시작한다.

## Implementation

### I01. 저장 스키마와 이전 세이브 마이그레이션
- Related Files:
  - `src/game/core/types.ts` :: `ProgressState` — 완료 상태 필드 추가; modify
  - `src/game/core/constants.ts` :: `DEFAULT_VERSION`, `createDefaultProgressState` — 신규 기본값 정의; modify
  - `src/game/persistence/saveTypes.ts` :: `SaveSchemaVersion`, `SAVE_SCHEMA_VERSION` — envelope 버전 2; modify
  - `src/game/persistence/migrations.ts` :: `migrateSave` — 0/1 저장 읽기와 완료 추론; modify

#### Details
- **Signatures & Types**:
  ```typescript
  interface ProgressState {
    version: number;
    onboardingCompleted: boolean;
    // existing persisted fields remain unchanged
  }

  export function createDefaultProgressState(playerName?: string): ProgressState;
  export function migrateSave(input: unknown): ProgressState;
  export type SaveSchemaVersion = 2;
  ```
- **Data & Schema Fields**:
  - `ProgressState.onboardingCompleted`: non-nullable `boolean`, 기본값 `false`.
  - 신규 schema 2 세이브는 해당 필드를 저장한다.
  - schema 0/1에 필드가 없으면 `seenCutsceneIds.includes("intro-home")` 결과를 사용한다. 기존 이름, 사망 수, 코인, 해금, 도구, 아이템, 조작키는 기존 마이그레이션처럼 보존한다.
  - `PROGRESS_STORAGE_KEY`는 기존 값 `legendary-rib-corgi:progress:v1`로 유지한다. 저장 키를 바꾸면 기존 세이브를 못 읽는다.
- **Execution Flow / Logic**:
  1. 기본 진행 상태에 `onboardingCompleted: false`를 설정한다.
  2. 마이그레이션은 envelope schema version 0, 1, 2를 허용하고 2보다 큰 값은 기존 fallback 경로를 따른다.
  3. 입력 필드가 불리언이면 저장 값을 사용한다. 구형 세이브에 값이 없으면 `intro-home` cutscene 기록을 완료 상태로 승격한다.
  4. 마이그레이션 결과의 `ProgressState.version`은 2로 반환한다.

### I02. 저장 상태 hydrate 후 장면 및 온보딩 화면 선택
- Related Files:
  - `src/components/game/GameShell.tsx` :: `GameShell`, `handleNameConfirm` — 저장 hydrate와 gate 초기값; modify
  - `src/game/scenes/PreloadScene.ts` :: `create` — 최초 장면 선택; modify
  - `src/game/scenes/IntroScene.ts` :: `create`, `startCutscene`, `player-name-confirmed` listener — 이미 본 오프닝 생략 및 온보딩 완료 전파; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // In GameShell, retain the current event and persistence APIs.
  const [progressLoaded, setProgressLoaded] = useState(false);
  const handleNameConfirm: (name: string) => void;

  // Existing scene create methods remain public and keep their Phaser signatures.
  public create(data?: IntroSceneData): void;
  public create(): void; // PreloadScene
  ```
- **Execution Flow / Logic**:
  1. `GameShell` loads `ProgressStore` in its existing effect, copies it into the shared progress object, and selects gate state: `ready` when `onboardingCompleted`; `title` when the intro was seen but onboarding is incomplete; otherwise `intro`.
  2. Keep the Phaser mount absent until `progressLoaded` is true. This guarantees Phaser `preBoot` receives the hydrated shared object rather than defaults.
  3. `PreloadScene.create()` reads registry key `progressState`. When `onboardingCompleted` is true, start `StageScene` with `{ stageId: "world-01-stage-1", playerName: progress.playerName }`. Otherwise start `IntroScene` as today.
  4. `IntroScene.create()` builds its regular background/actors. If `seenCutsceneIds` already contains `INTRO_CUTSCENE.id`, do not call `startCutscene()`; leave the intro scene available behind the title/name overlay. If not seen, play the opening normally.
  5. On name confirmation, set `progress.onboardingCompleted = true` before emitting `player-name-confirmed`; existing autosave on that event stores it. Keep `seenCutsceneIds` write in `finishCutscene()` so legacy and new cutscene tracking stay intact.
  6. Do not alter current stage-resume semantics, cutscene scripts, or any non-onboarding save data.

## Acceptance Criteria
- [ ] A new save with no `intro-home` marker shows the opening, title, and name form.
- [ ] Completing name confirmation writes `onboardingCompleted: true` using the existing autosave event.
- [ ] Reloading a completed save mounts Phaser only after hydration and starts Stage 1 without opening/title/name overlays.
- [ ] A saved intro marker with incomplete onboarding skips the opening but keeps the name gate available.
- [ ] A schema 1 save with `intro-home` in `seenCutsceneIds` migrates to completed onboarding without losing existing progress.
- [ ] The localStorage key remains unchanged.

## Validation
- `npm.cmd run lint` — ESLint completes successfully.
- `npm.cmd run build` — Next.js production build and TypeScript checking complete successfully.

## Commit Message
```text
feat(game-flow): 오프닝을 최초 접속에만 표시

Plan: 2026-09-25-onboarding-reset
Phase: P01-onboarding-and-reset
Task: T01-one-time-onboarding

- 온보딩 완료 상태를 저장하고 구형 세이브를 보존
- 저장된 상태를 읽은 뒤 오프닝 또는 월드 1을 시작
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `TBD`
