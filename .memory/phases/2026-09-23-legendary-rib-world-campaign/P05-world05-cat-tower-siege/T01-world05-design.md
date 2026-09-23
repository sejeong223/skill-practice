# Task: T01 World 5 캣타워 공성전 기믹 설계

## Status: pending

## Goal

캣타워 외곽·사료 창고·중층 난간·왕좌 직통 승강로의 단일 루트와 고양이 패거리 최종 구역 억까를 사용자와 확정하고 30개 이상의 catalog를 작성한다.

## Implementation

- Related Files:
  - `.memory/decisions/2026-09-23-world05-cat-tower-siege.md` :: user-approved design; new after grill-me
  - `src/game/data/world05Gimmicks.ts` :: `WORLD05_GIMMICKS`; new
  - `src/game/data/worldMaps.ts` :: World 5 theme/section metadata; modify

#### Details

- `grill-me`로 캣타워 수직 진행, 고양이 패거리 압박, 최종 보스 전 입구, 엔딩 직전 탈출 구간을 확정한다.
- World 5도 30개 이상·no hint·explicit counterplay·safe entry/exit rules를 지킨다.
- 최종 우두머리는 전체 고양이 패거리의 우두머리이며, 보스전에서 왕갈비뼈는 보이기만 하고 사용하지 않는다.

## Acceptance Criteria

- [ ] 사용자 승인 문서와 30개 이상 World 5 catalog가 생성된다.
- [ ] 최종 보스 및 엔딩에 필요한 display-only rib object가 정의된다.

## Validation

- catalog diagnostics
- user final-world review gate

## Commit Message

```text
feat(map): 월드5 캣타워 공성전 기믹 설계 확정

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P05-world05-cat-tower-siege
Task: T01-world05-design

- Define the final tower siege gimmick catalog after review
- Record the leader boss and display-only rib decisions
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
