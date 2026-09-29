# Task: T02 낮 배경과 정적 장애물 비주얼

## Status: done

## Goal
월드 1 2·4단계 배경에 기본 배경과 같은 픽셀 윤곽선을 적용하고, 열린 맨홀은 첨부 격자 스타일로, 새 장애물은 비둘기로 표시한다. 맨홀 낙하 판정과 안전 구간은 그대로 유지한다.

## Decision Summary
- 지붕길·빨랫줄 PNG는 기존 구성과 낮 팔레트를 유지한 채 외곽선과 더 선명한 픽셀 질감을 입힌다.
- 맨홀 참조의 남색 격자·회청색 테두리를 쓰되, 바닥 타일을 비워 두는 기존 낙하 동작을 가리지 않는 열린 구멍 아트로 만든다.
- seagull-static을 pigeon-static으로 코드와 생성 맵 전체에서 이름을 맞춘다.

## Implementation

### I01. 배경 및 장애물 이미지
- Related Files:
  - public/assets/pixel/backgrounds/world-01/world-01-roof-day-mid.png :: 낮 지붕 배경; replace
  - public/assets/pixel/backgrounds/world-01/world-01-clothesline-day-mid.png :: 낮 빨랫줄 배경; replace
  - public/assets/pixel/props/world-01/manhole-open.png :: 열린 맨홀; replace
  - public/assets/pixel/props/world-01/pigeon-static.png :: 정적 비둘기; new
  - public/assets/pixel/props/world-01/seagull-static.png :: 낡은 갈매기 그림; delete after references migrate

#### Details
- Edit each existing background with imagegen. Preserve composition, transparency, daytime palette and 1920:720 visual ratio; add crisp dark pixel outlines to roof walls, tiles, laundry line, cloth, masonry and foreground edges. Avoid photorealistic gradients, blur and extra objects.
- Edit the existing manhole art using the attached dark navy grid and blue-gray beveled outline as the visual reference. Preserve a dark open center/readable hole and transparent surroundings so the 80px floor gap remains visually clear.
- Edit the static bird into a compact side-view city pigeon with gray body, darker wing blocks, small head and no seagull silhouette. Preserve transparent canvas and match the existing 48x32 in-game scale.
- Preserve the current runtime display sizes and nearest-neighbor pixel rendering. Inspect each final image at native size and in the game.

### I02. 비둘기 기믹 이름과 생성 맵 연결
- Related Files:
  - src/game/core/contentTypes.ts :: GimmickKind; modify
  - src/game/data/world01Gimmicks.ts :: StaticKind, dangers, visuals, minimums; modify
  - src/game/data/validateMaps.ts :: static danger and counterplay validation; modify
  - src/game/systems/MapGimmickSystem.ts :: static visual and hazard switches; modify
  - src/game/data/worldMaps.ts :: hazardCatalog; modify
  - scripts/world01-maps.mjs :: danger kind and visual key generation; modify
  - src/game/assets/assetManifest.json :: static bird image key and URL; modify
  - public/assets/pixel/maps/world-01/world-01-stage-1.json through world-01-stage-4.json :: generated object kind and key; regenerate

#### Details
- Replace the GimmickKind value seagull-static with pigeon-static at every active source location. Keep its existing walk-enter trigger, lethal outcome, section placement and jump-before-zone counterplay.
- Use asset key world-01-pigeon-static and URL /assets/pixel/props/world-01/pigeon-static.png. Point world map hazard catalog to the new key.
- Run npm.cmd run world01:maps to regenerate all four Tiled maps; do not hand-edit generated JSON.
- Preserve the map floor holes, their 80px opening, checkpoint count, hazard spacing and fake bone coins.

## Acceptance Criteria
- [x] Stages 2 and 4 retain their daytime scene layouts with visible hard pixel outlines.
- [x] Open manhole image matches the supplied blue-gray grid style while the ground opening still causes a fall only after entering it.
- [x] All four static birds look like pigeons; no active asset or generated map uses a seagull kind/key.
- [x] Map generator check confirms the World 1 hazard and checkpoint layout has not changed.

## Validation
- npm.cmd run world01:maps — regenerate only intended map changes.
- npm.cmd run world01:maps:check — all map, floor hole and spacing assertions pass.
- npx.cmd tsc --noEmit — all renamed kind switches compile.
- npm.cmd run lint — no lint errors.
- npm.cmd run build — production build succeeds.
- Browser visual check — stage 2 roof and open manhole at .memory/test-plans/assets/world01-t08-stage2-roof.png; stage 4 clothesline and pigeon at .memory/test-plans/assets/world01-t08-stage4-clothesline.png.

## Commit Message
feat(월드1): 낮 배경과 맨홀 비둘기 그림 보정

Plan: 2026-09-29-world-stage-visual-polish
Phase: P01-progression-and-visuals
Task: T02-day-background-hazards

- 지붕과 빨랫줄 배경을 픽셀 윤곽선 스타일로 교체한다
- 열린 맨홀과 정적 비둘기를 새 그림에 연결한다

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: Korean T02 commit
