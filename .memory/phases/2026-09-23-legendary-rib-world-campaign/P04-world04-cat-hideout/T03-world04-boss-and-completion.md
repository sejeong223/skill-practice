# Task: T03 World 4 보스와 완료 게이트

## Status: pending

## Goal

냥아치 아지트 간부실 보스와 double-jump skill 해금, World 5 진입 조건을 연결한다.

> [월드 1 최신 결정](../../../decisions/2026-09-29-world01-daylight-calico.md) D05 적용: 이 보스는 길쭉한 검은 고양이 `번개`다. 다른 월드와 구별되는 새 PNG와 고유 공격 패턴을 이 Task에 포함한다.

## Implementation

- Related Files:
  - `public/assets/pixel/maps/world-04/world-04-boss.json` :: new
  - `src/game/data/worlds.ts` :: World 4 boss metadata; modify
  - `src/game/data/cutscenes/worlds.ts` :: transition; modify
  - `src/game/data/validateMaps.ts` :: boss validation; modify

#### Details

- 1920px boss arena, checkpoint 0개, 왕갈비뼈는 배경에만 표시한다.
- double-jump는 보스 보상이며 맵의 필수 이동 조건이 아니다.
- P05는 World 4 완료와 사용자 맵 확인 뒤에만 활성화한다.

## Acceptance Criteria

- [ ] World 4 full flow와 double-jump unlock이 동작한다.
- [ ] 보스와 월드 검증 errors가 0이다.

## Validation

- `npm.cmd run lint`
- `npm.cmd run build`
- World 4 full flow manual test

## Commit Message

```text
feat(world): 월드4 냥아치 아지트 보스와 완료 흐름 연결

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P04-world04-cat-hideout
Task: T03-world04-boss-and-completion

- Add the hideout boss arena and double-jump unlock
- Gate the final world behind reviewed World 4 completion
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
