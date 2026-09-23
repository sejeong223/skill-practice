# Task: T03 최종 릴리스 검토

## Status: pending

## Goal

월드1~5의 사용자 점검 기록과 전체 엔딩 플레이테스트를 바탕으로 릴리스 기준을 확인하고, 최종 커밋 가능한 캠페인 상태를 확정한다.

## Implementation

- Related Files:
  - `.memory/test-plans/2026-09-23-world-review.md` :: five-world sign-off checklist; new
  - `.memory/plans/2026-09-23-legendary-rib-world-campaign.md` :: Definition of Done; modify
  - `.memory/current.md` :: final completed pointer; modify

#### Details

- 각 월드의 30개 이상 기믹·보스·사용자 확인 여부를 체크한다.
- 시작 컷신, 월드별 대화/짧은 연출, 최종 주인 엔딩, credits와 `TO BE CONTINUED...?`까지 누락 없이 재생한다.
- 기본 키와 사용자 변경 키 모두에서 방향키/WASD/Space 및 설정된 jump 입력이 동작하는지 확인한다.
- 릴리스 전에는 자동 검증, lint, build, production debug-off, death count, checkpoint/coin contract를 모두 통과해야 한다.

## Acceptance Criteria

- [ ] 사용자가 5개 월드와 최종 엔딩을 확인했다.
- [ ] 릴리스 체크리스트의 미해결 항목이 없다.
- [ ] 계획의 Definition of Done이 모두 체크된다.

## Validation

- `npm.cmd run lint`
- `npm.cmd run build`
- five-world full campaign manual test
- final browser production build smoke test

## Commit Message

```text
chore(release): 전설의 왕갈비뼈 캠페인 최종 검토

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P06-campaign-release
Task: T03-final-release-review

- Record five-world sign-off and final ending verification
- Close the campaign plan after release checks pass
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
