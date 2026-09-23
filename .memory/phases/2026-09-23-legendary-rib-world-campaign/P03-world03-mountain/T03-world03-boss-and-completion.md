# Task: T03 World 3 보스와 완료 게이트

## Status: pending

## Goal

뒷산 정상 보스 아레나와 dash skill 해금, World 4 진입 조건을 연결한다.

## Implementation

- Related Files:
  - `public/assets/pixel/maps/world-03/world-03-boss.json` :: new
  - `src/game/data/worlds.ts` :: World 3 boss metadata; modify
  - `src/game/data/cutscenes/worlds.ts` :: transition; modify
  - `src/game/data/validateMaps.ts` :: boss validation; modify

#### Details

- 보스 맵은 1920px·checkpoint 0개이며 왕갈비뼈는 장식으로만 보인다.
- dash는 보스 클리어 후 해금하고 맵 통과 필수 조건으로 만들지 않는다.
- 사용자 World 3 확인 전 P04를 시작하지 않는다.

## Acceptance Criteria

- [ ] World 3 full flow와 dash unlock이 동작한다.
- [ ] 보스·맵·기믹 validation errors가 0이다.

## Validation

- `npm.cmd run lint`
- `npm.cmd run build`
- World 3 full flow manual test

## Commit Message

```text
feat(world): 월드3 뒷산 보스와 완료 흐름 연결

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P03-world03-mountain
Task: T03-world03-boss-and-completion

- Add the mountain boss arena and dash unlock
- Gate World 4 behind reviewed World 3 completion
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
