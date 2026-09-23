# Task: T03 World 2 보스와 완료 게이트

## Status: pending

## Goal

World 2 놀이터 관리실 보스 아레나와 월드 완료·다음 월드 진입을 연결한다.

## Implementation

- Related Files:
  - `public/assets/pixel/maps/world-02/world-02-boss.json` :: new
  - `src/game/data/worlds.ts` :: World 2 boss definition; modify
  - `src/game/data/validateMaps.ts` :: World 2 boss checks; modify
  - `src/game/data/cutscenes/worlds.ts` :: boss transition; modify

#### Details

- 보스 맵은 1920px, checkpoint 0개, 왕갈비뼈는 보이기만 하고 사용하지 않는다.
- 보스 클리어 시 bite skill unlock과 World 2 completion을 기록한다.
- 일반 맵·보스·기믹 report·수동 테스트가 모두 통과한 뒤에만 P03을 시작한다.

## Acceptance Criteria

- [ ] World 2 normal 4개와 boss가 순서대로 완료된다.
- [ ] bite skill이 보스 클리어 후에만 해금된다.
- [ ] P03은 사용자 World 2 확인 후 활성화된다.

## Validation

- `npm.cmd run lint`
- `npm.cmd run build`
- World 2 full flow manual test

## Commit Message

```text
feat(world): 월드2 놀이터 보스와 완료 흐름 연결

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P02-world02-playground
Task: T03-world02-boss-and-completion

- Add World 2 boss arena and bite unlock flow
- Gate World 3 behind reviewed World 2 completion
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
