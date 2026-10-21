# Task: T01 비둘기 반복 비행과 연속 낙하

## Status: done

## Goal

월드 2 첫 스테이지에서 플레이 중 2초마다 새가 재등장하고 각 새가 비행 중 세 번 배설한다. 경고·충돌·일시정지·재시작이 여러 낙하물에도 정확히 동작한다.

## Decision Summary

- [결정 문서](../../../decisions/2026-10-21-world02-repeating-pigeons.md)의 세 구간, 2,000ms 스폰 간격, 비행당 세 낙하를 따른다.
- 이전의 단일 패스 `armed → flying → released → finished` 대신 동시 비행 배열과 비행별 낙하 슬롯을 사용한다.

## Implementation

### I01. 비행·낙하 패턴과 타이머

- Related Files:
  - `src/game/data/world02PigeonDrops.ts` :: `WORLD02_STAGE1_PIGEON_PASSES`, 새 간격·낙하 오프셋 상수 — modify.
  - `src/game/systems/World02PigeonDropSystem.ts` :: `World02PigeonDropSystem.update`, `resetForAttempt`, `destroy` — modify.

#### Details

- **Signatures & Types**: 기존 `World02PigeonPassDefinition { id: string; triggerX: number; dropX: number; flightY: number; birdSpeedX: number; droppingSpeedY: number }`와 `update(deltaMs: number): void`, `resetForAttempt(respawnX: number): void`, `destroy(): void` 공개 API를 유지한다. `WORLD02_PIGEON_SPAWN_INTERVAL_MS: number = 2000`, `WORLD02_PIGEON_DROP_OFFSETS: readonly number[] = [44, 0, -44]`를 정의한다. 내부 `PigeonFlight { definition; bird; flightElapsedMs; drops: PigeonDropping[] }`, `PigeonDropping { x; status: 'pending'|'warned'|'falling'|'landed'|'finished'; warning?; sprite?; overlap?; splatRemainingMs }`를 둔다. 필드는 저장하지 않는다.
- **Execution Flow / Logic**: 코기가 첫 `triggerX`를 넘으면 즉시 한 마리를 생성하고 그 뒤에는 플레이 중 누적 시간 2,000ms마다 새 비행을 만든다. 스폰 시점에 코기가 있는 세 구간 중 하나의 정의를 선택한다. 새는 `dropX+240`에서 왼쪽으로 움직이고, 각 오프셋의 지점보다 80px 앞에서 개별 그림자를 만든 뒤 x를 지나면 똥을 낙하시킨다. 새는 `dropX-320`에서 제거한다. 3개 낙하물은 동시에 존재할 수 있으며 각각 별도의 Arcade overlap과 착지 자국 수명을 갖는다.
- **Error & Exception Handling**: `deltaMs`는 기존처럼 0~50ms로 제한하고 유효하지 않은 값은 0으로 처리한다. 물리 overlap 중 동기 재시작이 일어나도 한 번만 죽도록 모든 비행의 충돌체를 먼저 정리한다. 비행/낙하 배열은 순회 중 안전하게 제거한다.
- **State Transition & Return**: 일시정지·상점·완료 상태에서는 새 타이머와 낙하가 진행되지 않는다. 체크포인트 재시작은 누적 타이머와 모든 GameObject를 지우고 복귀 위치 이전 구간에서 새를 만들지 않는다.

### I02. 검증 및 실제 게임 확인

- Related Files:
  - `scripts/world02-pigeon-drops.test.mjs` :: 시스템 모의 테스트 — modify.
  - `.memory/test-plans/browser-world02-pigeon-drops.mjs` :: 실제 브라우저 재현 스크립트 — modify 또는 새 스크립트로 교체.
  - `src/game/scenes/StageScene.ts` :: 현재 시스템 생성·update·reset·shutdown 호출 — read-only; 공개 API 변경 시에만 modify.

#### Details

- **Data & Schema Fields**: `stageId`, `checkpointId`, death-requested payload는 기존 타입 그대로 둔다.
- **Execution Flow / Logic**: 첫 새의 세 낙하 위치와 간격, 2초 후 두 번째 새가 나타나는 것, 같은 구간에 머물러도 세 번째 새가 나타나는 것, 개별 경고·착지·접촉, 일시정지와 재시작 리소스 정리를 확인한다. 실제 브라우저에서 비행·반복·낙하와 예외·에셋 오류를 본다.
- **Error & Exception Handling**: 기존 세 구간과 체크포인트·출구의 수동 이동 동선을 깨뜨리지 않는다. 이전의 단발 동작만 가정한 테스트는 새 동작을 검증하도록 갱신한다.
- **State Transition & Return**: 통과 결과를 `.memory/test-plans/2026-10-21-world02-repeating-pigeons.md`에 기록한다.

## Acceptance Criteria

- [x] 한 마리의 똥 3개가 비행 방향대로 연속 낙하한다.
- [x] 스폰 시작 시각이 2초 간격이며, 플레이 중 같은 구간에서도 새가 계속 나온다.
- [x] 똥 접촉 즉사, 착지 자국 무해, 일시정지·재시작·종료 정리가 유지된다.
- [x] 월드 2 첫 스테이지 외와 저장 데이터는 변하지 않는다.

## Validation

- `node --test scripts/world02-pigeon-drops.test.mjs scripts/world02-obstacles.test.mjs scripts/world02-cat-attack.test.mjs scripts/death-system.test.mjs` — 반복·낙하·사망·회귀.
- `node node_modules/typescript/bin/tsc --noEmit` — 타입 검사.
- `npm.cmd run lint` — 정적 검사.
- `npm.cmd run build` — 빌드.
- `node .memory/test-plans/browser-world02-pigeon-drops.mjs` — 실제 개발 서버와 Chrome CDP에서 반복 비행·다중 낙하 확인.

## Commit Message

```text
feat(world02): 비둘기 2초 반복 등장과 연속 배설

Plan: 2026-10-21-world02-repeating-pigeons
Phase: P01-recurring-flights
Task: T01-repeat-flights-and-droppings

- 세 구간에서 비둘기를 2초 간격으로 계속 생성
- 각 비둘기의 똥 세 번 낙하와 재시작 정리 검증
```

## Progress

- [x] 구현 완료 — 세 구간 재생성과 비행당 세 낙하, 일시정지·재시작·종료 정리를 적용했다.
- [x] 검증 통과 — 관련 테스트 18건, 타입·린트·빌드, 실제 Chrome의 2016.6ms 간격·사망 복귀.
- commit: 이 Task의 한국어 커밋
