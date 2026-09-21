# Task: T02 렌더링 성능과 릴리스 검증

## Status: pending

## Goal

25개 맵의 실제 브라우저 플레이 흐름을 검증하고, 4단계 패럴랙스·전경 가림·수직 카메라·많은 chain과 animated props가 데스크톱 브라우저에서 안정적으로 동작하도록 성능과 릴리스 기준을 확정한다.

## Decision Summary

- Phaser 게임 영역은 1280×720 FIT, pixelArt, roundPixels 설정을 유지한다.
- 카메라는 플레이어를 화면 왼쪽 25%에 두고, 수직 구간과 주요 대형 연출에서만 추가 이동·shake·zoom을 사용한다.
- 배경 애니메이션과 실제 physics object를 분리한다.

## Implementation

### I01. 성능 계측과 렌더링 정리

- Related Files:
  - src/game/maps/ParallaxRenderer.ts :: animation lifecycle; modify
  - src/game/stages/StageRuntime.ts :: entity cleanup; modify
  - src/game/camera/CameraDirector.ts :: follow and effect cleanup; modify
  - src/game/scenes/StageScene.ts :: shutdown lifecycle; modify
  - src/app/globals.css :: canvas pixel rendering; read-only unless regression

#### Details

- 맵 진입·이탈·재시작·체크포인트 복구 때 tilemap layer, animated prop, physics body, event listener가 누적되지 않는지 확인한다.
- foreground와 background animation은 화면 밖에서 update 비용을 줄이고, gameplay trap과 enemy만 active update를 유지한다.
- camera shake와 zoom effect가 종료 후 기본 zoom 1과 left-biased follow offset으로 복귀하는지 보장한다.
- StageRuntime records와 MapInteractionSystem listener 수를 디버그 수치로 노출해 재시작 누수를 찾는다.

### I02. 전체 수동 회귀 시나리오

- Related Files:
  - .memory/decisions/2026-09-21-world-map-design.md :: acceptance reference; read-only
  - .memory/plans/2026-09-21-world-map-design.md :: release checklist; read-only
  - docs/map-playtest-checklist.md :: manual checklist; new

#### Details

- 월드별로 최소 stage 1, stage 4, boss를 직접 플레이하고, 전체 25개 맵은 registry smoke run으로 로드한다.
- 시나리오를 포함한다.
  - safe-entry에서 lethal/forced/blocking이 없는지
  - central gauntlet의 고정·랜덤·연쇄 억까가 작동하는지
  - checkpoint 통과 후 사망·복구·동일 seed
  - optional collectible route가 main path를 막지 않는지
  - foreground 가림 중 physics body와 출구가 정상인지
  - World 5 최종 보스의 왕갈비뼈가 visual-only인지
  - 엔딩·크레딧·TO BE CONTINUED...? 연결
- 브라우저 콘솔 오류, FPS 저하, 중복 listener, 깨진 asset, 카메라 경계 오류를 기록하고 해당 Phase Task로 되돌린다.

## Acceptance Criteria

- [ ] 일반·보스 맵 진입과 재시작 후 entity/listener 누수가 없다.
- [ ] 4개 패럴랙스 레이어와 animated props가 데스크톱 브라우저에서 안정적으로 렌더링된다.
- [ ] 카메라 left bias, vertical follow, shake/zoom cleanup이 회귀 테스트를 통과한다.
- [ ] 수동 플레이테스트 체크리스트가 25개 스테이지에 대해 완료된다.
- [ ] npm run lint와 npm run build가 최종 상태에서 성공한다.

## Validation

- npm run lint
- npm run build
- npm run dev 후 데스크톱 브라우저에서 위 회귀 시나리오 실행
- 브라우저 Performance panel로 장시간 플레이와 checkpoint restart 비교

## Commit Message

chore(map): verify campaign performance and release flow

Plan: 2026-09-21-world-map-design
Phase: P07-validation-release
Task: T02-performance-and-release

- Verify map rendering, camera cleanup, and runtime lifecycle
- Add complete campaign map playtest checklist

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
