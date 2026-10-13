# Task: T03 클리어 문구를 보스 승리 후 월드 전환에만 표시

## Status: done

## Goal

일반 맵 끝을 통과할 때 완료 문구 없이 다음 맵으로 이동한다. 보스를 쓰러뜨리고 승리 대화를 마친 뒤 다음 월드로 넘어가는 전용 화면에서만 `STAGE CLEAR!`를 표시한다.

## Decision Summary

- T01/T02 이후 실행하고 전체 흐름을 통합 검증한다. 일반1→2→3→4→보스 진입에는 클리어 배너/저장 알림을 표시하지 않는다. 보스 패배/깃발 복귀도 동일하다.
- 소스 확인 시 `[STAGE CLEAR!]`는 World01StageClearScene에만 있고, 일반 StageScene에는 이전 작업으로 큰 문구가 제거된 상태다. 남아 있는 GameShell의 `스테이지 클리어를 저장했습니다.` 토스트를 제거하고 실제 표시 경로를 확인한다. 존재하지 않는 일반 맵 Text 객체를 원인으로 단정하지 않는다.
- `stage-completed`는 진행 기록/코인 처리/자동 저장/다음 맵 전환에 필요하므로 이벤트를 삭제하거나 보스 전용으로 제한하지 않는다. 화면 표시만 분리한다. 효과음 변경은 이번 요청에 포함하지 않는다.

## Implementation

### I01. 일반 맵 완료 알림 제거

- Related Files:
  - `src/components/game/GameShell.tsx` :: handleEvent/messages, UiMode — 완료 저장 토스트 제거와 표시 조건 유지; modify.
  - `src/components/game/GameEventBridge.tsx` :: 이벤트 전달 — stage-completed 전달 유지; read-only.
  - `src/game/scenes/StageScene.ts` :: stage-completed 구독, handleCalicoDefeat — 정상 자동 전환/보스 승리 분기 확인; read-only(T01/T02 결과 유지).
  - `src/game/scenes/World01StageClearScene.ts` :: create, continueToNextStage — 보스 전용 STAGE CLEAR 표시 유지; read-only.
  - `src/game/scenes/PreloadScene.ts` :: 보스 클리어 저장 복원 경로 — 완료 후 이어하기 유지; read-only.

#### Details

- **Signatures & Types**:

  ```typescript
  // GameShell 기존 callback 시그니처 유지
  const handleEvent = useCallback((type: GameEventType): void => { /* ... */ }, []);
  // 기존 타입 유지
  type UiMode = "safe" | "play" | "cutscene" | "dead" | "stage-clear";
  // World01StageClearSceneData 기존 계약 유지
  interface World01StageClearSceneData {
    readonly stageId: "world-01-stage-boss";
    readonly nextStageId: "world-02-stage-1";
  }
  ```

- **Data & Schema Fields**:
  - 저장 모델/이벤트 payload 변경 없음. `stage-completed`의 stageId/nextStageId/bankedCoins 유지.
  - `stage-clear-scene-opened`는 world-01-stage-boss→world-02-stage-1 전용 UI 전환 이벤트이며 기존 계약을 유지한다.
  - 새로운 scene/state/완료 저장 플래그를 추가하지 않는다.

- **Execution Flow / Logic**:
  1. Precondition & Validation:
     - 구현 기준 HEAD와 실행 중 앱의 소스가 일치하는지 먼저 확인한다. `rg -n -i 'stage.?clear|스테이지.?클리어' src` 결과와 실제 DOM/Phaser Text 생성 시점을 대조한다.
     - 현재 정상 경로: 일반 맵에서 runtime.complete()→stage-completed→180ms 뒤 다음 StageScene. 보스는 handleCalicoDefeat에서 승리 대화 종료 후 runtime.complete()→World01StageClearScene. 이 분기를 유지한다.
  2. Core Processing:
     - `GameShell.handleEvent`의 `messages`에서 `"stage-completed": "스테이지 클리어를 저장했습니다."` 항목을 제거한다. 완료 이벤트는 계속 받지만 완료 토스트를 만들지 않는다.
     - `stage-clear-scene-opened`만 `mode="stage-clear"`로 전환하는 기존 조건을 유지한다. 일반 stage-completed를 이 모드와 연결하지 않는다.
     - StageScene에 큰 문구 생성이 이미 없으므로 불필요한 삭제용 분기나 가짜 표시 상태를 새로 만들지 않는다. 실행 버전에 별도 배너가 발견되면 해당 일반 맵 표시 호출만 제거하고 원인 파일을 Task 결과에 기록한다. 저장/완료 호출에는 손대지 않는다.
     - World01StageClearScene의 `[STAGE CLEAR!]`/다음 월드 버튼은 유지한다. 승리 대화 전·도중에 이 씬을 열지 않는다. 기존250ms 입력 보호와 단일 전환 latch도 유지한다.
  3. Error & Exception Handling:
     - 문구가 남으면 먼저 이전 dev 실행/빌드 캐시 또는 다른 텍스트 경로를 확인한다. 사용자 진행 초기화를 문제 해결 수단으로 쓰지 않는다. 테스트는 별도 저장 컨텍스트로 한다.
     - 완료 저장 실패 처리 및 잘못된 클리어 씬 데이터의 기존 오류 표시는 변경하지 않는다. `stage-completed` 구독 해제나 EconomySystem/AutoSaveCoordinator 삭제로 문구를 숨기지 않는다.
  4. State Transition & Return:
     - 일반 맵은 완료 기록이 저장되고 코인 잔액을 유지한 채 다음 맵으로 자동 이동한다. 추가 클릭을 요구하지 않는다.
     - 보스는 T01/T02의 정지/기절 대사 후 클리어 화면을1회 표시하고, NEXT STAGE/Enter/Space 입력 시 월드2로 이동한다. 월드2에 진입한 뒤 클리어 문구가 남지 않는다.

### I02. 전환별 화면/저장 통합 검증

- Related Files:
  - `src/game/stages/StageRuntime.ts` :: complete — 저장과 전환 이벤트 유지 확인; read-only.
  - `src/game/systems/EconomySystem.ts` :: commitStageClear — clearedStages/코인 상태 유지 확인; read-only.
  - `src/game/persistence/AutoSaveCoordinator.ts` :: SAVE_EVENTS — 완료 저장 유지 확인; read-only.
  - `scripts/stage-progression.test.mjs`, `scripts/snack-wallet.test.mjs` — 기존 자동 검증; read-only.
  - `.memory/test-plans/2026-10-13-boss-only-clear-message.md` 및 `assets/boss-only-clear-message.json` — 화면/진행 기록; new.

#### Details

- 실제 Chromium 별도 컨텍스트에서 onboarding을 완료하고 월드1 일반1~4를 각각 끝100px 전부터 오른쪽 키로 통과한다. 로컬 `.git/refinement-tools/browser.cjs`의 setup/restart를 사용할 수 있다. 4단계 마지막 깃발부터 보스 진입도 포함한다.
- 각 전환 전후와180ms 전환 대기 동안, DOM 본문에 `STAGE CLEAR!`/`스테이지 클리어를 저장했습니다.`가 없고 활성 Phaser 씬의 Text 객체에도 완료 배너가 없는지 확인한다. DOM만 확인하면 canvas의 글자를 놓칠 수 있다.
- 일반 전환에서 stage-completed 이벤트가 맵당1회 발생하고, stage-clear-scene-opened는0회임을 기록한다. 저장 clearedStages에 완료 맵이 남고 bankedCoins가 감소하지 않으며, 새로고침 후 다음 단계 진행이 유지되는지 별도 컨텍스트에서 확인한다.
- 보스 마지막 실제 타격으로 T01/T02의 코기 정지·기절 frame2를 확인한다. 첫 대사~마지막 대사까지 STAGE CLEAR 문구0개, 대사 완료 후 전용 씬에서1개. 다음 월드 버튼/Enter/Space 각각 전환1회와 월드2에서 문구 제거 확인.
- 보스에 패배하면 마지막 깃발로 돌아가며 클리어 문구0개. 이미 클리어한 저장으로 이어하기할 때 기존 보스 전용 클리어 화면 복원은 허용한다. 맵 진행과 사망 카운트가 문구 제거로 바뀌지 않는다.
- 마지막에 T01/T02의 위치 고정·방향·기절 시점 결과와 연결하여 검증 문서에 적는다. UI 조건 한 줄을 그대로 반복하는 단위 테스트는 추가하지 않는다.

## Acceptance Criteria

- [x] 일반1→2→3→4→보스 진입과 패배 후 복귀에서 완료 배너/저장 토스트가 없다.
- [x] 일반 맵의 자동 전환·완료 기록·코인·재접속 진행은 유지된다.
- [x] 보스 승리 대화 후 다음 월드로 넘어가는 전용 화면에서만 STAGE CLEAR가1개 표시된다.
- [x] T01 코기 정지와 T02 삼색이 방향/첫 대사 기절 이미지가 함께 정상 동작한다.

## Validation

- `$testFiles = @(rg --files scripts -g '*.test.mjs'); node --experimental-strip-types --test @testFiles`
- `npx.cmd tsc --noEmit`
- `npm.cmd run lint`
- `npm.cmd run build`
- 일반 맵/보스/월드2 DOM·Phaser 텍스트 및 실제 저장/전환 검증, 브라우저 오류0건.
- `git -c core.autocrlf=false diff --check`

## Commit Message

```text
fix(ui): 클리어 문구를 보스 승리 후 월드 전환 화면에만 표시한다

Plan: 2026-10-13-world01-victory-dialogue-position
Phase: P01-victory-dialogue
Task: T03-boss-only-clear-message

- 일반 맵 전환의 클리어 저장 알림을 제거한다
- 진행 저장과 보스 전용 클리어 화면을 검증한다
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending

## Execution Result

- [최종 통합 기록](../../../test-plans/2026-10-13-boss-only-clear-message.md): 자동47건·타입·lint·빌드 통과. 일반4개 전환의 완료 문구0개·이벤트1회·코인 유지·새로고침 복원 확인. 보스 패배/복귀에서 문구0개, 승리 대화 종료 후 전용 화면에서만1개, 월드2 진입 후0개.
- `GameShell.handleEvent`의 알림 매핑1개만 제거했다. stage-completed 전달·저장·180ms 자동 전환 및 보스 전용 씬은 유지했다. 실제 DOM/Phaser Text를 함께 확인했다.
- T01/T02 통합 검증, 첫 도입8개 대사, 버튼/Enter/Space 전환 통과. pageerror0건. 요청 범위 밖 발견: 특이사항 없음.
