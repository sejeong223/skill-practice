# Phase: P01 Static Web Apps Standard 배포

- Status: in_progress (T01~T03 완료, T04 시작)
- Plan: [전체 계획](../../../plans/2026-11-05-azure-standard-release.md)
- Prerequisite: 기존 로그인·저장·랭킹 P01/P02 완료10개 Task 재사용 + [보안 수정 T01](../../2026-11-05-dependency-security-fix/P01-security/T01-dependency-patches.md) 완료.

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done` | 로컬 정적 패키지와 빌드 모드 분리 | [T01](./T01-static-package.md) |
| T02 | `done` | Standard 준비 도구와 보존 검사 | [T02](./T02-standard-tooling.md) |
| T03 | `done` | 로컬 GitHub 수동 workflow와 검증 | [T03](./T03-manual-workflow.md) |
| T04 | `in_progress` | 실제 Standard 앱 생성·운영 설정 | [T04](./T04-standard-resources.md) |
| T05 | `pending` | 기본 브랜치 등록·운영 수동 배포 | [T05](./T05-production-deploy.md) |
| T06 | `pending` | 실제 로그인·저장·기기 전환 검증 | [T06](./T06-release-validation.md) |

## Progress

- done: 3/6 (active: T04)
- T01~T03은 로컬 작성/대역 검증만 수행한다. T04부터 승인된 게임 SWA 외부 작업을 수행한다.
- 완료 기록·검증 증거는 각 Task Progress에 남긴다. 구현과 실제 외부 검증을 모두 충족해야 해당 Task를 done 처리한다.
- 구 계획 P03은 이 Phase로 대체하며 과거 실제 리소스 생성 기록은 유지한다.
