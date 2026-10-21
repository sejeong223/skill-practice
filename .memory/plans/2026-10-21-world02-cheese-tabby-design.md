# Plan: 월드 2 치즈 태비 보스 디자인

## Goal

월드 1 삼색이와 잠자는 놀이터 고양이에서 확실히 구별되는 치즈 태비의 픽셀 스프라이트를 제작하고, 월드 2 보스 스테이지에서 확인할 수 있도록 에셋을 등록·표시한다. 전투 구현 전에도 네 자세를 이미지와 미리보기에서 검토할 수 있다.

## Confirmed Decisions

[결정 문서](../decisions/2026-10-21-world02-cheese-tabby-design.md)의 사용자 선택과 코드 확인 결과를 따른다. 놀이터 대장 호루라기, 단순한 눈, 주황 줄무늬, 128×128 네 프레임을 사용한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 치즈 태비 그림 제작, 에셋 등록, 보스 스테이지 시각 표시와 검증 | [P01](../phases/2026-10-21-world02-cheese-tabby-design/P01-boss-art/phase.md) |

## Task Order

1. **T01 치즈 태비 픽셀 원화와 네 자세** — 재편집 가능한 픽셀 원본과 투명 PNG 스프라이트 시트를 만들고 프레임·색·투명·기준선을 검증한다.
2. **T02 에셋 등록과 보스 맵 표시** — 새 필수 스프라이트를 로더에 등록하고 월드 2 보스 스테이지에 대기 프레임을 표시해 실제 크기·방향·정리 동작을 확인한다.

## Task Boundary Rationale

- T01은 그림 자체의 가독성과 프레임 규격만으로 검증 가능한 완결된 결과다. T02는 확정된 파일을 로더·씬에 연결하므로 이미지를 수정하지 않고 표시 문제를 따로 추적할 수 있다.
- 일반적인 한 에셋 기능이므로 Phase는 하나만 둔다. 전투 패턴·체력·승리 처리는 기존 보스 구현 Task에 남긴다.

## Regression Gates

- 월드 1 `world-01-calico-boss`와 월드 2 잠자는 고양이 장애물 에셋·판정은 수정하지 않는다.
- 새 그림은 원본 오른쪽 얼굴, 스테이지에서는 왼쪽 얼굴이 보이도록 `flipX`만 적용한다. 프레임을 좌우 뒤집어 저장하지 않는다.
- `world-02-stage-boss`, `world-02-boss`, `bite` 등 기존 데이터 ID는 유지한다. 미완성 보스전의 공격·클리어 규칙을 시각 디자인 Task에서 임의로 바꾸지 않는다.
- 기본 1280×720 게임 크기와 기존 놀이터 색감을 유지한다.

## Validation Gate

각 Task의 아트·에셋 검사에 더해 `node scripts/validate-assets.mjs`, `npm.cmd run lint`, `npm.cmd run build`, `node node_modules/typescript/bin/tsc --noEmit`을 통과시킨다. T02는 브라우저에서 보스 스테이지에 직접 들어가 실제 표시를 확인한다.
