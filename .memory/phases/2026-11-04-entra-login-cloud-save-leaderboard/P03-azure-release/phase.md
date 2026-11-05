# Phase: P03 Azure 리소스·정적 배포·통합 검증

- Status: superseded (2026-11-05 Standard 재계획)
- Plan: [전체 계획](../../../plans/2026-11-04-entra-login-cloud-save-leaderboard.md)
- Prerequisite: P02-game-integration 전체 완료.

> 아래 미완료 Task는 실행하지 않는다. [새 Standard P01](../../2026-11-05-azure-standard-release/P01-standard-release/phase.md)에서 로컬 준비 우선 순서로 재계획했다. 과거 Progress는 보존하며 완료로 계산하지 않는다.

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `superseded` | 준비 코드→새T02, 실제설정→새T04 | [T01-resource-setup](./T01-resource-setup.md) |
| T02 | `superseded` | 새T01 정적 패키지로 대체 | [T02-static-package](./T02-static-package.md) |
| T03 | `superseded` | 로컬workflow→새T03, 실제배포→새T05 | [T03-manual-deploy](./T03-manual-deploy.md) |
| T04 | `superseded` | 새T06 실제 검증으로 대체 | [T04-release-validation](./T04-release-validation.md) |

## Progress

- done: 0/4 (active: 없음, remaining work superseded)
- 완료가 아니라 대체된 계획이다. 실행 포인터는 새 Standard 계획 T01을 가리킨다.
- 구현·검증 결과는 각 Task의 Progress에만 기록한다.
- 순서대로 Task 한 개씩 검증·선별 커밋하고 phase.md와 current.md를 갱신한다.

