# Task: T01 캠페인 진행 상태 통합

## Status: pending

## Goal

월드1부터 월드5까지의 stage unlock, 보스 보상 스킬, 월드 간 banked coin, 도구 구매 제한, 사망 카운트와 cutscene 상태를 하나의 캠페인 흐름으로 통합한다.

## Implementation

- Related Files:
  - `src/game/progression/*` :: progression state and unlock handlers; modify
  - `src/game/data/worlds.ts` :: stage/world order; verify/modify
  - `src/game/scenes/*` :: world transitions; modify required symbols only
  - `src/game/components/*` :: status/death display; modify if required

#### Details

- 사망 시 현재 stage coin만 0이 되고 다음 stage로 이월된 banked coin은 유지한다.
- 스킬은 각 보스 클리어 후 순서대로 `bark → bite → dash → double-jump → tail-rotor`로 해금한다.
- 도구는 기존 shop/price/world restriction을 유지하고 맵 기믹 파훼에는 필요하지 않다.
- 각 world 완료는 일반 4개와 boss 1개 clear 및 해당 사용자 review gate를 모두 만족해야 한다.

## Acceptance Criteria

- [ ] 25개 stage와 5개 boss가 잠금·해금 순서대로 진행된다.
- [ ] banked coin/death count/skills/tools/cutscenes가 재시작과 새로고침 후 계약을 유지한다.

## Validation

- `npm.cmd run lint`
- `npm.cmd run build`
- fresh profile과 completed profile 각각의 campaign flow manual test

## Commit Message

```text
feat(progression): 5개 월드 캠페인 진행 상태 통합

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P06-campaign-release
Task: T01-campaign-progression

- Integrate world unlocks, skill rewards, coins, deaths, and cutscenes
- Preserve cross-stage banked currency and equipment restrictions
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
