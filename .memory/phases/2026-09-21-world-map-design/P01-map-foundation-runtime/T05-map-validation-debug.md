# Task: T05 맵 검증과 디버그 표시

## Status: done

## Goal

25개 스테이지 맵이 구현되기 전에 구간 구조, 안전 구간, checkpoint, 출구, Tiled layer, chain 참조, 시드 그룹을 자동 검증하고, 개발 중에는 현재 구간·충돌·연쇄 상태를 확인할 수 있는 디버그 표시를 제공한다.

## Decision Summary

- 자동 검증과 수동 플레이테스트를 함께 사용한다.
- 첫 시도에는 피하기 어려운 억까를 허용하지만, 패턴을 파악하면 최소 한 개의 클리어 경로가 있어야 한다.
- 전경 가림은 허용하되 debug mode에서 physics body와 오브젝트 경계를 확인할 수 있어야 한다.

## Implementation

### I01. 정적 맵 검증기

- Related Files:
  - src/game/data/validateMaps.ts :: validateStageMap, validateCampaignMaps; new
  - src/game/data/validateContent.ts :: validation integration; modify
  - src/game/data/index.ts :: exported diagnostics; modify

#### Details

- validateStageMap(stage, theme, map) 결과는 errors, warnings, stageId를 가진 MapValidationReport를 반환한다.
- errors는 다음을 포함한다.
  - mapWidth/mapHeight와 tile size 불일치
  - 5개 section 누락·중복·겹침·공백
  - safe-entry/safe-exit에 lethal trap, forced movement, blocking chain 존재
  - checkpoint 개수 또는 section 위치 오류
  - exit 누락 또는 safe-exit 밖 위치
  - map object의 참조되지 않은 chainId, variantPool, seedGroup
  - gameplay layer가 없는 맵
- warnings는 전경이 모든 gameplay object를 가리는 경우, 수집품 도달 경로가 없는 경우, 테마 asset key가 없는 경우로 정의한다.
- validateCampaignMaps는 WORLD_IDS와 STAGE_IDS 전체를 순회해 25개 보고서를 합친다.

### I02. 개발 디버그 오버레이

- Related Files:
  - src/game/debug/MapDebugOverlay.ts :: MapDebugOverlay; new
  - src/game/scenes/StageScene.ts :: debug flag and update; modify
  - src/app/page.tsx or game launch options :: development-only flag; modify only if required

#### Details

- overlay는 개발 모드에서만 활성화하고 다음 정보를 표시한다.
  - stage id, world id, current section index and role
  - attempt, random seed, checkpoint id
  - active chain ids, dynamic object states
  - player screen x, camera scroll, map bounds
- F1 또는 기존 debug option으로 toggle하며 production build에서는 기본 비활성화한다.
- physics body, lethal trap region, checkpoint, exit, foreground occlusion bounds를 색상별로 표시한다.

## Acceptance Criteria

- [ ] 유효하지 않은 section·checkpoint·exit·chain 참조를 registry validation이 명확한 오류로 보고한다.
- [ ] 25개 맵을 한 번에 순회하는 campaign report가 생성된다.
- [ ] 개발 모드에서 section, seed, checkpoint, chain, collision을 확인할 수 있다.
- [ ] production runtime에는 디버그 overlay가 자동 표시되지 않는다.

## Validation

- npm run lint
- npm run build
- 의도적으로 safe-exit에 lethal trap을 넣은 fixture가 오류를 내는지 확인
- 정상 샘플과 누락 asset 샘플의 errors/warnings를 비교

## Commit Message

feat(map): validate campaign maps and add debug overlay

Plan: 2026-09-21-world-map-design
Phase: P01-map-foundation-runtime
Task: T05-map-validation-debug

- Validate five-section maps, chains, exits, and checkpoints
- Add development-only map diagnostics and collision overlays

## Progress

- [x] 구현 완료
- [x] 검증 통과 (`npm.cmd run lint`, `npm.cmd run build`)
- commit: pending
