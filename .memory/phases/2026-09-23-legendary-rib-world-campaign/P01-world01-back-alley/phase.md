# Phase: P01 World 1 무법지대 뒷골목

> 2026-09-29: 남은 검증·보스 Task는 [월드 1 낮 경로와 삼색이 보스 계획](../../../plans/2026-09-29-world01-daylight-calico.md)의 T01~T07로 교체되었다. 완료된 T01~T04는 구현 이력으로 보존한다. 아래 Completion Gate는 과거 기준이다.

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done` | 기믹 타입·사망 효과·통제불능 상태 계약과 World 1 카탈로그 | [T01](./T01-gimmick-contract-and-catalog.md) |
| T02 | `done` | 화창한 낮의 뒷골목 픽셀 타일셋·배경·함정 사물 에셋과 로딩, 인트로 타이틀/이름 입력 | [T02](./T02-world01-pixel-assets.md) |
| T03 | `done` | 4개 일반 Tiled 맵과 66개 기믹 배치·연쇄 규칙 (사용자 디자인 승인 완료) | [T03](./T03-world01-maps-and-chains.md) |
| T04 | `done` | 조작 조건·통제불능·즉사 연출·가짜 체크포인트 런타임 | [T04](./T04-world01-gimmick-runtime.md) |
| T05 | `superseded` | 옛 돌발 함정 플레이테스트; 새 계획 T02·T03·T07로 대체 | [T05](./T05-world01-validation-and-playtest.md) |
| T06 | `superseded` | 옛 보스 구현 계획; 새 계획 T04~T07로 대체 | [T06](./T06-world01-boss-and-completion.md) |

## Progress

- done: 4/6 (T05·T06은 새 계획으로 대체; 이 Phase의 active Task 없음)

## Completion Gate

T03 구현 전에 World 1 맵 디자인을 사용자에게 제시했고 승인을 받았다. T06까지 통과하기 전에는 P02를 시작하지 않는다. T05에서 4개 일반 맵의 실행 화면을 사용자와 함께 점검하고, 추가 요구사항을 반영한 뒤에만 P02로 포인터를 전진한다.
