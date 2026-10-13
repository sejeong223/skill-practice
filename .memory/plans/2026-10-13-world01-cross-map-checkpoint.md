# Plan: 월드1 맵 간 체크포인트 유지

## Goal

2단계 깃발→3단계 사망 시2단계 깃발, 깃발 없이1→2단계 사망 시1단계 시작점,4단계 깃발→보스 패배 시4단계 깃발로 복귀한다. 재접속도 같은 저장 지점을 따른다.

- [결정](../decisions/2026-10-13-world01-cross-map-checkpoint.md)
- 사용자 구현 요청에 따라 청사진 작성 후 바로 순차 실행한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 월드 단위 복귀 정보·씬 간 사망/복원·재접속 검증 | [P01](../phases/2026-10-13-world01-cross-map-checkpoint/P01-checkpoint/phase.md) |

## Task Granularity

T01 하나로 묶는다. 저장 정보만 추가하거나 씬 이동만 수정하면 기존 맵별 시작점 fallback이 남으므로, 데이터·사망 라우팅·복원과 회귀 테스트를 함께 검증해야 한다.

## Progress

- done: 0/1
- 기존 무관한 메모리 수정6개는 보존한다. 이전 완료 계획은 다시 실행하지 않는다.
