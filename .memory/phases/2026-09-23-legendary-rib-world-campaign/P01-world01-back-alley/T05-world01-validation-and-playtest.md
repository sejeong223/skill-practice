# Task: T05 World 1 검증과 수동 플레이테스트

## Status: pending

## Goal

World 1 일반 4개 맵이 최소 기믹 수량, 무힌트 정책, 안전 구간, 단일 루트, checkpoint·exit 위치, chain 참조를 만족하는지 자동 검증하고, 사람이 실제로 순서대로 플레이해 사망·재시작·파훼 가능성을 확인한다.

## Implementation

### I01. World gimmick validator

- Related Files:
  - `src/game/data/validateMaps.ts` :: `validateStageMap`, `validateCampaignMaps`; modify
  - `src/game/data/validateContent.ts` :: World gimmick registry integration; modify
  - `src/game/debug/MapDebugOverlay.ts` :: gimmick id/last outcome display; modify

#### Details

- validator는 worldId별 `gimmicks.length >= 30`을 검사하고 World 1은 `>=54`와 계열별 최소 수량을 검사한다.
- `sectionIndex`가 1 또는 5인 gimmick, `hintPolicy !== "none"`, `lethal !== true`, missing counterplay/outcome, missing objectId, missing chain target은 오류다.
- `forward-jump-wall`의 counterplay가 `move-backward`, `ground-collapse`가 `jump-before-zone`, `ground-rise`가 `micro-forward-then-back`, name bubble이 `mash-jump + requiredPresses:100`인지 검사한다.
- safe-entry/safe-exit의 lethal trap, forced movement, blocking chain은 기존 validator와 함께 오류로 보고한다.
- 개발 오버레이에는 `gimmickId`, trigger 상태, counterpresses, last outcome을 표시하되 production에는 생성하지 않는다.

### I02. 수동 플레이테스트 체크리스트

- Related Files:
  - `.memory/test-plans/2026-09-23-world01-playtest.md` :: test matrix and evidence; new
  - `.memory/phases/2026-09-23-legendary-rib-world-campaign/P01-world01-back-alley/phase.md` :: completion evidence; modify

#### Details

- 각 stage에서 section 1 진입과 section 5 탈출이 즉사 없이 가능한지 확인한다.
- 최소 한 번씩 다음의 실패·성공 쌍을 기록한다: forward walk vs backward start, forward jump vs backward movement, walk into collapse vs pre-jump, rise timer timing, fake coin avoid, true checkpoint vs fake checkpoint, box jump-retreat, cloud retreat, white spike precision, no-jump pigeon, Space 99/100 mash.
- 모든 사망은 즉시 재시작되며, checkpoint 이전의 stage coins는 0, banked coins는 유지, 기믹 snapshot과 death count는 결정된 계약을 따른다.
- 같은 seed로 재시작한 두 시도의 trigger 좌표·연쇄 순서·death outcome이 같아야 한다.
- 단일 메인 루트에서 실제로 갈림길이나 지름길이 생기지 않았는지 화면 녹화 또는 스크린샷으로 확인한다.

## Acceptance Criteria

- [ ] World 1 일반 4개 report의 errors가 0이다.
- [ ] World 1 기믹 수량과 계열별 반복 횟수가 계획을 충족한다.
- [ ] 자동 검증으로 잡히지 않는 조작감·충돌 겹침·전경 가림을 수동 확인했다.
- [ ] 수동 테스트 결과가 `.memory/test-plans/2026-09-23-world01-playtest.md`에 기록됐다.

## Validation

- `npm.cmd run lint`
- `npm.cmd run build`
- `node` 또는 앱 내 diagnostic으로 `validateCampaignMaps(CONTENT_REGISTRY)` 실행
- `npm.cmd run dev` 후 World 1 stage 1→4 순서 플레이테스트

## Commit Message

```text
test(map): 월드1 억까 검증과 플레이테스트 기준 추가

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P01-world01-back-alley
Task: T05-world01-validation-and-playtest

- Validate gimmick counts, hidden-hint rules, and safe sections
- Record World 1 manual counterplay and checkpoint regression tests
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
