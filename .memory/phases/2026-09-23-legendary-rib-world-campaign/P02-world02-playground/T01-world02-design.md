# Task: T01 World 2 놀이터 기믹 설계

## Status: pending

## Goal

World 1 완료 후 사용자와 놀이터의 메인 루트·강제 수직 구간·사물별 억까를 확정하고, `WorldGimmickDefinition`으로 최소 30개의 기믹과 각 기믹의 파훼 조건을 등록한다.

## Implementation

### I01. 설계 승인과 카탈로그

- Related Files:
  - `.memory/decisions/2026-09-23-world02-playground.md` :: confirmed map decisions; new after user review
  - `src/game/data/world02Gimmicks.ts` :: `WORLD02_GIMMICKS`; new
  - `src/game/data/worldMaps.ts` :: World 2 theme/section metadata; modify

#### Details

- 구현 전에 `grill-me`로 놀이터 루트, 수직 구간, 즉사 신호 정책, 핵심 사물, 보스 전조를 한 질문씩 확정한다.
- stage titles는 `안전하지 않은 놀이터`, `미끄럼틀 낙하 구역`, `그네 줄타기 골목`, `정글짐 냥아치 통로`를 유지한다.
- 카탈로그는 그네·미끄럼틀·시소·정글짐·모래구덩이·공·철봉 등 월드2 고유 사물을 최소 30개 서로 다른 trigger/variant로 등록한다.
- 월드1의 공통 13종을 그대로 복사하지 않고, 땅 꺼짐·땅 솟음·백색 가시·점프 출현 계열을 반복하되 놀이터 사물과 결합한다.

## Acceptance Criteria

- [ ] 사용자 승인 결정 문서가 생성된다.
- [ ] World 2 기믹이 30개 이상이고 각 항목에 counterplay/outcome이 있다.
- [ ] P01 runtime으로 표현할 수 없는 새 동작은 구현 전에 공통 계약 변경 대상으로 기록한다.

## Validation

- catalog count 및 section 2~4 제한 진단
- 사용자 맵 디자인 확인 완료 표시

## Commit Message

```text
feat(map): 월드2 놀이터 기믹 설계 확정

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P02-world02-playground
Task: T01-world02-design

- Define World 2 playground gimmick catalog after review
- Record route, counterplay, and new mechanic decisions
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
