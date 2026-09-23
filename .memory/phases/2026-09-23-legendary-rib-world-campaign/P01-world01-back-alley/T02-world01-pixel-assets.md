# Task: T02 World 1 픽셀 에셋과 로딩

## Status: pending

## Goal

World 1의 따뜻한 주거지 뒷골목을 16×16 타일과 동일한 픽셀 아트 규칙으로 구현하고, 맨홀·개미·쓰레기통·빨랫줄·실외기·상자·구름·가시·비둘기·깃발·뼈 코인을 게임에서 로드할 수 있게 한다.

## Decision Summary

- 기존 코기·고양이·밥그릇과 같은 저해상도 픽셀 실루엣, 제한 팔레트, nearest-neighbor 렌더링을 사용한다.
- 위험 여부를 사전에 알려주는 별도 경고색·경고 아이콘은 만들지 않는다. 함정 사물은 평범한 배경 소품처럼 보이되 트리거 이후에만 결과가 드러난다.

## Implementation

### I01. 타일셋과 배경/전경 에셋

- Related Files:
  - `public/assets/pixel/tiles/world-01/world-01-tileset.png` :: 16px tileset; new generated asset
  - `public/assets/pixel/backgrounds/world-01/world-01-far.png` :: distant houses and sunset; new generated asset
  - `public/assets/pixel/backgrounds/world-01/world-01-mid.png` :: brick walls, wires, signs; new generated asset
  - `public/assets/pixel/backgrounds/world-01/world-01-foreground.png` :: fence silhouettes and occlusion props; new generated asset
  - `public/assets/pixel/props/world-01/*.png` :: hazard props and state variants; new generated assets

#### Details

- tileset atlas에는 바닥, 벽돌벽, 콘크리트, 맨홀, 울타리, 대문, 지붕, 배수관, 빨랫줄 지지대, 에어컨 실외기 받침을 포함한다.
- props에는 `ant`, `trash-can`, `clothesline`, `air-conditioner`, `cat-box`, `cloud`, `white-spike`, `pigeon`, `fake-checkpoint`, `bone-coin`, `name-bubble`의 기본 visualKey와 triggered/disabled/variant frame을 포함한다.
- state variant는 시각적 경고가 아니라 결과 연출용이다. 예를 들어 가짜 코인의 초록색·불꽃·뒤집힌 상태는 수집 후에만 표시한다.
- 모든 파일은 transparent background를 유지하고, 게임 렌더러가 보간하지 않도록 1배 픽셀 원본을 보존한다.

### I02. Asset manifest와 Preload 연결

- Related Files:
  - `src/game/assets/assetManifest.json` :: World 1 asset entries; modify
  - `src/game/scenes/PreloadScene.ts` :: stage/world asset selection; modify
  - `src/game/maps/ParallaxRenderer.ts` :: world-01 layer asset fallback; read-only unless required

#### Details

- asset key는 `world-01-tileset`, `world-01-background-far`, `world-01-background-mid`, `world-01-background-foreground`, `world-01-prop-*` 규칙을 사용한다.
- StageScene이 World 1을 시작할 때 필요한 tilemap·tileset·4개 패럴랙스 레이어·props를 모두 preload하고, 누락 파일은 required asset load error로 보고한다.
- World 2~5의 placeholder asset은 이번 Task에서 건드리지 않는다. 공통 preload 경로를 바꾸면 이미 완성한 P01 fallback이 깨질 수 있으므로 worldId 필터로 한정한다.

## Acceptance Criteria

- [ ] World 1 타일셋이 16px 기준으로 로드된다.
- [ ] 먼 배경·중경·게임플레이·전경이 서로 다른 scroll factor로 렌더링된다.
- [ ] 11종 핵심 사물과 결과 variant가 asset key로 resolve된다.
- [ ] World 1 asset 누락은 조용한 placeholder가 아니라 preload 진단에 표시된다.

## Validation

- `npm.cmd run lint`
- `npm.cmd run build`
- 개발 실행 후 `world-01-stage-1`에서 타일셋과 4개 레이어가 nearest-neighbor로 표시되는지 수동 확인
- 브라우저 Network에서 World 1 asset 요청이 성공하고 World 2 placeholder가 이번 Task에서 불필요하게 로드되지 않는지 확인

## Commit Message

```text
feat(map): 월드1 뒷골목 픽셀 에셋과 로딩 연결

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P01-world01-back-alley
Task: T02-world01-pixel-assets

- Add warm residential tiles and layered World 1 pixel art assets
- Load World 1 props and map visuals through the asset manifest
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
