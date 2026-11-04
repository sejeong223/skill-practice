# Phase: P02 로그인·이어하기·게임 화면 연결

- Status: in_progress
- Plan: [전체 계획](../../../plans/2026-11-04-entra-login-cloud-save-leaderboard.md)
- Prerequisite: P01-cloud-api 전체 완료.

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done` | MSAL 로그인과 계정 진입 게이트 | [T01-auth-gate](./T01-auth-gate.md) |
| T02 | `in_progress` | 계정 캐시와 순차 저장·복구 클라이언트 | [T02-save-client](./T02-save-client.md) |
| T03 | `pending` | 전 월드 체크포인트 스냅샷과 재개 경로 | [T03-resume-bridge](./T03-resume-bridge.md) |
| T04 | `pending` | 자동 저장·세션·일시정지·초기화 통합 | [T04-cloud-game](./T04-cloud-game.md) |
| T05 | `pending` | 랭킹 메뉴와 접근 가능한 TOP 10 대화상자 | [T05-ranking-ui](./T05-ranking-ui.md) |

## Progress

- done: 1/5 (active: T02)
- 구현·검증 결과는 각 Task의 Progress에만 기록한다.
- 순서대로 Task 한 개씩 검증·선별 커밋하고 phase.md와 current.md를 갱신한다.

