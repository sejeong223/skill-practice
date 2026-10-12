# Phase: P01 월드 1 맵과 HUD 정리

## Goal

월드 1 일반 경로의 길이와 보스전의 화면 구성을 고치고, 월드 1 체크포인트·출구와 보스 HUD의 시각 표현을 정돈한다.

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `superseded` | 2026-10-12 새 계획 T01/T02로 대체, 완료 처리 아님 | [T01](./T01-compact-normal-maps.md) |
| T02 | `pending` | 1280×720 보스 맵, 연속 타일 지형, 단일 배경 | [T02](./T02-boss-arena-and-background.md) |
| T03 | `superseded` | 깃발/출구는 최신 피드백 및 camera-exit-sfx 계획으로 대체 완료 | [T03](./T03-day-flag-and-invisible-exit.md) |
| T04 | `pending` | 외곽 상자 없는 작은 픽셀 하트와 통합 확인 | [T04](./T04-pixel-hearts-and-review.md) |

## Progress

- done: 0/4; superseded: 2; pending: 2
- active: 없음 — [이동·간식·전투 개선](../../../plans/2026-10-12-world01-gameplay-refinement.md)과 [화면·음악·체크포인트 계획](../../../plans/2026-10-12-world01-pause-music-checkpoints.md)은 모두 완료됐다. 이 compact 계획은 자동 재개하지 않는다.
- 이 계획 재개 지점: T02. 이후 검증에서 옛 기믹24개/HP12 기준을 복원하지 않는다.

## Why These Tasks

일반 맵의 길이·좌표·생성 JSON은 동시에 바뀌어야 각 스테이지가 로드된다. 보스 맵은 별도 데이터·카메라 단위이며, 깃발/출구는 물리 판정을 보존해야 한다. 마지막 HUD 작업에서 두 화면 크기와 진행 회귀를 함께 확인한다.
