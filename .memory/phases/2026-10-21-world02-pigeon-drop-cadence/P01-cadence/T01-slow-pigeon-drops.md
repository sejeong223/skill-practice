# Task: T01 한 비둘기의 배설 간격 완화

## Status: done

## Goal

월드 2 첫 스테이지에서 한 비둘기가 지나가며 똥 세 개를 떨어뜨리는 간격을 각각 약 0.3초 늘린다.

## Decision Summary

- 현재 `WORLD02_PIGEON_DROP_OFFSETS = [84,0,-84]`, `birdSpeedX = 160`이므로 간격은 0.525초다. 속도만 102px/s로 바꿔 약 0.824초로 만든다.
- 새 비둘기의 2초 등장 주기와 똥의 수직 낙하 속도 770px/s는 유지한다.

## Implementation

### I01. 세 비행 구간의 속도

- Related Files:
  - `src/game/data/world02PigeonDrops.ts` :: `WORLD02_STAGE1_PIGEON_PASSES` — 세 정의의 `birdSpeedX`를 모두 `102`로 변경; modify.
  - `src/game/systems/World02PigeonDropSystem.ts` :: `update`, `spawnFlight`, `releaseDropping` — 데이터의 `birdSpeedX`를 사용하고 새 등장 타이머가 별개인지 확인; read-only.
- **Signatures & Types**: `World02PigeonPassDefinition.birdSpeedX: number`; 타입과 필드 추가 없음. `WORLD02_PIGEON_SPAWN_INTERVAL_MS: number = 2000`, `WORLD02_PIGEON_DROP_OFFSETS: readonly number[] = [84,0,-84]` 유지.
- **Data & Schema Fields**: 세 요소의 `birdSpeedX = 102`, `droppingSpeedY = 770`. 저장 스키마 변경 없음.
- **Execution Flow / Logic**: 매 업데이트에서 새는 `birdSpeedX * elapsed / 1000`만큼 왼쪽으로 이동하고 x좌표 `dropX+84`, `dropX`, `dropX-84`를 넘을 때 하나씩 배설한다. `84 / 102 * 1000 ≈ 823.5ms`. 새 등장 타이머는 별도이므로 2000ms를 유지한다.
- **Error & Exception Handling**: 느린 비행 때문에 동시 개체가 늘어도 접촉 시 중복 사망이 없어야 한다. 일시정지·재시작·장면 종료에서는 남은 비행을 정리한다.

### I02. 시간 검증

- Related Files:
  - `scripts/world02-pigeon-drops.test.mjs` :: 연속 낙하 테스트 — 첫 새의 세 낙하 이벤트 시간을 기록해 이웃 간격이 약 824ms이고 x좌표와 2초 등장 주기가 유지되는지 확인; modify.
  - `.memory/test-plans/browser-world02-repeating-pigeons.mjs` :: 실제 게임의 첫 세 배설 시각을 기록하고 약 824ms 간격을 확인; modify.
  - `.memory/test-plans/2026-10-21-world02-pigeon-drop-cadence.md` :: 검증 결과 기록; new.
- **Execution Flow / Logic**: 첫 비둘기 세 낙하 이벤트를 같은 순서로 기록한다. 브라우저 프레임 오차를 감안해 목표 간격 ±100ms 이내를 허용한다. 기존 접촉 사망·일시정지·체크포인트 회귀도 확인한다.

## Acceptance Criteria

- [x] 한 비둘기의 세 배설 사이가 각각 약 0.824초다.
- [x] x좌표 `dropX+84`, `dropX`, `dropX-84`와 새 개체의 2초 등장 간격이 유지된다.
- [x] 똥의 수직 낙하와 접촉 사망·일시정지·체크포인트가 동작한다.

## Validation

- `node --test scripts/world02-pigeon-drops.test.mjs scripts/death-system.test.mjs`
- `node node_modules/typescript/bin/tsc --noEmit`
- `npm.cmd run lint`
- `npm.cmd run build`
- `node .memory/test-plans/browser-world02-repeating-pigeons.mjs` — 전용 Chrome/CDP가 준비된 경우.

## Commit Message

```text
fix(world02): 비둘기 배설 간격을 약 0.3초 늘리기

Plan: 2026-10-21-world02-pigeon-drop-cadence
Phase: P01-cadence
Task: T01-slow-pigeon-drops
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — 관련 테스트 10건, 타입·린트·빌드, 실제 게임 간격·일시정지·사망·체크포인트
- commit: T01 한국어 작업 커밋 (Git 로그 참조)
