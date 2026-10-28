# Phase: P01 코기 발레 피루엣 점프

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | 기본 코기 회전 전신 8프레임과 좌우 보정 자산 | [T01](./T01-core-pirouette-art.md) |
| T02 | `done ✅` | 의상 5종·색칠 의상·장신구 5종 회전 자산과 색칠 좌표 지도 | [T02](./T02-wardrobe-pirouette-art.md) |
| T03 | `done ✅` | 점프 시작 이벤트, 0.6초 애니메이션, 외형·스킬·방향 동기화 | [T03](./T03-pirouette-runtime.md) |
| T04 | `done ✅` | 회귀 자동 검사와 게임 화면에서 자세·장비·착지 검증 | [T04](./T04-pirouette-regression-qa.md) |

## Progress

- done: 4/4 (active: 없음)

## Dependency Order

1. T01의 기본 `corgi-pirouette`와 프레임·발 앵커 규격을 확정한다.
2. T02가 동일 규격으로 의상·장신구·색칠 의상을 완성한다.
3. T03이 완성된 텍스처 키를 플레이어 표시 흐름에 연결한다.
4. T04가 자동 검사와 실제 장면으로 전 방향, 착지, 공중 스킬, 외형 교체를 확인한다.
