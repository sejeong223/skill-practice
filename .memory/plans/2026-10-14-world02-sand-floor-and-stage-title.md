# Plan: 월드 2 모래 바닥과 첫 스테이지 이름

## Goal

월드 2 첫 스테이지에 새로 만든 모래 바닥 PNG 한 장을 좌우로 반복 표시하고, 코기가 x=0부터 x=3840까지 끊김 없이 걸을 수 있게 한다. HUD의 첫 스테이지 이름을 `지옥의 동네 놀이터`로 표시한다.

- [확정 결정](../decisions/2026-10-14-world02-sand-floor-and-stage-title.md)

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 모래 PNG 제작·등록, 첫 스테이지 충돌/렌더링 및 이름 변경 | [P01](../phases/2026-10-14-world02-sand-floor-and-stage-title/P01-sand-floor-and-title/phase.md) |

## Execution Order

1. T01에서 기존 월드 2 이미지와 맞는 반복 가능한 모래 바닥 PNG 한 장을 만들고 필수 이미지 키 `world-02-sand-floor`로 등록한다.
2. T02에서 첫 스테이지의 임시 발판을 연속 충돌 바닥 한 개로 바꾸고, 같은 상단 y=504에서 새 이미지를 반복 표시한다. 첫 스테이지 이름도 바꾸고 다른 스테이지·월드 2 진입 컷신은 유지한다.

## Existing Runtime Findings

- 월드 2 `world-02-background-far`/`mid`/`world-02-foreground` 3장은 이미 필수 로드되고 패럴랙스로 그려진다. 실제 `world-02-tileset.png`와 `world-02-stage-1.json`은 없으므로 `TiledMapLoader.load()`는 `null`이고, `StageRuntime.buildFromSegments()`가 임시 발판과 장애물을 만든다.
- 첫 스테이지 맵은 3840×720이고 임시 발판 상단은 y=520−16=504다. 기존 발판은 섹션별 중심 x=16 때문에 겹침·큰 틈이 있으며, 이미지로 연속 바닥을 보여주려면 충돌 범위도 함께 고쳐야 한다.
- `StageEntityFactory.createPlatform()`의 갈색 사각형은 충돌과 외형을 겸한다. 첫 스테이지에서만 사각형을 숨기고 충돌은 유지하며, 모래 이미지를 깊이 -2에 두면 깊이 -1의 함정과 깊이 10의 코기가 앞에 남는다.
- `src/game/data/worlds.ts`의 `stageTitles[0]`이 `stage.title`로 전달되어 HUD에 표시된다. 월드 전체 title은 `놀이터`이며 이번 이름 변경의 대상이 아니다.

## Acceptance

- 새 모래 PNG 한 장이 기존 컷신·플레이 배경의 밝은 모래 색과 어울리고, 좌우 반복 이음새가 눈에 띄지 않는다. 후속 수정에 따라 윗면은 1~10px로 눈에 보이게 울퉁불퉁하지만 충돌 높이는 일정하다.
- 월드 2 첫 스테이지의 3840px 전체에 모래 바닥이 보이며 코기가 중간 섹션 경계와 출구까지 떨어지지 않고 걸을 수 있다. 함정·적은 모래 위에 보여야 한다.
- 첫 스테이지 HUD에는 `지옥의 동네 놀이터`가 표시된다. 월드 ID·스테이지 ID, 다른 스테이지 이름과 월드 2 진입 연출은 유지된다.
- 실제 Tiled 맵이 나중에 추가되면 임시 모래 렌더링이 중복되지 않는다.

## Progress

- done: 2/2 (active: 없음)
