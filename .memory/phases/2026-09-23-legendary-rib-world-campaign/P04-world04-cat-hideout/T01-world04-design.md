# Task: T01 World 4 냥아치 아지트 기믹 설계

## Status: pending

## Goal

버려진 고물상과 냥아치 아지트의 단일 진행 루트, 고철·압축기·경보·고양이 상자·대문·유기견 군중 억까를 사용자와 확정하고 30개 이상의 catalog를 작성한다.

## Implementation

- Related Files:
  - `.memory/decisions/2026-09-23-world04-cat-hideout.md` :: user-approved design; new after grill-me
  - `src/game/data/world04Gimmicks.ts` :: `WORLD04_GIMMICKS`; new
  - `src/game/data/worldMaps.ts` :: World 4 theme/section metadata; modify

#### Details

- `grill-me`로 고물상 압축·경보·유기견 NPC가 플레이어 퇴로를 막는 타이밍과 파훼 입력을 한 번에 하나씩 확정한다.
- world-specific catalog 30개 이상, section 2~4 only, no hint, explicit counterplay를 유지한다.
- World 1의 fake checkpoint와 fake reward semantics는 재사용하되 visual context와 chain ordering은 달라야 한다.

## Acceptance Criteria

- [ ] 사용자 승인 문서와 30개 이상 World 4 catalog가 있다.
- [ ] 공통 runtime으로 처리할 부분과 새 typed kind가 필요한 부분이 분리된다.

## Validation

- catalog diagnostics
- user review gate

## Commit Message

```text
feat(map): 월드4 냥아치 아지트 기믹 설계 확정

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P04-world04-cat-hideout
Task: T01-world04-design

- Define junkyard hideout gimmicks after review
- Record enemy crowd and alarm counterplay decisions
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
