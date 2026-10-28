# Task: T04 첫 진입 경로와 통합 회귀

## Status: done

## Goal

월드 2 물기 해금 직후, 일반 저장 복귀, 개발 모드 첫 시작에서 아직 보지 않은 월드 3 인트로로 들어간다. 본 뒤 재시작과 이미 진행한 저장은 기존 스테이지 위치를 유지한다.

## Decision Summary

- 첫 월드 3 진입 판별 기준은 `seenCutsceneIds`에 `world-03-intro`가 없는 것이다. 새 장면은 `nextStageId:"world-03-stage-1"`을 받는다.
- 이미 본 개발 모드 재시작은 `StageScene`으로 바로 간다. 월드 1·2 선택 재도전과 월드 3의 2스테이지 이후 저장 복귀는 인트로 때문에 되감지 않는다.

## Implementation

### I01. 첫 방문 판별을 한 함수에 모으기

- Related Files:
  - `src/game/systems/world03IntroRouting.ts` :: `getWorld03Entry` — 첫 방문/재방문 반환 계약; new
  - `src/game/systems/developmentWorld03Start.ts` :: `getDevelopmentWorld03Entry`, `prepareDevelopmentWorld03Progress` — 개발 모드 시작 경로 변경, 기존 진행 복사 유지; modify
  - `scripts/development-world03-start.test.mjs` :: 개발 모드 진입 테스트 — 현재 첫 시작이 `StageScene`이라고 가정하는 테스트 수정; modify
  - `scripts/world03-entrance-routing.test.mjs` :: 순수 첫 방문 판별·진행 보존 테스트 — 새 테스트; new

#### Details

- **Signatures & Types**:
  ```typescript
  export type World03Entry =
    | { readonly sceneKey: "World03EntranceScene";
        readonly data: { readonly nextStageId: "world-03-stage-1" } }
    | { readonly sceneKey: "StageScene";
        readonly data: { readonly stageId: "world-03-stage-1"; readonly playerName: string } };
  export function getWorld03Entry(
    progress: Pick<ProgressState, "seenCutsceneIds" | "playerName">,
  ): World03Entry;
  export function getDevelopmentWorld03Entry(
    progress: ProgressState, isDevelopment: boolean,
  ): World03Entry | null;
  ```
- **Data & Schema Fields**:
  - `seenCutsceneIds`: `string[]`; `world-03-intro` 포함 여부만 읽고 함수에서 수정하지 않는다.
  - 개발 준비의 `clearedStages`는 월드 1·2 보스 클리어를 합집합으로, `unlockedSkills`는 bark·bite를 합집합으로, 이전 컷신 본 기록은 합집합으로 유지한다. `world-03-intro`는 추가하지 않아 첫 개발 시작에 재생된다. 기존 기록에 이미 있으면 보존한다.
- **Execution Flow / Logic**:
  1. `getWorld03Entry`는 미시청이면 `{sceneKey:"World03EntranceScene",data:{nextStageId:"world-03-stage-1"}}`, 시청했으면 `{sceneKey:"StageScene",data:{stageId:"world-03-stage-1",playerName:progress.playerName}}`를 반환한다.
  2. `getDevelopmentWorld03Entry`는 `isDevelopment=false`면 `null`, true면 위 함수를 호출한다. `prepareDevelopmentWorld03Progress`는 기존 코인·의상·사망·원본 배열을 바꾸지 않는다.
  3. 테스트는 새/기존 개발 저장, 이미 본 인트로, 일반 빌드, 중복 배열 방지, 원본 불변, 사용자 이름 보존을 검사한다.

### I02. 보스 보상 뒤와 프리로드 복귀 연결

- Related Files:
  - `src/game/scenes/World01SkillUnlockScene.ts` :: `continueToStageClear` — 월드 2 보스 물기 모달 완료 후 `getWorld03Entry` 결과로 전환; modify
  - `src/game/scenes/PreloadScene.ts` :: `create` — 개발·일반 복귀 시 첫 월드 3 진입; modify
  - `src/game/systems/worldSelection.ts` :: `getSelectedWorldResume` — 월드 1·2 재도전 우선순위 확인, 수정 불필요; read-only
  - `src/game/scenes/World01StageClearScene.ts` :: `continueToNextStage` — 월드 2 STAGE CLEAR → 물기 모달 순서 확인, 수정 불필요; read-only
  - `scripts/world03-entrance-routing.test.mjs` :: 보스·저장 경로 계약 검증; new

#### Details

- **Signatures & Types**:
  ```typescript
  private continueToStageClear(): void; // World01SkillUnlockScene
  public create(): void; // PreloadScene
  // World03EntranceSceneData: { readonly nextStageId:"world-03-stage-1" }
  ```
- **Data & Schema Fields**:
  - `World01SkillUnlockSceneData`의 `stageId:"world-02-stage-boss"`, `nextStageId:"world-03-stage-1"`, `skillId:"bite"` 검증을 유지한다.
  - 프리로드의 `firstUncleared`는 `STAGE_IDS` 중 `world-02-stage-4`를 건너뛰고 찾는다. `selectedWorldResume`가 있으면 월드 1·2 선택 재도전을 우선한다.
- **Execution Flow / Logic**:
  1. 물기 모달의 월드 2 분기에서 현재 `StageScene` 직행 대신 `getWorld03Entry(progress)`의 `sceneKey`·`data`로 시작한다. 월드 1 분기의 `World01StageClearScene` 전환은 그대로 둔다.
  2. `PreloadScene`의 기존 개발 분기는 새 반환 타입을 그대로 `scene.start`에 전달한다. 일반 진행은 `selectedWorldResume`와 월드 1→2 특별 처리 이후 `firstUncleared === "world-03-stage-1"`일 때만 `getWorld03Entry`를 사용한다. `firstUncleared`가 월드 3의 2·3·4스테이지 또는 보스라면 현 위치 `StageScene`으로 복귀해 옛 저장을 1스테이지로 되감지 않는다.
  3. 인트로가 끝나면 T03 장면에서 `cutscene-finished`를 발행하고 `seenCutsceneIds`에 추가한다. 기존 `AutoSaveCoordinator`가 이 이벤트로 저장하므로 이후 개발 서버 재시작은 바로 1스테이지로 간다.
  4. 테스트는 월드 2 보스 → STAGE CLEAR → 물기 해금 → 미시청 인트로 → 월드 3 첫 스테이지 순서와 재방문 직행, 일반 저장 복귀, 개발 초기·재시작, 월드 1·2 선택 재도전, 월드 3 후속 스테이지 저장 복귀를 검사한다. Phaser 모킹이 무겁다면 순수 라우팅 함수와 장면 전환 스파이를 조합하되 실제 장면 호출 경로를 반드시 확인한다.

### I03. 통합 검증과 기록

- Related Files:
  - `scripts/world03-entrance-routing.test.mjs` :: 진입 경로 통합 테스트; new
  - `scripts/stage-progression.test.mjs` :: 기존 진행 순서 회귀; read-only
  - `scripts/world03-entrance-scene.test.mjs` :: 인트로 수명 회귀; read-only
  - `.memory/test-plans/2026-10-28-world03-entrance-intro.md` :: 자동·브라우저·청음 결과와 남은 한계 기록; new

#### Details

- **Execution Flow / Logic**:
  1. 관련 자동 테스트와 전체 TypeScript·ESLint·빌드를 실행한다. 기존 미커밋 변경에서 비롯된 오류는 이 계획 변경과 구분해 검증 기록에 적는다.
  2. 브라우저에서 개발 새 저장의 첫 진입, 여섯 줄 자막과 초상화 전환, STAGE CLEAR·물기 모달 이후 일반 진행, 인트로 완료 후 저장·새로고침, 이미 본 인트로 스킵 가능 여부, 모바일 자막을 확인한다.
  3. 소리 출력이 가능한 환경이면 음악 아래 두 효과음이 짧고 구분되며 셋째 beat 전에 끝나는지 청음한다. 청음할 수 없다면 자동 검증과 별도로 미확인으로 기록한다.

## Acceptance Criteria

- [ ] 월드 2 첫 클리어 후 보상 모달을 마치면 월드 3 인트로를 한 번 보고 첫 스테이지로 간다.
- [ ] 개발 모드 첫 진입은 인트로, 이미 본 개발 모드 재시작은 첫 스테이지다.
- [ ] 일반 저장 복귀가 월드 3 첫 스테이지의 미시청 인트로를 보이며 후속 스테이지와 월드 1·2 재도전을 되감지 않는다.
- [ ] 월드 2 보스 보상·스테이지 클리어·오디오·자막 회귀가 없다.

## Validation

- `node --experimental-strip-types --test scripts/world03-entrance-routing.test.mjs scripts/development-world03-start.test.mjs scripts/world03-entrance-scene.test.mjs scripts/world03-entrance-content.test.mjs scripts/world03-intro-audio.test.mjs scripts/stage-progression.test.mjs scripts/audio-pause.test.mjs` — 인트로와 기존 진행 경로 통과.
- `node scripts/validate-assets.mjs` — 필수 세 그림 유효.
- `node scripts/generate-world03-intro-sfx.mjs --check` — 두 WAV 재현성 확인.
- `npx tsc --noEmit` — 전체 타입 통과.
- `npm run lint` — 전체 lint 통과.
- `npm run build` — Next 번들 통과.
- 브라우저·모바일 화면·청음 결과를 `.memory/test-plans/2026-10-28-world03-entrance-intro.md`에 기록한다.

## Commit Message

```text
feat(game): 월드 3 첫 진입에 공사장 인트로 연결

Plan: 2026-10-28-world03-entrance-intro
Phase: P01-construction-entrance
Task: T04-entry-routing-and-regression

- 일반 진행과 개발 모드의 첫 방문 경로 연결
- 저장 복귀·재방문·월드 2 보상 흐름 검증
```

## Progress

- [x] 구현 완료
- [x] 자동 검증 통과 (브라우저 연속 재생·모바일 화면·청음은 검증 기록에 한계 명시)
- commit: 이 Task의 Git 커밋 참조
