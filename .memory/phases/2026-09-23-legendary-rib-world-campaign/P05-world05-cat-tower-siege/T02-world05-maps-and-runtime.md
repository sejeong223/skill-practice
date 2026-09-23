# Task: T02 World 5 캣타워 맵과 runtime

## Status: pending

## Goal

승인된 캣타워 설계를 4개 일반 Tiled 맵·픽셀 에셋·공통 기믹 runtime으로 구현한다.

## Implementation

- Related Files:
  - `public/assets/pixel/tiles/world-05/world-05-tileset.png` :: new
  - `public/assets/pixel/backgrounds/world-05/*` :: new
  - `public/assets/pixel/props/world-05/*` :: new
  - `public/assets/pixel/maps/world-05/world-05-stage-{1,2,3,4}.json` :: new
  - `src/game/data/world05Maps.ts` :: new
  - `src/game/assets/assetManifest.json` :: World 5 entries; modify
  - `src/game/data/validateMaps.ts` :: World 5 checks; modify

#### Details

- 3840px normal maps, five sections, one real checkpoint, safe entry/exit, single route, no mandatory skills/tools.
- Cat tower vertical maps may use 1152px height. Camera vertical follow must be section-scoped, not globally enabled.
- The visible rib prop is not collectible or combat equipment in the final world.

## Acceptance Criteria

- [ ] Four maps and 30+ gimmicks validate with zero errors.
- [ ] Cat tower layers, occlusion, vertical camera, and seed replay work.
- [ ] Previous four worlds remain playable.

## Validation

- `npm.cmd run lint`
- `npm.cmd run build`
- World 5 stage 1→4 manual test and regression replay

## Commit Message

```text
feat(map): 월드5 캣타워 공성전 일반 맵과 기믹 연결

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P05-world05-cat-tower-siege
Task: T02-world05-maps-and-runtime

- Add cat tower assets and four siege maps
- Connect final-world gimmicks and vertical camera sections
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
