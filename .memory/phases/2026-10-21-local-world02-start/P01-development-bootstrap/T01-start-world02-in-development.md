# Task: T01 로컬 개발 실행의 월드 2 시작

## Status: done

## Goal

개발 서버를 새로 열거나 새로고침하면 브라우저 저장이 없거나 월드 1을 선택했던 경우에도 월드 2 첫 스테이지로 들어간다. 미시청 월드 2 인트로는 보여 주고, 기존 코인·장비·사망 기록과 배포 실행의 저장 복원은 유지한다.

## Decision Summary

- 개발 모드 시작만 강제한다. 서버/클라이언트에서 이미 사용하는 `process.env.NODE_ENV`의 `development` 값을 기준으로 한다.
- 게임 HUD 상태는 `GameShell`이 공유하는 `ProgressState`, 실제 Phaser 시작 장면은 `PreloadScene.create`가 결정하므로 두 곳을 함께 맞춘다. `page.tsx`의 `initialStageId`만 바꾸는 구현은 금지하되, 로딩 중 월드 1 제목이 잠깐 뜨지 않도록 초기 HUD 값도 월드 2로 맞춘다.

## Implementation

### I01. 개발 시작 정책을 순수 함수로 분리

- Related Files:
  - `src/game/systems/developmentWorld02Start.ts` :: `prepareDevelopmentWorld02Progress`, `getDevelopmentWorld02Entry` — new.
  - `src/game/core/types.ts` :: `ProgressState`, `StageId` — read-only.
  - `src/game/data/cutscenes/worlds.ts` :: `WORLD02_ENTRANCE_CUTSCENE.id` — read-only.

#### Details

- **Signatures & Types**:

  ```ts
  function prepareDevelopmentWorld02Progress(progress: ProgressState, isDevelopment: boolean): ProgressState;
  function getDevelopmentWorld02Entry(progress: ProgressState, isDevelopment: boolean):
    | { readonly sceneKey: "World02EntranceScene"; readonly data: { readonly nextStageId: "world-02-stage-1" } }
    | { readonly sceneKey: "StageScene"; readonly data: { readonly stageId: "world-02-stage-1"; readonly playerName: string } }
    | null;
  ```
- **Data & Schema Fields**: 새 저장 필드는 없다. 개발 모드에서만 `onboardingCompleted=true`, `selectedWorldId="world-02"`, `clearedStages`에 `"world-01-stage-boss"`, `unlockedSkills`에 `"bark"`, `seenCutsceneIds`에 `"intro-home"`를 중복 없이 보충한다. `playerName`, 코인, 소유/장착 장비, 꾸미기, 사망 통계와 다른 컬렉션은 그대로 복사한다. 프로덕션에서는 입력 값을 그대로 반환한다.
- **Execution Flow / Logic**: 미시청 `world-02-intro`는 `World02EntranceScene` 데이터 `{ nextStageId: "world-02-stage-1" }`, 시청 완료 시 `StageScene` 데이터 `{ stageId: "world-02-stage-1", playerName }`를 반환한다. 개발 모드가 아니면 `null`을 반환해 기존 저장 복원 경로로 넘긴다. 함수는 저장소에 직접 쓰지 않는다.
- **Error & Exception Handling**: `ProgressStore.load`와 기존 `migrateSave`가 유효한 `ProgressState`를 제공한다. 함수는 입력 배열을 변경하지 않고 이미 표시가 있어도 중복 삽입하지 않는다.
- **State Transition & Return**: 새 메모리 상태와 진입 장면만 반환한다. 저장 이벤트가 발생하면 기존 `AutoSaveCoordinator`가 이를 저장할 수 있다.

### I02. GameShell과 PreloadScene에 연결

- Related Files:
  - `src/components/game/GameShell.tsx` :: 진행 상태 로드 `useEffect` — modify. `storeRef.current.load()` 직후 개발용 보정 값을 공유 상태/UI 복원 기준으로 사용한다.
  - `src/game/scenes/PreloadScene.ts` :: `create` — modify. 필수 에셋 로드 오류가 없고 개발용 진입 값이 있으면 인트로/StageScene으로 시작하고, 그렇지 않으면 기존 저장·온보딩 분기를 유지한다.
  - `src/app/page.tsx` :: `Home`의 `initialStageId` — modify. 개발 모드의 초기 HUD 값만 `world-02-stage-1`로 맞추고 프로덕션은 월드 1 기본값을 유지한다. 이 값만 바꿔서는 실제 장면이 바뀌지 않는다.

#### Details

- **Execution Flow / Logic**: `GameShell`의 `progressLoaded`가 참이 된 다음 `PhaserGame`이 마운트되므로 공유 진행 상태 보정이 `PreloadScene.create`보다 먼저 적용된다. 배포 빌드에서는 보정/강제 진입을 모두 건너뛰고 기존 분기를 실행한다. 로컬 리셋 뒤에도 개발 시작점을 유지하되 별도 아이템/코인 초기화는 하지 않는다.
- **State Transition & Return**: 개발 모드 월드 2 첫 스테이지 또는 미시청 인트로; 배포 모드 기존 경로.

### I03. 경계와 브라우저 회귀 검증

- Related Files:
  - `scripts/development-world02-start.test.mjs` :: 새 저장·월드 1 저장·이미 본 인트로·배포 분기 테스트 — new.
  - `.memory/test-plans/2026-10-21-local-world02-start.md` :: 실제 실행 결과 — new.
  - `scripts/world-selection.test.mjs`, `scripts/stage-progression.test.mjs` — read-only; 인접 회귀.

#### Details

- **검증 시나리오**: 새 기본 상태와 월드 1 선택/미클리어 저장은 로컬에서 월드 2 인트로 또는 StageScene으로 간다. 월드 2 인트로가 저장돼 있으면 중복 재생하지 않는다. 월드 2 후속 스테이지가 클리어돼 있어도 개발 시작은 첫 스테이지다. 기존 코인·장비·사망 값을 유지한다. `isDevelopment=false`일 때 함수는 입력을 바꾸지 않고 정상 복원 결과를 그대로 사용한다.
- **실제 화면**: `npm run dev`의 새 저장/기존 저장을 별도 브라우저 프로필 또는 CDP 저장 주입으로 확인하고, 인트로 및 스테이지 HUD와 월드 선택 버튼이 정상인지 기록한다. 브라우저 오류와 필수 에셋 404는 0건이어야 한다.

## Acceptance Criteria

- [x] 로컬 개발 서버에서 월드 1 저장 여부와 관계없이 월드 2 인트로(미시청) 또는 첫 스테이지로 시작한다.
- [x] 코인·장비·사망 통계는 유지되고 월드 선택 버튼이 열리며, 월드 1 재방문도 가능하다.
- [x] 배포 모드의 새 저장/기존 저장 복원은 기존과 같고, 타입·린트·빌드·관련 테스트와 실제 브라우저 검증이 통과한다.

## Validation

- `node --test scripts/development-world02-start.test.mjs scripts/world-selection.test.mjs scripts/stage-progression.test.mjs` — 시작 정책과 기존 월드 선택/진행 회귀.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 검사.
- `npm.cmd run lint` — 린트 검사.
- `npm.cmd run build` — 프로덕션 빌드.
- 개발 서버에서 브라우저 신규/기존 저장으로 실제 시작 장면 확인; 기존 서버가 실행 중이면 재사용하고 테스트용 프로세스만 정리한다.

## Commit Message

```text
feat(world02): 로컬 개발 실행을 월드 2부터 시작

Plan: 2026-10-21-local-world02-start
Phase: P01-development-bootstrap
Task: T01-start-world02-in-development

- 개발 모드에서 저장과 관계없이 월드 2 첫 스테이지로 진입
- 인트로와 진행 상태를 맞추고 배포 시작 경로를 유지
```

## Progress

- [x] 구현 완료 — 개발 전용 진행 상태와 장면 선택을 연결하고 초기 HUD 값도 맞췄다.
- [x] 검증 통과 — 관련 테스트 14건, 타입·린트·빌드, Chrome 새 저장·기존 저장·월드 1 재방문.
- commit: 이 Task의 한국어 커밋
