# Task: T04 작은 픽셀 하트와 통합 화면 검수

## Status: pending

## Goal

삼색이 전투의 코기 생명 표시를 외곽 상자 없는 짧은 픽셀 하트 세 칸으로 바꾸고, T01~T03의 맵·화면·진행 흐름을 한 번에 확인한다.

## Decision Summary

- 보스전 HUD의 코기 얼굴과 3→2→1→0 생명 수·접근성 안내는 유지한다.
- 글꼴 기호 `♥` 대신 작은 픽셀 모양 SVG를 사용한다. 하트 묶음의 border, background, padding은 없앤다.
- 새 맵과 배경이 게임의 16:9 프레임에서 꽉 보이는지 데스크톱·모바일 크기에서 확인한다.

## Implementation

### I01. 픽셀 하트 DOM과 스타일

- Related Files:
  - `src/components/game/Hud.tsx` :: `boss-hearts`, `boss-heart` 렌더링; modify
  - `src/app/globals.css` :: `.boss-hearts`, `.boss-heart`, 모바일 media 규칙; modify

#### Details

- **Signatures & Types**: `bossHearts: 0 | 1 | 2 | 3` 또는 현재 HUD에서 받는 동일 범위 수. 기존 `<div className="boss-hearts" role="status" aria-label="코기 남은 하트 N개">`, 얼굴 span, index 0~2 루프는 유지한다. 각 칸은 장식용 `aria-hidden="true"` 픽셀 SVG를 포함한다.
- **Data & Schema Fields**: SVG `viewBox="0 0 14 10"`, `shapeRendering="crispEdges"`. 좌우 두 봉우리, 넓은 3~4px 몸통, 아래로 짧게 닫히는 10px 실루엣의 정수 좌표 path/rect로 만든다. 활성 색은 빨강 `#db4053`와 어두운 픽셀 음영 `#9e3348`, 빈 칸은 회색 `#a7a1a0`로 구분한다. 텍스트 그림자 대신 픽셀 형태의 1px 명암을 쓴다.
- **Execution Flow / Logic**:
  1. 문자 `♥` 렌더링을 제거하고 세 SVG의 fill 또는 class로 `index < bossHearts` 상태를 표시한다. `key={index}`, `aria-hidden`, 상위 `role=status`와 한국어 aria-label은 유지한다.
  2. `.boss-hearts`의 `border`, `background`, `padding`을 제거한다. 얼굴과 하트는 이어서 보여 주되 박스 윤곽이 없도록 한다. 하트 시각 크기는 데스크톱 약 18×13px, 모바일 약 15×11px로 지정한다. CSS의 기존 `font-size:23px/19px`와 `text-shadow`는 제거한다.
  3. 현재 `right:102px` 근처의 HUD 위치, 일시정지 버튼, 모바일 `.game-overlay.has-boss-hearts .game-hud` 너비 조정 규칙과 겹치지 않도록 좌우 간격을 확인한다. 얼굴 크기 24px/20px는 유지한다.
- **Failure/State**: 0개일 때도 세 빈 칸이 같은 자리에 남아 레이아웃이 흔들리지 않아야 한다. 시각 표시는 장식용이므로 스크린리더에는 중복 낭독 대신 부모의 현재 하트 개수만 전달한다.

### I02. 전체 계획의 통합 검수

- Related Files:
  - `src/game/data/world01Maps.ts`, `src/game/data/world01Gimmicks.ts`, `src/game/data/worlds.ts` :: T01의 맵 정의 확인; read-only
  - `public/assets/pixel/maps/world-01/world-01-stage-{1,2,3,4,boss}.json` :: 생성 결과 확인; read-only
  - `src/game/scenes/StageScene.ts`, `src/game/stages/StageEntityFactory.ts` :: 화면·판정 확인; read-only

#### Details

- **Execution Flow / Logic**:
  1. `world01:maps:check`가 일반 4개 160×45타일과 보스 80×45타일을 확인하는지 본다. 맵 스테이지 1→2→3→4→보스 이동과 보스 재시도 체크포인트 ID를 확인한다.
  2. 데스크톱 1280×720 게임 프레임과 모바일 크기에서 보스 시작·인트로·전투를 확인한다. 화면 안에 배경 빈 영역/겹침이 없고, 바닥 타일이 전 폭과 하단을 채우며, 코기와 삼색이가 보이는지 검사한다.
  3. 스테이지 2/4의 낮 깃발 접촉과 사망 후 복귀, 일반 맵 출구의 보이지 않는 접촉, 보스의 3→2→1→0 하트 및 J 근접 공격/생선 가시 피격·방어를 확인한다. 각 하트 상태와 모바일 일시정지 버튼 사이의 겹침도 확인한다.
  4. 문제가 발견되면 원인이 속한 T01~T03 범위의 파일을 이 Task에서 고치는 대신 해당 Task가 완료 처리되기 전 해결하거나, 이미 완료된 Task의 회귀 원인과 수정 파일을 이 Task 진행 기록에 명시한다. 검수 없이 계획 완료로 처리하지 않는다.
- **Failure/State**: Next.js/Phaser 실행 화면은 빌드 통과만으로 시각 문제를 증명하지 못한다. 실제 프레임 확인을 반드시 수행하고 체크한 해상도와 결과를 Task 진행 기록에 남긴다.

## Acceptance Criteria

- [ ] 3개 하트가 문자 글꼴 대신 픽셀 형상이며 기존보다 작고 낮고, 바깥 테두리·배경 사각형이 없다.
- [ ] 3/2/1/0 상태가 정확히 보이고 얼굴·일시정지 버튼·모바일 HUD가 서로 겹치지 않는다.
- [ ] 일반 맵 4개와 보스맵, 깃발·출구·재시도, 전투 피격·승리까지 T01~T03 수용 조건이 실제 화면에서 통과한다.
- [ ] 타입·린트·빌드·맵 검사·진행 회귀에 오류가 없다.

## Validation

- `npm run world01:maps:check` → 생성된 일반/보스 Tiled 데이터 검증 통과.
- `npx tsc --noEmit` → 타입 오류 없음.
- `npm run lint` → 수정 범위 린트 오류 없음.
- `npm run test:progression` → 스테이지 이동과 저장/재시도 회귀 통과.
- `npm run build` → 정적 에셋 경로 및 전체 빌드 통과.
- `npm run dev` → 데스크톱·모바일 수동 플레이와 HUD의 3/2/1/0 상태 확인.

## Commit Message

```text
feat(world01): render compact pixel hearts in calico fight

Plan: 2026-10-01-world01-compact-scenes
Phase: P01-world01-map-and-hud
Task: T04-pixel-hearts-and-review

- Replace heart glyphs with short pixel SVG shapes
- Remove the surrounding HUD box and verify map and boss presentation
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
