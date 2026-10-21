# Task: T01 비둘기 1.5초 등장 간격

## Status: done

## Goal

월드 2 첫 스테이지에서 비둘기 한 마리를 먼저 만들고, 다음 마리부터 1.5초마다 하나씩 생성한다.

## Decision Summary

- 첫 마리 즉시 등장과 기존 세 배설 간격 약 824ms는 유지한다. 새 마리 등장 주기만 2000ms에서 1500ms로 줄인다.
- 각 비둘기의 비행은 1.5초보다 길어 동시 표시될 수 있으나 같은 시각에 두 마리를 생성하지 않는다.

## Implementation

### I01. 생성 타이머

- Related Files:
  - `src/game/data/world02PigeonDrops.ts` :: `WORLD02_PIGEON_SPAWN_INTERVAL_MS` — 값 `1500`; modify.
  - `src/game/systems/World02PigeonDropSystem.ts` :: `update`, `spawnFlight`, `getActiveDefinition` — 최초 한 마리와 이후 타이머가 한 번에 한 마리씩 생성하는지 확인; read-only unless a same-tick duplicate is found.
- **Signatures & Types**: 상수 `WORLD02_PIGEON_SPAWN_INTERVAL_MS: number`; `update(deltaMs:number):void`와 `PigeonFlight[]` 유지. 저장 스키마 변경 없음.
- **Execution Flow / Logic**: 플레이어가 해당 구간에 들어가면 `spawnStarted === false` 분기에서 한 마리를 생성한다. 이후 누적 프레임 시간이 1500ms에 도달할 때마다 다음 한 마리를 생성하고 1500ms를 뺀다. `[84,0,-84]` 낙하 지점과 속도102px/s는 유지한다.
- **Error & Exception Handling**: 구간 전환·일시정지·체크포인트 복귀·접촉 사망에서 기존 비행 정리와 1회 사망이 유지되어야 한다. 느린 새가 겹쳐도 새 생성 이벤트의 시각이 같지 않아야 한다.

### I02. 검증

- Related Files:
  - `scripts/world02-pigeon-drops.test.mjs` :: 생성 시각 50/1550/3050ms와 중첩 비행 테스트; modify.
  - `.memory/test-plans/browser-world02-repeating-pigeons.mjs` :: 실제 게임의 1.5초 간격과 첫 새의 세 배설을 개체별로 분리해 확인; modify.
  - `.memory/test-plans/2026-10-21-world02-pigeon-arrival-cat-jump.md` :: 결과 기록; new in T02 or T01.
- **Execution Flow / Logic**: 브라우저에서 첫 세 배설의 전역 발생 순서와 첫 비둘기의 세 배설 순서는 달라질 수 있으므로 비둘기 개체별 식별자를 기록한다. 새 등장 간격은 프레임 오차 ±100ms 이내다.

## Acceptance Criteria

- [x] 첫 마리 뒤 1.5초 간격으로 새 마리가 하나씩 생성된다.
- [x] 기존 세 배설 좌표·간격, 일시정지·접촉 사망·체크포인트가 동작한다.

## Validation

- `node --test scripts/world02-pigeon-drops.test.mjs scripts/death-system.test.mjs`
- `node node_modules/typescript/bin/tsc --noEmit`
- `npm.cmd run lint`
- `npm.cmd run build`
- `node .memory/test-plans/browser-world02-repeating-pigeons.mjs` — 전용 Chrome/CDP 준비 후, 캡처 선택 해제.

## Commit Message

```text
fix(world02): 비둘기를 한 마리씩 1.5초 간격으로 등장시키기

Plan: 2026-10-21-world02-pigeon-arrival-cat-jump
Phase: P01-stage1-tuning
Task: T01-pigeon-arrival
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
