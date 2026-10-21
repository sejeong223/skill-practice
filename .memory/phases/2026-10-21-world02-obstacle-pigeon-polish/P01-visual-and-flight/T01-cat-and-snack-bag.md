# Task: T01 고양이 축소와 세로 포카칩 봉지 눕히기

## Status: done

## Goal

월드 2 첫 스테이지에서 고양이를 조금 작게 만들어 점프 여유를 늘리고, 세로 방향 포카칩 봉지를 모래 바닥에 납작하게 놓인 것처럼 표시한다.

## Decision Summary

- 포카칩의 세로 글자와 디자인은 기존 PNG 그대로 유지한다. 이미지를 가로로 회전하거나 가로 봉지 그림으로 바꾸지 않는다.
- 고양이의 잠든 그림과 할퀴기 그림에 동일한 표시 크기를 적용하고 충돌 영역도 함께 줄인다.

## Implementation

### I01. 장애물 데이터

- Related Files:
  - `src/game/data/world02Obstacles.ts` :: `WORLD02_STAGE1_OBSTACLES` — 포카칩 `displaySize: {width:80,height:36}`, `hitbox:{width:42,height:18}` 및 고양이 `displaySize:{width:112,height:66}`, `hitbox:{width:52,height:28}`; modify.
  - `public/assets/pixel/props/world-02/empty-snack-bag.png` — 기존 세로 포카칩 디자인; read-only.
  - `src/game/systems/World02ObstacleSystem.ts` :: 이미지 배치·할퀴기 복구 — 데이터의 크기를 그대로 사용하는지 확인; read-only.
- **Signatures & Types**: `World02ObstacleDefinition.displaySize?: Readonly<{width:number;height:number}>`, `hitbox: Readonly<{width:number;height:number}>`; 새 필드 없음.
- **Execution Flow / Logic**: 원본 이미지의 세로 방향은 유지하고 표시 높이만 줄여 바닥에 놓인 면의 화면 투영으로 만든다. 바닥 접점 `groundY:504`와 장애물 순서는 그대로다. 이미지 크기만 바꾸지 않고 실제 충돌 크기도 낮춘다.
- **Error & Exception Handling**: 고양이 할퀴기·재시작에서 이미지 크기가 원래대로 돌아가지 않아야 한다. 봉지의 충돌 높이가 보이는 모습보다 높아 허공에서 죽지 않게 한다.

### I02. 검증

- Related Files:
  - `scripts/world02-obstacles.test.mjs` :: 표시·충돌 크기와 점프 통과 확인; modify.
  - `scripts/world02-cat-attack.test.mjs` :: 잠든 그림·할퀴기 그림·재시작 크기 확인; modify.
- **Execution Flow / Logic**: 8종 장애물 종류, 7종 즉시 사망과 고양이 할퀴기, 스프링 기구의 기존 크기를 그대로 검증한다.

## Acceptance Criteria

- [x] 고양이의 두 그림과 충돌 영역이 작아지고 기본 점프로 넘어갈 수 있다.
- [x] 포카칩 글자 방향과 세로 인쇄 디자인을 유지하면서 봉지가 바닥에 납작하게 놓여 보인다.
- [x] 포카칩의 충돌 영역이 화면 표시와 일치한다.

## Validation

- `node --test scripts/world02-obstacles.test.mjs scripts/world02-cat-attack.test.mjs`
- `node node_modules/typescript/bin/tsc --noEmit`
- `npm.cmd run lint`
- `npm.cmd run build`

## Commit Message

```text
feat(world02): 고양이를 줄이고 세로 포카칩 봉지를 바닥에 놓기

Plan: 2026-10-21-world02-obstacle-pigeon-polish
Phase: P01-visual-and-flight
Task: T01-cat-and-snack-bag
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 — 관련 테스트 8건, 타입 검사, lint, build
- commit: pending
