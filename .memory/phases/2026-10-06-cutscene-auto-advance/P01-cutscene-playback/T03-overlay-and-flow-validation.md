# Task: T03 자동 진행 안내와 전체 흐름 검증

## Status: done

## Goal

자동으로 다음 문장으로 넘어가는 대화창임을 화면에서 알 수 있게 하고, 오프닝·보스 대사·기존 컷신이 Enter 없이 끝나는지 전체 흐름을 확인한다. 선택적 빠른 넘김과 대사 이후 선택 단계는 유지한다.

## Decision Summary

- 오프닝과 월드 1 보스 대사는 타이머로 자동 진행하면서 클릭·Space·Enter의 빠른 넘김도 제공한다.
- `cutscene-beat.manualAdvance`는 기존 이벤트 이름을 유지한다. 이 필드가 `true`일 때 대화창의 **선택적** 빠른 넘김 버튼을 표시하며, 자동 타이머의 유무를 뜻하지 않는다.
- 인트로 뒤 타이틀/이름 입력과 월드 1 보스 승리 뒤 `NEXT STAGE ->`는 대사가 끝난 후 사용자 선택을 기다리는 화면이다.

## Implementation

### I01. 대화창의 자동 진행 안내

- Related Files:
  - `src/components/game/CutsceneOverlay.tsx` :: `CutsceneOverlay`, `advanceLabel`, `handleAdvance`; modify
  - `src/game/stages/stageEvents.ts` :: `StageEventMap["cutscene-beat"].manualAdvance` 설명; modify (필드 타입은 유지)
  - `src/components/game/TypewriterText.tsx` :: `durationMs`의 80% 글자 출력과 `forceReveal`; read-only
  - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` :: Next 16 클라이언트 컴포넌트 가이드; read-only, 코드 작성 전에 확인

#### Details

- **Signatures & Types**:
  ```typescript
  interface CutsceneOverlayState {
    readonly manualAdvance: boolean;
    readonly textComplete: boolean;
    readonly forceReveal: boolean;
    // 나머지 beat, index, totalBeats, skipAllowed, captionIndex, captionCount 필드 유지
  }
  ```
- **Data & Schema Fields**: `cutscene-beat` payload의 필드·타입은 바꾸지 않는다. `manualAdvance?: boolean`에 “타이머와 별개로 선택적 빠른 넘김 허용”이라는 의미를 코드 주석으로 명시한다.
- **Execution Flow / Logic**:
  1. `manualAdvance=true`일 때 기존 버튼을 유지하고, 버튼 주변에 `자동으로 다음 문장으로 진행됩니다`라고 안내한다. 버튼에는 현재 동작(`문장 끝까지 보기` 또는 `다음 대사`/`다음 장면`/`대화 마치기`)과 `선택 · 클릭 / Space / Enter`를 표시해 키 입력이 필수가 아님을 드러낸다.
  2. `handleAdvance`의 첫 입력은 아직 출력 중인 문장을 완전히 공개하고, 다음 입력은 `cutscene-advance-requested`를 발행하는 기존 동작을 유지한다. 자동 타이머는 별도 입력 없이 T01/T02가 처리한다.
  3. `manualAdvance=false`인 기존 자동 컷신에는 빠른 넘김 버튼을 새로 추가하지 않는다. 건너뛰기 버튼과 Escape 키는 재시청 허용 조건을 그대로 따른다.
- **Failure/State**: 컷신이 끝나면 `cutscene-finished`로 대화창이 사라진다. 새로운 캡션에서 이전 문장의 `forceReveal`/`textComplete` 상태를 재사용하지 않는다.

### I02. 전체 진행 확인

- Related Files:
  - `src/game/scenes/IntroScene.ts` :: `finishCutscene`; read-only (T02에서 수정 완료)
  - `src/game/cutscenes/CutsceneDirector.ts` :: 보스·월드·엔딩 컷신; read-only (T01에서 수정 완료)
  - `src/game/scenes/StageScene.ts` :: `world-01-boss-intro` 완료 후 전투 시작, `handleCalicoDefeat`; read-only
  - `src/game/scenes/World01StageClearScene.ts` :: 수동 `NEXT STAGE ->`; read-only
  - `src/components/game/GameShell.tsx` :: `introGateStep`과 컷신 이벤트; read-only

#### Details

- **Validation flow**:
  1. 새 저장 데이터에서 화면을 열고 어떤 대사 진행 키도 누르지 않는다. 오프닝의 나레이션과 대사가 각기 표시된 후 타이틀/이름 화면이 열리는지 확인한다. 이름을 입력하기 전에는 월드 1 스테이지가 시작되지 않아야 한다.
  2. 월드 1 보스 스테이지에서 처음 등장 컷신 8줄을 입력 없이 본다. 마지막 줄 뒤 플레이어 조작과 보스 공격이 시작되어야 한다.
  3. 보스를 처치한 뒤 승리 컷신 8줄을 입력 없이 본다. 마지막 줄의 기절 프레임이 표시된 뒤 `[STAGE CLEAR!]` 화면이 열린다. `NEXT STAGE ->`를 누르기 전에는 월드 2로 넘어가지 않는다.
  4. 월드 2~5 인트로와 보스 클리어, 엔딩 컷신은 공용 타임라인을 사용한다. 가능한 접근 경로에서 자동 완료와 긴 문장의 완전한 글자 출력을 확인한다. 이 콘텐츠의 대본·ID·스테이지 진행 규칙은 변경하지 않는다.
  5. 오프닝/보스 대사에서 클릭·Space·Enter로 빠른 넘김을 시도하고, 이미 본 컷신에서는 건너뛰기를 시도한다. 자동 타이머가 뒤늦게 다시 전환하지 않아야 한다.
- **Failure/State**: 수동 화면 확인이 실행 환경에서 불가능하면 그 범위를 검증 기록에 명시하고, 타입 검사·린트·빌드·시간/타임라인 테스트 결과와 구분한다. 미확인 화면을 통과했다고 표시하지 않는다.

## Acceptance Criteria

- [x] 오프닝과 월드 1 보스 등장·승리 대사는 Enter 없이 자동으로 마지막 줄까지 진행된다.
- [x] 대화창이 자동 진행과 선택적 빠른 넘김을 분명히 안내한다.
- [x] 긴 문장은 글자가 완성된 후 다음 장면으로 넘어가고 짧은 장면은 기본 `durationMs`보다 빨리 끝나지 않는다.
- [x] 인트로 뒤 이름 입력과 보스 승리 뒤 `NEXT STAGE ->`는 그대로 사용자 선택을 기다린다.
- [x] 중복 컷신 종료·중복 스테이지 전환·컷신 종료 후 남은 타이머가 없다.

## Validation

- `node --experimental-strip-types --test scripts/cutscene-auto-advance.test.mjs` → 시간 계산과 타임라인 회귀 통과.
- `npx.cmd tsc --noEmit` → 컷신 이벤트/UI 타입 검사 통과.
- `npm.cmd run lint` → 변경된 컴포넌트/이벤트 린트 통과.
- `npm.cmd run build` → 게임 앱 빌드 통과.
- `npm.cmd run dev` → 위 I02의 오프닝, 보스, 선택 단계, 재시청 수동 확인.

## Validation Notes

- 자동 테스트 5개, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build` 통과.
- Chrome에서 새 저장 데이터로 오프닝 11장면이 Enter 없이 약 85초 뒤 타이틀에 도달했다. 빠른 넘김, 재시청 건너뛰기, 이름 입력 대기까지 확인했다.
- 저장 상태로 월드 1 보스 등장 8줄을 확인했고, 브라우저 검증 세션에서 보스 처치 상태를 만든 뒤 실제 승리 처리 경로의 8줄과 `[STAGE CLEAR!]` 전환을 확인했다. `NEXT STAGE ->`는 16초 이상 입력을 기다렸다. 전투 자체는 이 검증에서 재현하지 않았다.
- 같은 공용 타임라인으로 월드 2 소개 1장면과 엔딩 8장면이 자동 완료되고 각 종료 이벤트가 한 번씩 발생했다. 월드 3~5의 개별 화면 진입은 확인하지 않았으며 같은 `CutsceneDirector` 경로를 사용한다.
- 오프닝/보스에서 첫 클릭은 문장 전체 공개, 다음 클릭은 장면 이동이었다. 재시청 건너뛰기 뒤 5초 이상 대화창이 다시 나타나지 않았다.

## Commit Message

```text
feat(cutscene): clarify automatic dialogue progression

Plan: 2026-10-06-cutscene-auto-advance
Phase: P01-cutscene-playback
Task: T03-overlay-and-flow-validation

- Explain that dialogue continues automatically
- Verify opening, boss dialogue, and post-dialogue choices
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `feat(cutscene): 대사 자동 진행 안내와 전체 흐름 검증`
