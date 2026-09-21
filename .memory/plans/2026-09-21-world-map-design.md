# Plan: 5개 월드 맵 디자인

## Goal

기존의 공통 직사각형 프로토타입 맵을 5개 월드 × 일반 4개 + 보스 1개의 실제 캠페인 맵 구조로 확장한다. 각 일반 스테이지는 3,840px 가로 진행과 5개 구간을 사용하고, 진입·탈출 5%만 안전하게 유지하며 중앙 3개 구간에 월드별 억까와 연쇄 기믹을 집중한다. 월드별 16×16px 타일셋, Tiled 맵 파일, 4단계 패럴랙스, 왼쪽 편향 카메라, 시드 기반 변형, 체크포인트 복구, 자동 검증을 완성한다.

이 계획은 기존 P04의 이전 장소명과 일반 세그먼트 청사진을 대체한다. 기존 P04 파일은 기록 보존용으로 남기며 이 계획의 월드명·맵 규칙·Task를 기준으로 실행한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | done | 맵 스키마, Tiled 로더, 연쇄 이벤트, 런타임, 카메라, 검증 기반 | [P01](../phases/2026-09-21-world-map-design/P01-map-foundation-runtime/phase.md) |
| P02 | pending | World 1 뒷골목의 타일셋·4개 스테이지·냥아치 초소 보스 맵 | [P02](../phases/2026-09-21-world-map-design/P02-world01-back-alley/phase.md) |
| P03 | pending | World 2 놀이터의 타일셋·4개 스테이지·놀이터 관리실 보스 맵 | [P03](../phases/2026-09-21-world-map-design/P03-world02-playground/phase.md) |
| P04 | pending | World 3 뒷산의 타일셋·4개 스테이지·산 정상 보스 맵 | [P04](../phases/2026-09-21-world-map-design/P04-world03-mountain/phase.md) |
| P05 | pending | World 4 냥아치 아지트의 타일셋·4개 스테이지·간부실 보스 맵 | [P05](../phases/2026-09-21-world-map-design/P05-world04-cat-hideout/phase.md) |
| P06 | pending | World 5 캣타워 공성전의 타일셋·4개 스테이지·최종 우두머리 맵 | [P06](../phases/2026-09-21-world-map-design/P06-world05-cat-tower-siege/phase.md) |
| P07 | pending | 25개 맵 통합 검증, 성능, 릴리스 기준 점검 | [P07](../phases/2026-09-21-world-map-design/P07-validation-release/phase.md) |

## Execution Order

1. P01에서 기존 StageDefinition·StageRuntime의 generic segment 구조를 맵 메타데이터와 Tiled 레이어를 수용하는 기반으로 확장한다.
2. P02부터 P06까지 월드 순서대로 각 월드의 공용 타일셋, 4개 일반 맵, 보스 아레나와 기믹 체인을 추가한다.
3. 각 월드의 일반 맵은 1구간 진입, 2~4구간 억까, 5구간 탈출의 역할을 지키며 3구간과 4구간 사이에 체크포인트를 둔다.
4. P07에서 전체 25개 StageDefinition과 Tiled 맵의 연결성, 출구 도달 가능성, 패럴랙스, 시드 재현성, 빌드·린트를 검증한다.

## Definition of Done

- [ ] 월드 ID와 장소명이 뒷골목, 놀이터, 뒷산, 냥아치 아지트, 캣타워 공성전으로 정리되어 있다.
- [ ] 일반 20개 맵이 3,840px 구조와 5개 구간 규칙을 만족하고, 보스 5개 맵이 1,920px 전용 아레나를 사용한다.
- [ ] 월드별 공용 타일셋과 스테이지별 Tiled 맵이 Phaser에서 로드되고 4개 패럴랙스 레이어로 렌더링된다.
- [ ] 전경 가림은 허용하되 충돌과 렌더링이 분리되고, 카메라는 플레이어를 화면 왼쪽 25%에 둔다.
- [ ] 대부분의 함정은 고정이며 일부 변형만 시드 기반으로 재선택되고, 체크포인트 재시작은 동일 시드를 유지한다.
- [ ] 맵 연쇄 규칙은 Tiled 오브젝트 속성과 데이터 기반 조건·반응으로 실행된다.
- [ ] 스킬과 도구는 필수 맵 이동 능력으로 사용되지 않는다.
- [ ] 자동 맵 검증과 수동 플레이테스트 기준이 모두 통과하고 npm run lint와 npm run build가 성공한다.
