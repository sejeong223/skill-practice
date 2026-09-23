# Task: T01 World 3 뒷산 기믹 설계

## Status: pending

## Goal

World 2 완료 후 사용자와 뒷산의 오르막·굴목·바람·낙석·나뭇가지 사물 억까를 확정하고 최소 30개의 월드3 기믹 카탈로그를 만든다.

## Implementation

- Related Files:
  - `.memory/decisions/2026-09-23-world03-mountain.md` :: user-approved design; new after grill-me
  - `src/game/data/world03Gimmicks.ts` :: `WORLD03_GIMMICKS`; new
  - `src/game/data/worldMaps.ts` :: World 3 theme/section metadata; modify

#### Details

- `grill-me`로 단일 루트, 수직 상승 비율, 낙석·바람·굴목·뼈 냄새 미끼의 trigger와 counterplay를 확정한다.
- 땅 꺼짐·땅 솟음·백색 가시·점프 출현 계열은 월드3에서도 각 4개 이상 반복하되 뒷산 사물 variant와 결합한다.
- 카탈로그 30개 이상, safe section 0개, hintPolicy none, 명시적 counterplay를 보장한다.

## Acceptance Criteria

- [ ] 사용자 결정 문서와 30개 이상 catalog가 생성된다.
- [ ] 공통 runtime 확장 필요 여부가 결정된다.

## Validation

- catalog and section diagnostics
- user route review

## Commit Message

```text
feat(map): 월드3 뒷산 기믹 설계 확정

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P03-world03-mountain
Task: T01-world03-design

- Define mountain gimmicks and counterplay after review
- Record World 3 route and mechanic decisions
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
