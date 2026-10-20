# Task: T01 월드 2 작은 사물 확대와 과자 봉지 디자인

## Status: done

## Goal

월드 2 첫 스테이지의 캔·과자 봉지·삽·라바콘·고양이 그림을 기존보다 식별하기 쉽게 키우고, 과자 봉지를 파란색 `포카칩` 픽셀 아트로 교체한다.

## Decision Summary

- 스프링 기구 3종의 이미지·크기·Zone은 손대지 않는다.
- 코기 기본 점프 한 번으로 새로 키운 나머지 5종을 넘을 수 있어야 한다. 잠든/할퀴는 고양이는 같은 화면 크기를 쓴다.

## Implementation

### I01. 과자 봉지 이미지

- Related Files:
  - `public/assets/pixel/props/world-02/empty-snack-bag.png` :: 기존 PNG를 파란색 `포카칩` 글씨의 빈 봉지 픽셀 아트로 교체; modify
  - `.memory/test-plans/assets/2026-10-20-blue-snack-source.png` :: imagegen의 글자 없는 원화를 보관; new
  - `scripts/compose-world02-snack-bag.mjs` :: 원화를 게임 크기로 축소하고 정확한 한국어 글자를 합성; new
  - `scripts/world02-obstacle-assets.test.mjs` :: 봉지 새 크기와 파란색/글자 확인; modify

#### Details

- **Data & Schema Fields**: PNG는 투명 배경, 가능하면 96×64px. 봉지는 바닥에 놓인 구겨진 형태를 유지하고 중앙에는 흰색 또는 크림색 `포카칩` 3글자가 실제 1× 게임 화면에서 읽혀야 한다. 기존 월드 1 소품과 같은 두꺼운 자주색 윤곽·넓은 색면을 사용한다.
- **Execution Flow / Logic**: 현재 봉지와 월드 1 소품을 참고해 imagegen으로 글자 없는 청색 픽셀 원화를 만든다. `포카칩` 표기는 원화 생성 모델의 오자를 허용하지 않도록 조합 스크립트에서 정확한 한국어 텍스트를 합성한다. 원본을 남기고 96×64 PNG를 기존 경로에 배치한다. 투명 여백·하단 바닥 맞춤을 유지한다.
- **Error & Exception Handling**: 한국어 표기가 깨지거나 다른 문자로 바뀌면 그대로 사용하지 말고 다시 제작/검수한다. 원본과 같은 에셋 키 `world-02-obstacle-empty-snack-bag`을 유지한다.

### I02. 사물 크기와 안전한 충돌

- Related Files:
  - `src/game/data/world02Obstacles.ts` :: `World02ObstacleDefinition`, `WORLD02_STAGE1_OBSTACLES`; modify
  - `src/game/systems/World02ObstacleSystem.ts` :: constructor의 `image.setDisplaySize`와 Zone 적용; modify
  - `scripts/world02-obstacles.test.mjs` :: 새 시각 크기·Zone·스프링 불변 회귀; modify
  - `scripts/world02-cat-attack.test.mjs` :: 고양이 두 포즈 크기 유지; modify if needed

#### Details

- **Signatures & Types**: `World02ObstacleDefinition`에 `displaySize?: Readonly<{ width: number; height: number }>` 추가. 정의된 경우만 `image.setDisplaySize(width,height)`로 그린다. 고양이가 `setTexture`로 잠든/할퀴는 포즈를 바꿔도 128×75 표시 크기가 유지되도록 다시 동기화한다.
- **Data & Schema Fields**: 목표 표시 크기(폭×높이): 캔 72×50, 봉지 96×64, 삽 64×84, 라바콘 72×78, 고양이 두 포즈 128×75. 스프링 3종은 `displaySize` 없음. 기존 x/groundY는 전부 유지한다. 권장 Zone: 캔 36×22, 봉지 42×28, 삽 28×44, 라바콘 38×44, 고양이 62×32; 스프링 원래 42×44, 44×44, 42×44 그대로.
- **Execution Flow / Logic**: 이미지 바닥 origin (0.5,1), groundY 504. 5개 대상에만 displaySize를 설정한다. 크기를 조정한 Zone은 `scene.add.zone`에서 중심 y를 새 높이/2만큼 올린다. 잠든 고양이 접촉 시 공격 포즈도 같은 표시 크기다. 화면과 충돌 영역의 차이가 큰 투명 여백은 알파 실루엣 기준으로 검토한다.
- **Error & Exception Handling**: 기본 점프(속도 -460, 중력 1200, 수평 240)로 각 장애물을 한 번에 넘을 수 없는 경우 Zone을 줄이거나 표시 크기를 조금 낮춘다. 스프링 기구 Zone/크기를 키워 해결하지 않는다. 기존 사망 1회·체크포인트 복귀·상점 계획은 유지한다.

## Acceptance Criteria

- [x] 스프링 3종은 이전 크기/충돌 범위 그대로이고 다른 5종은 눈에 띄게 크다.
- [x] 파란 봉지의 정확한 `포카칩` 글자가 96×64 PNG와 확대 미리보기에서 확인된다.
- [x] 기본 점프의 이론상 통과 폭이 8종의 충돌 범위를 넘고, 기존 접촉/할퀴기 테스트가 통과한다.
- [x] 고양이가 할퀴기 포즈로 바뀌어도 갑자기 작아지지 않는다.

## Validation

- `node --test scripts/world02-obstacle-assets.test.mjs scripts/world02-obstacles.test.mjs scripts/world02-cat-attack.test.mjs scripts/world02-sand-floor.test.mjs` — 자산·충돌·기존 기능.
- `node scripts/validate-assets.mjs` — 필수 에셋 검사.
- `node scripts/compose-world02-snack-bag.mjs --check` — 원화로 재조합해도 최종 이미지가 동일한지 확인.
- `npm.cmd run lint`, `node node_modules/typescript/bin/tsc --noEmit`, `npm.cmd run build` — 코드 검사.
- 가능하면 실제 브라우저에서 1280×720 및 모바일 화면으로 글자 가독성, 8종 점프, 접촉/재시작을 확인한다.

## Commit Message

```text
feat(월드2): 작은 장애물 확대와 파란 포카칩 봉지 적용

Plan: 2026-10-20-world02-obstacle-readability
Phase: P01-obstacle-readability
Task: T01-enlarge-props-and-redesign-snack

- 스프링 기구를 제외한 사물 표시 크기 조정
- 파란 과자 봉지와 포카칩 글씨 제작
- 점프 가능한 충돌 범위와 고양이 포즈 검증
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (`node --test` 22건, 자산 검사, 재생성 검사, 린트, 타입 검사, 빌드)
- [검증 기록](../../../test-plans/2026-10-20-world02-obstacle-readability.md)
- commit: 이 Task 커밋
