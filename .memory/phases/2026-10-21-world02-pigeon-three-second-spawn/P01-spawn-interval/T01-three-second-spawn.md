# Task: T01 비둘기 3초 등장 간격

## Status: done

## Goal

월드 2 첫 스테이지에서 첫 비둘기 이후 정확히 3000ms마다 한 마리씩 생성한다.

## Decision Summary

- 사용자가 요청한 변경은 비둘기 등장 간격 `1500 → 3000ms`이다. 비둘기 한 마리의 비행과 배설 속도·좌표는 변경하지 않는다.
- 구간 진입 즉시 첫 생성은 유지한다. 비행 시간이 3초보다 길기 때문에 화면에서 이전 새와 새 새가 겹칠 수 있다.

## Implementation

### I01. 등장 간격

- Related Files:
  - `src/game/data/world02PigeonDrops.ts` :: `WORLD02_PIGEON_SPAWN_INTERVAL_MS` — 3000으로 변경; modify.
  - `src/game/systems/World02PigeonDropSystem.ts` :: `update(deltaMs: number): void` — 즉시 첫 생성과 상수 기반 반복을 확인; read-only.
- **Signatures & Types**: `WORLD02_PIGEON_SPAWN_INTERVAL_MS: number`; `update(deltaMs: number): void`; 자료형과 스키마 변경 없음.
- **Data & Schema Fields**: 저장 데이터나 월드 정의의 필드 변경 없음. `WORLD02_PIGEON_DROP_OFFSETS: readonly number[] = [84, 0, -84]` 유지.
- **Execution Flow / Logic**: 구간 최초 진입 프레임에 한 마리 생성한다. 이후 누적 플레이 시간이 3000ms에 이를 때마다 새 한 마리 생성하고 누적값에서 3000ms를 뺀다.
- **Error & Exception Handling**: 일시정지·상점·사망 상태에서는 타이머가 증가하지 않는다. 재시작에서는 기존 `resetForAttempt`로 타이머가 0이 된다.

### I02. 회귀 검증

- Related Files:
  - `scripts/world02-pigeon-drops.test.mjs` :: 등장 주기·사망·착지·체크포인트·정지 테스트 — 50/3050/6050ms 생성 시각 및 변경된 새 개수를 반영; modify.
  - `.memory/test-plans/browser-world02-repeating-pigeons.mjs` :: 실제 게임 두 번째 생성 간격 — 3000ms ±100ms로 변경; modify.
  - `.memory/test-plans/2026-10-21-world02-pigeon-three-second-spawn.md` :: 검증 결과; new.
- **Signatures & Types**: 테스트 도구 `h.tick(count = 1, delta = 50)`를 유지한다.
- **Data & Schema Fields**: 테스트에서 새 객체의 `createdAt: number`를 검사한다.
- **Execution Flow / Logic**: 50ms 첫 생성, 3000ms 동안 새 추가 없음, 3050ms 두 번째 생성, 6050ms 세 번째 생성을 검사한다. 첫 비둘기 세 배설은 기존 간격과 좌표 그대로 확인한다. Chrome에서는 일시정지·고양이 점프·체크포인트 사망까지 기존 검증을 재실행한다.
- **Error & Exception Handling**: 1.5초 주기를 전제한 새 개수 기대값을 모두 변경해 거짓 실패를 방지한다.

## Acceptance Criteria

- [x] 첫 비둘기 뒤 3초마다 새 한 마리만 생성된다.
- [x] 세 배설·접촉 사망·체크포인트·일시정지와 고양이 점프 검증을 유지한다.

## Validation

- `node --test scripts/world02-pigeon-drops.test.mjs scripts/death-system.test.mjs scripts/world02-obstacles.test.mjs scripts/world02-cat-attack.test.mjs`
- `npm.cmd run lint`
- `npm.cmd run build`
- `node node_modules/typescript/bin/tsc --noEmit`
- `node .memory/test-plans/browser-world02-repeating-pigeons.mjs` — 전용 Chrome/CDP 준비 후 `WORLD02_CAPTURE_SCREENSHOTS=0`으로 실행.

## Commit Message

```text
fix(world02): 비둘기 등장 주기를 3초로 조정하기

Plan: 2026-10-21-world02-pigeon-three-second-spawn
Phase: P01-spawn-interval
Task: T01-three-second-spawn
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
