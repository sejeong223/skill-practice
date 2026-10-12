# Task: T05 체크포인트 사망 반복 방지

## Status: done

## Goal

4단계 마지막 가짜 간식으로 사망하더라도 저장한 깃발에서 정상 부활하고 보스전으로 이동한다. 만료된 효과 때문에 카운트가 매 프레임 증가하지 않는다.

## Decision Summary

실제 분석에서 불꽃 간식 발동 후 1.33초에 깃발 저장, 1.7초에 사망, 이후 만료된 `triggered` 복원으로 316.7ms 동안 사망20회를 재현했다. 체크포인트에 지형 변화/진행 상태는 저장하지만 플레이어의 일시 사망 효과는 이어받지 않는다. 기존 누적 수치와 코인은 자동 초기화하지 않는다.

## Implementation

### I01. 체크포인트 상태 정리

- Target: 새 `src/game/systems/checkpointGimmickState.ts` :: `toCheckpointGimmickState(kind, state): GimmickRuntimeState`; `MapGimmickSystem.ts` :: `getSnapshotStates`, `reset`.
- Types: kind는 `WorldGimmickDefinition["kind"]`, state는 기존 `GimmickRuntimeState`. 저장 스키마와 필드 이름은 바꾸지 않는다.
- 가짜 간식 green/reverse/fire가 triggered이면 복사본을 `status: "escaped", startedAt: null`로 변환한다. 현재 시도의 상태는 변경하지 않아 원래 첫 사망을 유지한다. 새 저장과 이전 스냅샷 복원 모두 같은 정리 함수를 사용한다.
- armed/dead/escaped 등 다른 상태와 무너진 바닥 등 지속되는 지형 상태는 그대로 보존한다. 기존 pending action/강제 이동 초기화와 chain 발동 기록은 유지한다.

### I02. 사망 중복 처리 방어

- Target: `DeathSystem.ts` :: constructor, handleDeath, destroy; `StageScene.ts` :: DeathSystem 생성.
- `canHandleDeath?: () => boolean` 생성자 인자 추가(기본 true). StageScene은 runtime 상태가 play일 때만 허용한다. 다른 stageId 및 destroy 이후 요청은 무시한다.
- 사망·복원 중 재진입 차단은 유지하고, 완료 후 잠금 해제는 `queueMicrotask`로 현재 실행 구간 끝까지 미룬다. 동일 프레임의 순차 충돌 요청도 1회만 집계한다. 임의 무적 시간이나 코인 제한은 추가하지 않는다.
- 정상 사망1회는 통계+1, attempt+1, 체크포인트 복원1회, 알림1회. 다음 실행 구간에 발생한 정상 사망은 정상 집계한다. 보스 패배 후 dying 상태 추가 요청은 무시한다.

### I03. 회귀 검증

- Target: 새 `scripts/checkpoint-death-loop.test.mjs`, 필요 시 새 `scripts/death-system.test.mjs`; `.memory/test-plans/2026-10-12-checkpoint-death-loop.md` 및 결과 JSON.
- 자동 검증: 가짜 간식3종 저장/복원과 불변성, 기존 만료 스냅샷 정리, 정상 지형/armed 상태 유지. 사망 중복/재진입·다른 맵·비플레이·destroy 이후 무시, 다음 시도 정상 사망, 기존 코인/누적값 유지.
- 브라우저: 기존 재현 경로 그대로 4단계 마지막 간식→깃발→첫 사망1회→부활→보스. 구형 오염 스냅샷 복원 뒤 기다려도 반복0회. 보스 실패 후 깃발 복귀 및 재도전, 기존 맵 끝 높이 유지.

## Acceptance Criteria

- [x] 현재 가짜 간식의 정상 사망은 1회, 부활 후 반복 사망은 0회다.
- [x] 기존 만료 효과가 담긴 스냅샷도 안전하게 복원된다.
- [x] 사망 중복 요청/비플레이 요청은 무시하고 정상 재시도는 집계한다.
- [x] 코인·진행도·기존 사망 기록과 맵 끝 전환은 유지한다.

## Validation

- `node --experimental-strip-types --test` + `rg --files scripts -g '*.test.mjs'`로 찾은 전체 테스트.
- `npm.cmd run world01:maps:check`
- `npx.cmd tsc --noEmit`
- `npm.cmd run lint`
- `npm.cmd run build`
- 브라우저 시나리오 및 `git diff --check`.

## Commit Message

```text
fix(checkpoint): 가짜 간식 효과 복원으로 사망이 반복되는 문제를 막는다

Plan: 2026-10-12-world01-camera-exit-sfx
Phase: P01-player-feedback
Task: T05-checkpoint-death-loop
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 735fdb0

## Execution Result

자동47건(추가9건)·타입·lint·빌드·맵 검사 통과. 브라우저에서 마지막 가짜 간식→깃발→사망1회→부활→보스 확인. 구형 만료 상태를 복원해도 추가 사망0회, 보스 패배 중 중복 요청 무시·4단계 깃발 복귀·보스 재진입 확인. 기존7회에서 실제 사망3건만 추가되어10회, 코인57 유지. [검증 기록](../../../test-plans/2026-10-12-checkpoint-death-loop.md).
