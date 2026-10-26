# Plan: 월드 2 치즈 태비 레퍼런스 기반 전면 재작화

## Goal

월드 2 치즈 태비를 현재 그림의 크기 변경이나 색상 교체로 처리하지 않고, 코기·턱시도·삼색이 **실제 게임 에셋**과 나란히 놓아도 같은 게임의 캐릭터로 읽히도록 새로 그린다. 투명 96×96 프레임 네 개(가로 384×96)를 유지해 기존 보스 전투의 대기·예고·공격·패배 상태에 연결하고, 게임 화면에서 그림체·바닥 정렬·판정을 확인한다.

## Source of Truth

1. 이번 사용자 요청: 기존 치즈 태비 디자인 문서를 배제하고 코기, 턱시도, 삼색이 에셋과 같은 캐릭터 그림체로 **디자인 자체를 다시 제작**한다.
2. 시각 레퍼런스(읽기 전용): `public/assets/pixel/characters/corgi/corgi-run.png`, `public/assets/pixel/characters/corgi/corgi-bark.png`, `public/assets/pixel/characters/world-04/tuxedo-boss.png`, `public/assets/pixel/characters/world-01/calico-boss.png`.
3. 현재 게임 코드와 에셋 목록은 프레임 수·위치·충돌·공 발사점의 **기술 계약** 확인에만 사용한다. 기존 치즈 태비 SVG/PNG 및 모든 이전 치즈 태비 디자인 결정·계획 문서는 시각 레퍼런스로 사용하지 않는다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 원본 래스터 시트 재작화, 생성·검증 흐름 전환, 보스 장면 통합 확인 | [P01](../phases/2026-10-26-world02-cheese-tabby-reference-redraw/P01-reference-art-rebuild/phase.md) |

## Task Order and Boundary

| Task | Output | Dependency |
| :--- | :--- | :--- |
| T01 | 레퍼런스와 같은 그림 언어의 새 원본 PNG, 게임용 4프레임 PNG, 확대 미리보기, 에셋 검증 | 없음 |
| T02 | 현재 보스 런타임 계약과 새 그림의 정렬, 브라우저 화면·전투 검증, 최종 스크린샷 | T01 |

현재 작업 트리에는 앞선 치즈 태비 수정이 커밋되지 않은 채 남아 있다. 실행 시 다른 작업을 되돌리지 말고 Task별 지정 파일만 스테이징한다. 이전 디자인 결정 문서는 이 계획의 근거도 커밋 대상도 아니다.
