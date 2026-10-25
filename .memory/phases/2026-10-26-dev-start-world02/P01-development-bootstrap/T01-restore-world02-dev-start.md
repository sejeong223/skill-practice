# Task: T01 개발 서버를 월드2부터 시작

## Status: done

## Goal

`NODE_ENV=development`에서 새 저장과 기존 저장 모두 월드1 인트로, 이름 입력, 월드2 진입 컷신을 건너뛰고 월드2 1스테이지 게임플레이로 바로 들어가게 한다. 프로덕션 진입과 기존 진행 데이터는 보존한다.

## Decision Summary

- 기존 완료 기능 `4b3c6b2`의 월드2 개발 시작 정책을 복원한다. 뒤이은 `fd9c81b`에서 개발 첫 인트로를 매번 재생하도록 바뀌어 현재 요구와 어긋난다.
- 개발 모드에만 진행 상태를 보정하고 `PreloadScene`의 진입 장면을 분기한다. `page.tsx`의 초기 HUD도 월드2로 맞춘다.
- 개발 서버 시작 시에는 월드2 입구 컷신도 건너뛴다. 코인·장비·사망·기존 클리어 기록은 삭제하지 않는다.

## Implementation

### I01. 개발용 월드2 시작 정책

- Related Files:
  - `src/game/systems/developmentWorld02Start.ts` :: `prepareDevelopmentWorld02Progress`, `getDevelopmentWorld02Entry` — 개발 진행 상태와 시작 장면을 순수 함수로 결정; new.
  - `scripts/development-world02-start.test.mjs` :: 개발/프로덕션 시작 정책 검증; new.
  - `scripts/development-intro-start.test.mjs`, `src/game/systems/developmentIntroStart.ts` :: 이전 개발 인트로 반복 정책 검사와 helper; delete and replace with the new policy.

#### Details

- **Signatures & Types**:

  ```ts
  function prepareDevelopmentWorld02Progress(
    progress: ProgressState,
    isDevelopment: boolean,
  ): ProgressState;

  function getDevelopmentWorld02Entry(
    progress: ProgressState,
    isDevelopment: boolean,
  ): StageEntry | null;
  ```

  `getDevelopmentWorld02Entry`는 개발 모드에서 `{ sceneKey: "StageScene", data: { stageId: "world-02-stage-1", playerName: string } }`를 반환하고 프로덕션에서는 `null`을 반환한다.
- **Data & Schema Fields**: 저장 스키마를 변경하지 않는다. 개발 모드 복사본만 `onboardingCompleted: true`, `selectedWorldId: "world-02"`, `clearedStages`의 `"world-01-stage-boss"`, `unlockedSkills`의 `"bark"`, `seenCutsceneIds`의 `"intro-home"`를 중복 없이 보충한다. 기존 배열과 진행 값은 입력 객체를 변경하지 않고 보존한다. 프로덕션에서는 원래 객체를 그대로 반환한다.
- **Execution Flow / Logic**:
  1. `isDevelopment`가 거짓이면 시작 보정은 없고 진입 장면 함수는 `null`을 반환한다.
  2. 개발 모드에서는 복사된 진행 상태를 준비한다.
  3. `PreloadScene`은 월드2 진입 컷신의 시청 여부와 무관하게 `StageScene` 및 `world-02-stage-1`을 반환한다.
  4. 월드1 집 인트로·이름 화면·월드2 입구 컷신은 개발 부팅 경로에 포함하지 않는다.
- **Error & State Transition**: 저장 읽기·마이그레이션은 기존 `ProgressStore.load()`에 맡긴다. helper는 입력 배열을 직접 수정하지 않고, 존재하지 않는/중복된 완료·스킬·컷신 표시를 보정한다.

### I02. 부트 경로 연결

- Related Files:
  - `src/components/game/GameShell.tsx` :: 초기 로드 `useEffect` — 개발 진행 보정과 인트로 게이트 상태를 연결; modify.
  - `src/game/scenes/PreloadScene.ts` :: `create` — 개발 진입 장면을 일반 저장 복원보다 먼저 선택; modify.
  - `src/app/page.tsx` :: `Home` — 개발 초기 HUD를 월드2 1스테이지로 맞춤; modify.

#### Details

- `GameShell`은 `ProgressStore.load()` 결과를 helper에 전달하고 반환된 복사본을 Phaser와 HUD가 공유한다. 개발 모드에서는 `onboardingCompleted`가 참이 되어 인트로/이름 게이트를 표시하지 않는다.
- `PreloadScene.create`는 필수 에셋 오류가 없는 경우 `getDevelopmentWorld02Entry(progress, process.env.NODE_ENV === "development")` 결과를 우선 실행한다. 결과가 `null`이면 기존 온보딩·저장 복원 로직을 그대로 사용한다.
- `page.tsx`는 개발 모드에서만 `initialStageId="world-02-stage-1"`; 프로덕션에서는 기존 `world-01-stage-1`을 전달한다. 실제 Phaser 시작 장면은 `PreloadScene`이 결정한다.

### I03. 회귀 검증

- 새 저장/월드1 기존 저장/중복 마커/월드2 컷신 시청 여부와 무관한 바로 시작/프로덕션 분기를 단위 테스트한다.
- 기존 코인·소유 장비·사망 수·완료 기록을 보존하며 원본 객체를 변형하지 않는지 확인한다.

## Acceptance Criteria

- [x] 개발 모드에서 월드1 인트로, 이름 입력, 월드2 진입 컷신을 건너뛰고 월드2 첫 스테이지 플레이로 시작한다.
- [x] 개발 시작은 기존 코인·장비·사망 값을 보존하고, 기존 기록에 중복 마커를 넣지 않는다.
- [x] 프로덕션은 이전과 같은 신규 인트로 및 저장 복원 경로를 사용한다.

## Validation

- `node --experimental-strip-types --test scripts/development-world02-start.test.mjs scripts/world-selection.test.mjs scripts/stage-progression.test.mjs` — 개발 진입과 기존 월드/스테이지 선택 테스트 통과.
- `npx.cmd tsc --noEmit` — 타입 검사 통과.
- `npm.cmd run lint` — 린트 통과.
- `npm.cmd run build` — 프로덕션 빌드 및 프로덕션 인트로 분기 통과.

## Commit Message

```text
fix(startup): 개발 실행을 월드 2부터 시작

Plan: 2026-10-26-dev-start-world02
Phase: P01-development-bootstrap
Task: T01-restore-world02-dev-start

- 개발 모드에서 인트로와 이름 입력을 건너뛰고 월드2 첫 스테이지로 시작
- 진행 데이터를 보존하고 프로덕션 시작 경로를 유지
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `fix(startup): 개발 실행을 월드 2부터 시작`
