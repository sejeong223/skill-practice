# Task: T03 World 5 최종 보스와 완료 게이트

## Status: pending

## Goal

캣타워 공성전의 최종 우두머리 보스 아레나, 왕갈비뼈 회수 연출, 주인 엔딩과 `TO BE CONTINUED...?` 크레딧을 연결한다.

> [월드 1 최신 결정](../../../decisions/2026-09-29-world01-daylight-calico.md) D05 적용: 최종 보스는 키가 큰 은회색 `우두머리` 고양이다. 다른 네 보스와 구별되는 새 PNG와 고유 공격 패턴을 이 Task에 포함한다.

## Implementation

- Related Files:
  - `public/assets/pixel/maps/world-05/world-05-boss.json` :: new
  - `src/game/data/worlds.ts` :: final boss metadata; modify
  - `src/game/data/cutscenes/ending.ts` :: final ending and credits; modify
  - `src/game/scenes/EndingScene.ts` :: ending sequence; modify if present
  - `src/game/data/validateMaps.ts` :: final boss validation; modify

#### Details

- 최종 보스는 전체 고양이 패거리의 우두머리이며 checkpoint 0개인 1920px arena를 사용한다.
- 최종 보스전의 왕갈비뼈는 sprite/decoration으로만 표시하고, 스킬·도구·공격 대상으로 사용하지 않는다.
- 클리어 후 코기가 갈비뼈를 물고 집으로 돌아오며 주인이 머리를 쓰다듬은 뒤 갈비뼈를 베란다 밖으로 던지고 `물어와!!!!`라고 말한다. 코기가 창밖으로 다시 뛰는 close-up 후 `TO BE CONTINUED...?`와 엔딩 크레딧을 표시한다.

## Acceptance Criteria

- [ ] 최종 우두머리 보스전이 완료된다.
- [ ] 왕갈비뼈 display-only 규칙이 지켜진다.
- [ ] 엔딩 대사·카메라·크레딧·마지막 추격 이미지가 순서대로 실행된다.

## Validation

- `npm.cmd run lint`
- `npm.cmd run build`
- World 5 boss → ending full flow manual test
- rib object에 collider/input handler가 없는지 확인

## Commit Message

```text
feat(ending): 최종 우두머리와 왕갈비뼈 엔딩 연결

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P05-world05-cat-tower-siege
Task: T03-world05-final-boss-and-completion

- Add the final leader boss and display-only rib arena prop
- Implement the owner throw ending and credits sequence
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
