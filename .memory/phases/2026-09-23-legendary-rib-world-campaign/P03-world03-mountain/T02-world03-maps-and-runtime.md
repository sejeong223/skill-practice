# Task: T02 World 3 뒷산 맵과 runtime

## Status: pending

## Goal

승인된 뒷산 설계를 4개 일반 Tiled 맵과 픽셀 에셋으로 제작하고 공통 hidden-gimmick runtime과 연결한다.

## Implementation

- Related Files:
  - `public/assets/pixel/tiles/world-03/world-03-tileset.png` :: new
  - `public/assets/pixel/backgrounds/world-03/*` :: new
  - `public/assets/pixel/props/world-03/*` :: new
  - `public/assets/pixel/maps/world-03/world-03-stage-{1,2,3,4}.json` :: new
  - `src/game/data/world03Maps.ts` :: new
  - `src/game/assets/assetManifest.json` :: World 3 entries; modify
  - `src/game/data/validateMaps.ts` :: World 3 checks; modify

#### Details

- 3840px, 5 sections, one real checkpoint, 192px safe entry/exit, single route, no pre-hints.
- vertical mountain set pieces may use 1152px map height but cannot create a route branch.
- reuse runtime APIs; new behavior must be a typed gimmick kind or data chain, never an untyped scene special case.

## Acceptance Criteria

- [ ] Four maps and 30+ catalog entries validate with zero errors.
- [ ] World 1 and World 2 regression tests remain green.

## Validation

- `npm.cmd run lint`
- `npm.cmd run build`
- World 3 stage 1→4 and same-seed replay manual test

## Commit Message

```text
feat(map): 월드3 뒷산 일반 맵과 기믹 연결

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P03-world03-mountain
Task: T02-world03-maps-and-runtime

- Add mountain pixel assets and single-route maps
- Connect World 3 hazards to the shared gimmick runtime
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
