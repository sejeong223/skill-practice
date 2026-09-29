# Task: T06 World 1 보스와 완료 게이트

## Status: superseded

> 2026-09-29: [월드 1 낮 경로와 삼색이 보스 계획](../../../plans/2026-09-29-world01-daylight-calico.md)의 T04~T07로 교체됨. 아래 턱시도 보스 설계는 역사 기록이며, 새 삼색이 보스 청사진만 실행한다.

## Goal

World 1의 일반 4개 완료 후 냥아치 연합 초소에서 턱시도 고양이와 전투하고, 짖기 스킬 해금과 World 2 진입 조건을 연결해 World 1을 독립적으로 완료한다.

## Implementation

### I01. Boss arena and progression

- Related Files:
  - `src/game/data/worlds.ts` :: World 1 boss definition and arena metadata; modify
  - `public/assets/pixel/maps/world-01/world-01-boss.json` :: Tiled boss arena; new
  - `src/game/data/cutscenes/worlds.ts` :: World 1 boss intro/clear; modify
  - `src/game/assets/assetManifest.json` :: boss map and outpost props; modify

#### Details

- 보스 맵은 `1920×720`, checkpoint 0개, 진입·전투·마무리 object layer를 사용한다.
- 왕갈비뼈는 arena 배경 또는 연출 object로만 보이고 상호작용·사용·획득 대상이 되지 않는다.
- 턱시도 보스는 기존 `world-01-boss`와 `rewardSkill: bark` 계약을 유지하고, 초소의 대문·담벼락·고양이 경보를 전투 패턴의 배경 요소로 사용한다.
- 보스 클리어 후 `bark`를 해금하고 World 2 stage 1로 이동할 수 있지만, P02 포인터는 T06 수동 승인 전 자동 실행하지 않는다.

### I02. World completion record

- Related Files:
  - `src/game/progression/*` :: clear state and unlocked skill; modify only required symbols
  - `src/game/scenes/StageScene.ts` :: world completion transition; modify
  - `.memory/current.md` :: advance to P02 only after user approval; modify

#### Details

- 일반 4개·보스 1개가 모두 cleared 상태여야 World 1 complete를 기록한다.
- 죽음 카운트, banked coin, unlocked skill, seen cutscene은 기존 persistence event를 사용한다.
- 사용자가 World 1 맵을 확인하지 않은 상태에서 P02의 실제 에셋·맵 Task를 실행하지 않는다.

## Acceptance Criteria

- [ ] World 1 일반 4개와 보스 스테이지가 순서대로 진입한다.
- [ ] 왕갈비뼈는 보스전에서 보이기만 하고 사용되지 않는다.
- [ ] 턱시도 보스 클리어 후 짖기 스킬이 해금된다.
- [ ] World 1 완료 전에는 P02가 시작되지 않는다.

## Validation

- `npm.cmd run lint`
- `npm.cmd run build`
- World 1 stage 4 → boss → clear flow 수동 확인
- 보스 arena의 왕갈비뼈가 상호작용 collider를 만들지 않는지 확인

## Commit Message

```text
feat(world): 월드1 턱시도 보스와 완료 게이트 연결

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P01-world01-back-alley
Task: T06-world01-boss-and-completion

- Add World 1 outpost boss arena and bark unlock flow
- Gate the next world behind World 1 completion and review
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
