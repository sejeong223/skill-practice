# Phase: P01 월드 3 공사장 위험물

## Goal

기존 월드 3의 오후 3~4시 미술 스타일을 따르는 지상 장애물 두 종류와 공중 철골 빔을 일반 스테이지 1~4에 추가한다. 플레이어가 위험물을 보고 피할 수 있고, 사망·체크포인트·일시정지·스테이지 종료에서 상태가 정확히 정리되어야 한다.

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | 위험물 픽셀 이미지 3개와 에셋 로드·시각 계약 | [T01](./T01-hazard-art-and-assets.md) |
| T02 | `done ✅` | 8자리 지상 장애물 배치, 드럼 이동, 코인 간격과 재시작 | [T02](./T02-rolling-drum-and-wheelbarrow.md) |
| T03 | `done ✅` | 고정 위치 철골 빔 낙하, 연속 충돌 판정, 체크포인트와 플레이 QA | [T03](./T03-falling-steel-beam.md) |
| T04 | `in_progress 🔵` | 오래된 공사장 에셋 테스트를 현재 이미지·새 위험물에 맞춤 | [T04](./T04-construction-assets-test.md) |

## Progress

- done: 3/4 (active: T04)

## Shared constraints

- 일반 스테이지의 지상 장애물은 각 8개, 뼈 코인은 각 15개이며 기존 코인 ID와 보상을 유지한다. 보스 스테이지에는 새 위험물을 생성하지 않는다.
- 월드 3의 바닥 윗면은 y=504이고 꺼지는 바닥 너비는 128px이다. 이동 드럼의 **시작점부터 정지점까지**와 빔의 낙하 x좌표를 모든 스테이지의 바닥 구멍·고정 장애물·코인·체크포인트·출구에 대해 검사한다.
- 사망 이벤트는 `death-requested`의 `cause: "trap"`과 현재 `checkpointId`를 사용한다. 죽는 동안 중복 이벤트를 내지 않고, 재시작과 장면 종료 때 남은 그림·판정·타이머를 정리한다.
- `src/game/scenes/StageScene.ts`, `src/game/data/world03Construction.ts`, 일부 스크립트에 기존 미커밋 변경이 있다. Task별 변경 부분만 스테이징하고 다른 작업은 보존한다.
