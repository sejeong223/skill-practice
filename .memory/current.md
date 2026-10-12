# Current Context

## Active Plan

[월드 1 이동 흐름·간식·삼색이 전투 개선](./plans/2026-10-12-world01-gameplay-refinement.md)

## Active Phase

[P01 월드 1 플레이 흐름과 전투 피드백](./phases/2026-10-12-world01-gameplay-refinement/P01-gameplay-refinement/phase.md)

## Active Task

[T01 짧은 맵과 자연스러운 카메라·보행](./phases/2026-10-12-world01-gameplay-refinement/P01-gameplay-refinement/T01-compact-motion.md)

## Status

- 2026-10-12 사용자의 7개 수정사항과 후속 간식 코인 잔액·상점 대비 영구 적립을 계획에 반영했다. P01의 T01~T05 모두 pending, 구현은 시작하지 않았다.
- 현재 소스/Tiled 일반 맵은3840px. T01에서2560px 정합화와 카메라·보행 개선, T02에서최종32개 기믹/20개 진짜 간식을 적용한다.
- 맵 이미지 자르기는 카메라·보행·배경 표시 개선을 먼저 검증한 뒤에도 원본 이미지 문제가 남을 때만 사용하는 최후 수단이다.
- T02에 진짜 간식 획득 즉시 `bankedCoins` 적립·저장과 오른쪽 상단 보유 잔액 표시를 포함한다. 사망/새로고침에 잔액을 잃지 않으며, 기존 클리어 시 중복 합산 규칙은 대체한다. T05에서 저장과 모바일 표시를 검증한다.

## Previous Work Pointer

- 직전 계획: [컷신 대사 자동 진행](./plans/2026-10-06-cutscene-auto-advance.md), 전 Task 완료(`b55e26c`, `1b2f230`, `aa48a8c`). 완료 이력을 유지한다.
- 이전 [짧은 경로 T01](./phases/2026-10-01-world01-compact-scenes/P01-world01-map-and-hud/T01-compact-normal-maps.md)은 이번 T01/T02로 대체한다. 그 계획의 T02 보스아레나/배경, T03 깃발/출구, T04 픽셀하트는 별도 미완료로 보존한다.
- 새 계획 완료 후 기존 작업을 재개할 때 [이전 Phase](./phases/2026-10-01-world01-compact-scenes/P01-world01-map-and-hud/phase.md)의 T02부터 검토한다. 기믹32개·HP10·새 간식 외형을 옛 규칙으로 되돌리지 않는다.

## Next Step (IMPORTANT)

`/memory-execute` 또는 `current 보고 이어서 해줘` 요청 시 T01 청사진부터 순서대로 구현한다. `src/game/data/world01Maps.ts`의 맵 폭과 `src/game/camera/CameraDirector.ts`의 추적 재시작을 우선 다룬다. 검증을 통과한 Task만 done/커밋/phase 진행률/다음 포인터로 갱신한다.
