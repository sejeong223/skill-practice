# Task: T02 캠페인 회귀와 성능 검증

## Status: pending

## Goal

5개 월드의 20개 일반 맵과 5개 보스 맵이 모두 구조·기믹·seed·카메라·패럴랙스·collision 검증을 통과하고, 많은 기믹이 있어도 프레임과 메모리 사용이 허용 범위 안에 있는지 확인한다.

## Implementation

- Related Files:
  - `src/game/data/validateMaps.ts` :: campaign validation; modify
  - `src/game/debug/MapDebugOverlay.ts` :: performance counters; modify
  - `.memory/test-plans/2026-09-23-campaign-regression.md` :: regression matrix; new
  - `src/game/maps/*` and `src/game/systems/*` :: profiling fixes only when measured; modify if required

#### Details

- 모든 world gimmick count가 30 이상이고 safe section count, true checkpoint, exit, chain reference errors가 0인지 검사한다.
- 동일 stage/seed/attempt trace 두 개가 같은 triggered gimmick sequence와 snapshot state를 만드는지 비교한다.
- foreground는 visual-only, gameplay collision은 gameplay layer/trigger body에만 존재하는지 검사한다.
- 개발 오버레이로 active entity 수, pending chain 수, camera scroll, player screen x를 기록하고 production에서는 제거되는지 확인한다.

## Acceptance Criteria

- [ ] `validateCampaignMaps` 25개 report의 errors가 0이다.
- [ ] 동일 seed 재현성이 25개 stage와 5개 boss에 대해 통과한다.
- [ ] 기믹이 없는 safe entry/exit와 기믹 밀집 section의 성능 차이를 기록한다.

## Validation

- `npm.cmd run lint`
- `npm.cmd run build`
- campaign validation diagnostic
- production build에서 debug overlay/diagnostic이 표시되지 않는지 확인

## Commit Message

```text
test(campaign): 전체 월드 맵 회귀와 성능 검증 추가

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P06-campaign-release
Task: T02-campaign-regression

- Validate all campaign maps, seed replay, and collision separation
- Record dense-gimmick performance and production debug behavior
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
