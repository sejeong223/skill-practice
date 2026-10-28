# Phase: P01 안전 콘·포대의 높이별 충돌

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | 두 사물의 4단 충돌 영역 적용과 자산·동작 회귀 검증 | [T01](./T01-cone-cement-collision-bands.md) |

## Progress

- done: 1/1 (active: 없음)

## Task Boundary

프로필 데이터만 먼저 넣으면 사용되지 않는 상수가 되고, 런타임만 바꾸면 기존 테스트가 `이미지 순서 = 충돌 영역 순서`라고 가정해 실패한다. 데이터·영역 생성·테스트를 하나의 검증 가능한 Task로 묶는다.
