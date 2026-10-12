# Task: T02 출구와 깃발 부활 정리

## Status: pending

## Goal

반투명 사각형이 사라지고 맵 끝으로 걸어나가면 다음 맵으로 이동하며, 죽으면 실제 밟은 깃발에서 다시 시작한다.

## Decision Summary

- 출구는 부활 지점이 아니다. 일반 맵 오른쪽 경계 통과만 완료를 발생시키고 보스의 전투 완료는 유지한다.
- 활성화 위치는 깃발 바닥에 고정한다. 기존 체크포인트 ID/맵별 배치는 유지하고 표시/판정을 통일한다.

## Implementation

### I01. 출구와 체크포인트 시각

- Related Files: `src/game/stages/StageEntityFactory.ts` :: `createCheckpoint`, `createExit`; modify. `src/game/scenes/StageScene.ts` :: create/update/activateCheckpoint/resumeCheckpointId; modify.
- **Signatures & Types**: createCheckpoint의 기존 id/x/y 인자를 유지하고 `height = 120` 추가 가능; StageRuntime이 실제 map object.height 전달. `createExit` 반환 Rectangle은 invisible. 체크포인트 flag image와 body의 바닥을 일치시킨다.
- **Data & Schema Fields**: 저장 스키마 변경 없음. snapshot x/y는 checkpoint object의 centerX 및 bottom, facing=1. 보스 자동 복원도 동일 좌표 계산 사용.
- **Execution Flow / Logic**: 모든 진짜 checkpoint는 atlas 깃발/숨겨진 판정. 일반 맵 physics 오른쪽 bounds를 mapWidth+256으로 확장해 걸어나갈 여유 확보; camera bounds는 원래 mapWidth. 기존 exit overlap 완료 제거. update에서 play 상태이고 player sprite 왼쪽 >= mapWidth이고 바닥 밖으로 사망하지 않았다면 complete 한 번. 정상 진행 후 짧게 전환, 출구 앞에서 강제 완료하지 않는다.
- **Error & Exception Handling**: checkpoint definition 미발견 시 entity 좌표/높이 사용, 가짜 체크포인트 활성화 금지 유지. dying/paused/cutscene/completed는 경계 완료 금지. 보스는 경계 완료 금지.
- **State Transition & Return**: 첫 깃발 통과→고정 snapshot→반복 죽음에도 동일 깃발 부활. 재접촉 차임0. 미활성화 시 기존 시작점. 보스 실패는 4단계 마지막 깃발.

### I02. 회귀 확인

- Related Files: `scripts/checkpoint-feedback.test.mjs`, 추가 경계 테스트 필요 시 new; 기존 지도 JSON/read-only.
- 브라우저 실제 이동으로 2단계 깃발 활성화 후 장애물 사망 및 4단계 복귀 좌표를 측정한다. 깃발 이전 사망은 시작점. 1~4단계의 옛 exit 위치에서는 미완료, 오른쪽 완전히 이탈하면 다음 stage가 한 번 시작됨을 확인한다. 다른 월드 checkpoint에서도 빨간 표시가 없는지 확인한다.

## Acceptance Criteria

- [ ] 출구/체크포인트 반투명 사각형이 없다.
- [ ] 일반 맵 끝 이탈 자동 전환, 보스 경계 통과는 미완료다.
- [ ] 부활은 실제 활성화한 깃발 좌표이며 이전/반복 사망 동작이 맞다.

## Validation

- `node --experimental-strip-types --test scripts/checkpoint-feedback.test.mjs scripts/stage-progression.test.mjs scripts/snack-wallet.test.mjs`
- `npm.cmd run world01:maps:check`
- `npx.cmd tsc --noEmit`
- 브라우저 끝 통과/깃발 부활/미활성화 부활 확인.

## Commit Message

```text
fix(stage): 출구 표시를 없애고 깃발 위치에서 부활하도록 정리한다

Plan: 2026-10-12-world01-camera-exit-sfx
Phase: P01-player-feedback
Task: T02-exit-checkpoint
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
