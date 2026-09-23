# Task: T02 World 4 냥아치 아지트 맵과 runtime

## Status: pending

## Goal

승인된 냥아치 아지트 설계를 4개 일반 Tiled 맵·픽셀 에셋·공통 기믹 runtime으로 구현한다.

## Implementation

- Related Files:
  - `public/assets/pixel/tiles/world-04/world-04-tileset.png` :: new
  - `public/assets/pixel/backgrounds/world-04/*` :: new
  - `public/assets/pixel/props/world-04/*` :: new
  - `public/assets/pixel/maps/world-04/world-04-stage-{1,2,3,4}.json` :: new
  - `src/game/data/world04Maps.ts` :: new
  - `src/game/assets/assetManifest.json` :: World 4 entries; modify
  - `src/game/data/validateMaps.ts` :: World 4 checks; modify

#### Details

- 3840px, five sections, one real checkpoint, 192px safe entry/exit, no map branch, no mandatory skill/tool use.
- foreground scrap and catwalk occlusion must be debug-visible and collision-separated.
- World 1~3 replay and seed snapshots must not change when World 4 assets are loaded.

## Acceptance Criteria

- [ ] Four World 4 maps and 30+ gimmicks validate with zero errors.
- [ ] Junkyard crowd/alarm chains are deterministic and checkpoint-safe.

## Validation

- `npm.cmd run lint`
- `npm.cmd run build`
- World 4 stage 1→4 manual test and same-seed replay

## Commit Message

```text
feat(map): 월드4 냥아치 아지트 일반 맵과 기믹 연결

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P04-world04-cat-hideout
Task: T02-world04-maps-and-runtime

- Add junkyard hideout assets and four single-route maps
- Connect crowd and alarm gimmicks to the shared runtime
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
