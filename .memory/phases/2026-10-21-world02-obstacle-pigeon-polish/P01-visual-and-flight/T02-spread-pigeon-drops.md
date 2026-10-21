# Task: T02 비둘기 예고 제거와 이동 낙하

## Status: done

## Goal

비둘기 한 마리의 똥 세 개가 비행 방향으로 떨어진 별도 위치에 닿으며, 착지 전 바닥 위치 표시는 나타나지 않는다.

## Decision Summary

- 기존 2초 스폰 간격·세 비행 구간·낙하 중 즉사와 0.3초 착지 자국을 유지한다.

## Implementation

### I01. 낙하 간격과 예고 제거

- Related Files:
  - `src/game/data/world02PigeonDrops.ts` :: `WORLD02_PIGEON_DROP_OFFSETS` — `[84,0,-84]`로 변경; modify.
  - `src/game/systems/World02PigeonDropSystem.ts` :: `PigeonDropping`, `update`, `showWarning`, `clearDropping` — 예고 그래픽/상태 제거; modify.
- **Signatures & Types**: `DroppingStatus = "pending" | "falling" | "landed" | "finished"`. `PigeonDropping.warning` 필드를 없앤다. 외부 `update(deltaMs)`, `resetForAttempt(respawnX)`, `destroy()` API는 유지한다.
- **Execution Flow / Logic**: 비둘기는 `dropX+240`에서 왼쪽으로 비행하고 x=`dropX+84`, `dropX`, `dropX-84` 통과 때 각각 똥을 떨어뜨린다. `scene.add.graphics`로 바닥 예고 원을 만들지 않는다. 낙하 sprite와 충돌은 그대로다. 착지 후 splat은 300ms만 보여준다.
- **Error & Exception Handling**: 세 낙하 위치가 장애물 충돌체·코기 폭을 고려한 통과 여유를 갖는지 테스트한다. 한 낙하물 접촉 때 모든 동시 비행의 collider가 정리되어 중복 사망하지 않는다.

### I02. 회귀·브라우저 확인

- Related Files:
  - `scripts/world02-pigeon-drops.test.mjs` :: 낙하 x·간격·경고 0건·사망·정지 테스트; modify.
  - `.memory/test-plans/browser-world02-repeating-pigeons.mjs` :: 실제 게임 검증; modify.
  - `.memory/test-plans/2026-10-21-world02-obstacle-pigeon-polish.md` :: 결과 기록; new.
- **Data & Schema Fields**: 저장 스키마 변경 없음. 게임 장면에서 `flights[].drops[].warning`은 더 이상 존재하지 않는다.
- **Execution Flow / Logic**: 낙하 위치와 예고 그래픽 0건을 확인한다. 비둘기 2초 재등장, 일시정지, 접촉 사망과 체크포인트는 회귀 검증한다. 고양이·포카칩의 화면 크기도 육안 확인한다.
- **Error & Exception Handling**: 브라우저 예외·필수 에셋 404는 0건이어야 한다.

## Acceptance Criteria

- [x] 한 비둘기의 세 낙하 x가 84px씩 떨어진다.
- [x] 착지 전에 바닥 경고 원이 없다.
- [x] 2초 반복·접촉 사망·일시정지·착지 자국은 동작한다.

## Validation

- `node --test scripts/world02-pigeon-drops.test.mjs scripts/world02-obstacles.test.mjs scripts/world02-cat-attack.test.mjs scripts/death-system.test.mjs`.
- `node node_modules/typescript/bin/tsc --noEmit`.
- `npm.cmd run lint`.
- `npm.cmd run build`.
- `node .memory/test-plans/browser-world02-repeating-pigeons.mjs` — 전용 Chrome/CDP 준비 후.

## Commit Message

```text
feat(world02): 비둘기 똥 착지 예고를 없애고 낙하 위치 분리

Plan: 2026-10-21-world02-obstacle-pigeon-polish
Phase: P01-visual-and-flight
Task: T02-spread-pigeon-drops
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — 관련 테스트 30건, 타입·린트·빌드, Chrome 2초 반복·일시정지·사망·체크포인트
- commit: T02 한국어 작업 커밋 (Git 로그 참조)
