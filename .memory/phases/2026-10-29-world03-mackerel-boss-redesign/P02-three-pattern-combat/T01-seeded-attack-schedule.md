# Task: T01 시도별 세 공격 선택 모델

## Status: pending

## Goal

고등어 태비가 시도마다 세 종류를 처음 한 번씩 보여주고 이후 직전 공격을 반복하지 않도록 하는 순수 상태 모델을 만든다. 같은 스테이지/시도 번호면 테스트에서 같은 순서를 재현할 수 있어야 한다.

## Decision Summary

- 공격 종류는 `brick`·`cement-wave`·`cement-lump` 셋이다. 첫 3회는 셔플된 각 1회, 이후에는 직전 종류를 제외한 두 종류 중 선택한다. 후반 2연계의 두 번째도 첫 번째와 다른 종류다.
- 사망 재도전마다 `DeathSystem`이 `runtimeState.attempt`를 증가시키지만 `runtimeState.randomSeed`는 그대로일 수 있다. 따라서 `StageRandom.fromStage("world-03-stage-boss", attempt)`를 별도 사용한다.

## Implementation

### I01. 공격 덱과 시드

- Related Files:
  - `src/game/systems/mackerelAttackSchedule.ts` :: 순수 선택 모델 — new
  - `src/game/random/StageRandom.ts` :: `fromStage`, `pick`, `next` — read-only
  - `src/game/stages/StageRuntime.ts` :: `runtimeState.attempt` 증가 시점 — read-only
  - `src/game/systems/DeathSystem.ts` :: 사망 시 `attempt += 1` — read-only
  - `scripts/mackerel-attack-schedule.test.mjs` :: 결정적 시퀀스·재시도 경계 — new

#### Details

- **Signatures & Types**:
  ```typescript
  export type MackerelAttackKind = "brick" | "cement-wave" | "cement-lump";
  export class MackerelAttackSchedule {
    constructor(stageId: "world-03-stage-boss", attempt: number);
    reserve(): MackerelAttackKind;
    commit(): MackerelAttackKind;
    cancel(): void;
    reset(attempt: number): void;
    getLastAttack(): MackerelAttackKind | null;
  }
  ```
- **Data & Schema Fields**: `firstBag: MackerelAttackKind[]` 길이 3, `nextIndex: 0..3`, `lastAttack: MackerelAttackKind|null`, `reservedAttack: MackerelAttackKind|null`, `retryAttack: MackerelAttackKind|null`, 내부 `StageRandom`, `attempt: positive integer`. 저장 파일 스키마는 추가하지 않는다. 공격 순서는 현재 시도의 메모리 상태다.
- **Execution Flow / Logic**:
  1. Precondition: `attempt`는 1 이상 정수여야 한다. 유효하지 않으면 명시적 오류를 던져 우연히 같은 순서로 고정되지 않게 한다.
  2. Core: `StageRandom.fromStage(stageId, attempt)`를 사용해 Fisher–Yates로 세 종류를 처음 한 번씩 섞는다. `reserve()`의 첫 세 선택은 `firstBag[nextIndex]`, 이후에는 `lastAttack`을 제외한 둘을 시드 RNG로 선택한다. 실제 `commit()` 시에만 `nextIndex`(처음 세 발사)와 `lastAttack`을 갱신한다. 연계의 첫/둘째도 각각 reserve→commit하므로 서로 다르다.
  3. Error handling: `reset(attempt)`는 RNG·배열·인덱스·lastAttack·예약/재시도 후보를 전부 초기화한다. 짖기로 준비가 취소되면 `cancel()`한다. 처음 세 발사에서는 `nextIndex`가 그대로여서 같은 미발사 종류가 다시 예약된다. 이후에는 취소한 `reservedAttack`을 `retryAttack`에 보관해 다음 reserve가 같은 후보를 반환한다. **발사된 공격만** 시퀀스에 소비한다.
  4. State/return: 동일 `stageId+attempt`는 같은 종류 배열, 다른 `attempt`는 새 순서가 가능한 시드를 사용한다. 무작위 순서가 우연히 같을 수 있으므로 테스트는 서로 다른 시드 몇 개에서 변화가 존재함을 확인한다.

### I02. 취소 가능한 예약 계약

- Related Files:
  - `src/game/systems/mackerelAttackSchedule.ts` :: 예약/확정/취소 상태 — new
  - `scripts/mackerel-attack-schedule.test.mjs` :: 짖기 중 예약 취소 — new

#### Details

- **Signatures & Types**: I01의 `reserve/commit/cancel` 공개 메서드를 사용한다.
- **Data & Schema Fields**: 예약 중 다시 reserve하면 동일 종류를 반환한다. `commit`은 예약이 없으면 오류다. 이후 무작위 구간의 `retryAttack`은 성공적으로 발사됐을 때 비운다.
- **Execution Flow / Logic**: 준비 자세 시작 때 reserve, 실제 발사 때 commit, 짖기·사망·장면 종료로 발사가 취소되면 cancel한다. P02-T02에서 `BossPattern.telegraph/launch/clear`에 이 순서를 연결한다. 한 시도 재시작은 `reset(attempt)`를 호출한다.

## Acceptance Criteria

- [ ] 발사된 첫 세 공격이 순서만 섞인 세 종류이고, 그 뒤와 후반 연계에서 인접 중복이 없다.
- [ ] 준비 중 짖기로 취소된 종류가 첫 세 발사 보장에 영향을 주지 않는다.
- [ ] 시도 번호가 바뀌면 재시드하며 같은 번호로 리셋하면 테스트 결과가 같다.

## Validation

- `node --experimental-strip-types --test scripts/mackerel-attack-schedule.test.mjs` — 첫 3종·연계·취소·reset·시드 재현 통과.
- `npx.cmd tsc --noEmit` 및 `npm.cmd run lint` — 순수 모듈 타입·정적 검사 통과.

## Commit Message

```text
feat(월드3): 고등어 공격 순서를 시도별로 섞기

Plan: 2026-10-29-world03-mackerel-boss-redesign
Phase: P02-three-pattern-combat
Task: T01-seeded-attack-schedule

- 첫 세 종류 보장과 직전 중복 방지 모델 추가
- 짖기 취소와 사망 재도전 시드 검증
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
