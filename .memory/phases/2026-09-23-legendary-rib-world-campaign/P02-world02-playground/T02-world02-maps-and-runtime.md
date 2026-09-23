# Task: T02 World 2 놀이터 맵과 runtime

## Status: pending

## Goal

승인된 World 2 설계를 4개 일반 Tiled 맵과 픽셀 에셋으로 구현하고, World 1에서 검증한 공통 gimmick runtime에 월드2 데이터만 주입한다.

## Implementation

### I01. Assets and maps

- Related Files:
  - `public/assets/pixel/tiles/world-02/world-02-tileset.png` :: new
  - `public/assets/pixel/backgrounds/world-02/*` :: new
  - `public/assets/pixel/props/world-02/*` :: new
  - `public/assets/pixel/maps/world-02/world-02-stage-{1,2,3,4}.json` :: new
  - `src/game/assets/assetManifest.json` :: World 2 assets; modify
  - `src/game/data/world02Maps.ts` :: map definitions and chains; new

#### Details

- 16×16 tile, four parallax layers, 3840px width, 5 sections, true checkpoint one, safe entry/exit rules are mandatory.
- main route is single-path; slide/swing/jungle-gym vertical movement cannot create a shortcut.
- no gameplay asset may carry a warning sign that reveals an instant-death trigger before activation.

### I02. Runtime wiring

- Related Files:
  - `src/game/scenes/StageScene.ts` :: world map selection; modify only required integration
  - `src/game/data/validateMaps.ts` :: World 2 count and references; modify

#### Details

- Do not add world-specific branching to `MapGimmickSystem` when data or chain rules can express the behavior.
- Preserve World 1 seed replay, fake checkpoint exclusion, control override cleanup, death count, and banked coin rules.

## Acceptance Criteria

- [ ] World 2 four normal maps load in Phaser and report zero validation errors.
- [ ] World 2 has at least 30 catalog entries and no safe-section lethal objects.
- [ ] World 1 regression flow still passes.

## Validation

- `npm.cmd run lint`
- `npm.cmd run build`
- World 2 stage 1→4 manual playtest and same-seed restart comparison

## Commit Message

```text
feat(map): 월드2 놀이터 일반 맵과 기믹 연결

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P02-world02-playground
Task: T02-world02-maps-and-runtime

- Add playground pixel assets and four single-route maps
- Reuse the hidden-gimmick runtime with World 2 data
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
