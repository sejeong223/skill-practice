# Task: T04 맵 끝 전환 구간 낙하 방지

## Status: done

## Goal

코기가 일반 맵 오른쪽 끝에서 지면을 따라 걸어나가고, 떨어지는 모습 없이 다음 맵으로 이동한다.

## Decision Summary

물리 경계는 맵 너비보다 256px 길지만 지면은 맵 끝에서 종료되어, 작은 몸체가 바닥을 벗어난 뒤 전체 스프라이트가 사라지기 전 낙하한다. 마지막 지면과 같은 높이로 보이지 않는 정적 바닥을 연장한다. 맵 이미지·카메라 범위·중력·완전 이탈 완료 조건은 유지한다.

## Implementation

- Target: `src/game/scenes/StageScene.ts` :: `create`, 새 `createExitFloor`, shutdown 정리.
- Types: `NORMAL_EXIT_RUNOUT: number = 256`, `exitFloor?: Phaser.GameObjects.Rectangle`. 새 메서드는 `(stage: StageDefinition, gameplayLayer?: Phaser.Tilemaps.TilemapLayer): void`.
- 마지막 열의 충돌 타일에서 실제 지면 높이를 얻는다. 타일맵 없는 일반 스테이지는 오른쪽 마지막 플랫폼이 맵 끝까지 닿을 때만 그 상단 높이를 사용한다. 연결할 지면이 없으면 만들지 않는다. 화면 안의 빈 공간을 숨겨진 바닥으로 메우지 않는다.
- 바닥은 마지막 경계에서 1px 겹쳐 물리 경계까지 연장하며, invisible 정적 Arcade body와 player collider로 구성한다. 보스는 제외한다. 씬 종료 시 destroy 후 참조를 비운다.
- 저장 모델 변경 없음. play/paused/completed 처리 및 기존 180ms 전환 유지. 전환 대기 중에도 낙하가 없어야 한다.

## Acceptance Criteria

- [x] 일반 맵 1~4에서 이동 마지막 프레임까지 발 높이를 유지하고 완료 이벤트 1회 후 다음 맵으로 전환한다.
- [x] 끝 부근 일시정지/재개 및 화면 밖에서 되돌아오기가 정상이다.
- [x] 보스와 카메라 범위는 유지하고 숨겨진 바닥은 씬 전환 시 정리한다.

## Validation

- 브라우저 실제 ArrowRight 이동 중 프레임별 y/velocityY/완료 횟수를 기록한다. 수정 전 재현과 수정 후 결과를 비교한다.
- `node --experimental-strip-types --test scripts/stage-progression.test.mjs scripts/checkpoint-feedback.test.mjs`
- `npm.cmd run world01:maps:check`
- `npx.cmd tsc --noEmit`
- `npm.cmd run lint`
- `npm.cmd run build`
- 검증 결과: `.memory/test-plans/2026-10-12-world01-exit-floor.md` 및 연결된 JSON.

## Commit Message

```text
fix(stage): 맵 끝 전환 구간에서 코기가 떨어지지 않도록 바닥을 잇는다

Plan: 2026-10-12-world01-camera-exit-sfx
Phase: P01-player-feedback
Task: T04-exit-floor
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: f8c0866

## Execution Result

기존 낙하 최대40.33px 재현 후 월드1 일반1~4 모두 낙하0px·하강 속도0·완료1회·다음 맵 전환 확인. 일시정지/재개·되돌아오기·씬 바닥 정리·보스 제외 확인. 관련 자동6건·맵·타입·lint·빌드 통과. [상세 결과](../../../test-plans/2026-10-12-world01-exit-floor.md).
