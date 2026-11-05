# Plan: 심각·높음 의존성 보안 경고 수정

- Date: 2026-11-05
- Status: complete
- Decisions: [수정 범위와 배포 연결](../decisions/2026-11-05-dependency-security-fix.md)
- Task count: 1 (한 Phase)
- Next plan: [Static Web Apps Standard 배포 재개](./2026-11-05-azure-standard-release.md)

## Goal

Next.js와 간접 의존성의 심각·높음 경고를 제거하고, Node22에서 깨끗한 설치·린트·타입·게임/인증/저장/랭킹·이미지 처리·빌드 검증을 통과한 잠금 파일을 Standard 배포의 입력으로 넘긴다. 현재 root audit 기준은 critical1/high3/moderate8이다. 목표는 critical0/high0이며 보통 경고를 숨기거나 해결됐다고 보고하지 않는다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01-security | `done` | 의존성 갱신·재현 설치·회귀 검증 | [P01](../phases/2026-11-05-dependency-security-fix/P01-security/phase.md) |

## Scope and Version Targets

| 대상 | 현재 | 수정 목표 | 역할 |
| --- | --- | --- | --- |
| next | 16.3.5 | 16.4.5 고정 | 직접 실행/빌드 의존성 |
| eslint-config-next | 16.3.5 | 16.4.5 고정 | Next와 버전을 맞출 개발 도구; 이 패키지 자체의 보통 경고 제거는 목표 아님 |
| sharp | 0.35.4 | 0.35.5 이상, 0.35.x 범위 | Next의 선택적 의존성 및 로컬 이미지 스크립트의 실제 import |
| source-map-js | 1.2.1 | 1.2.2 이상, 1.x 범위 | PostCSS/Tailwind/css-tree의 간접 의존성 |
| zod | 4.6.5 | 4.6.6 이상, 4.x 범위 | eslint-plugin-react-hooks의 개발용 간접 의존성 |

- 실행 시 registry와 audit 결과를 재확인한다. 설치하지 않은 후보를 검증 완료 버전으로 기록하지 않는다.
- 보통8개(minimatch와 ESLint/TypeScript 계열 전파 경고)는 사용자가 별도 후속으로 확정했다. 이번 수정으로 함께 사라진 항목은 실제 결과대로 기록하되, 제거를 위해 하향/major 강제를 하지 않는다.
- API 의존성, 게임 규칙, 월드3 인트로, Azure 리소스는 이 계획에서 변경하지 않는다. 기존 미커밋 게임·아트 작업을 보존한다.

## Execution Order and Handoff

1. [T01](../phases/2026-11-05-dependency-security-fix/P01-security/T01-dependency-patches.md)에서 root 패키지·잠금 파일을 갱신하고 지정 검증을 통과시킨다.
2. Task/Phase/Plan 완료와 한국어 커밋을 기록한 뒤 `.memory/current.md`의 세 활성 링크를 기존 [Standard Plan](./2026-11-05-azure-standard-release.md), [Phase](../phases/2026-11-05-azure-standard-release/P01-standard-release/phase.md), [T01](../phases/2026-11-05-azure-standard-release/P01-standard-release/T01-static-package.md)로 전진시킨다. 배포는 여전히0/6이다.
3. 기존 배포 T01~T03의 로컬 준비를 완료한 뒤 T04 Standard 생성, T05 수동 배포, T06 실제 검증 순서를 따른다. 이 계획은 유료 리소스를 먼저 만들지 않는다.

## Why One Task

Next와 ESLint의 버전 정합성, 중첩 의존성 해결, 같은 root 잠금 파일과 회귀 검증은 하나의 원자적 변경이다. 패키지마다 Task를 나누면 같은 잠금 파일을 반복 변경하고 호환성 검증 전에 부분 완료로 표시하게 된다. 단일 Task에서 기존 테스트를 재사용하고 검증 결과는 Task Progress에 남긴다. 별도 테스트 폴더나 test-plans 문서는 생성하지 않는다.

## Completion Criteria

- clean `npm ci` 후 실제 의존성 트리와 잠금 파일이 일치하고 모든 대상 중첩 사본이 수정 범위에 있다.
- root 전체 의존성의 `npm audit --audit-level=high` 성공, critical0/high0, 남은 보통 경고 기록.
- 지정된 Node22 회귀 검증 성공; 기존 실패가 있으면 전후 비교하고 미해결 실패를 성공으로 기록하지 않음.
- 앱 기능·API 계약·이미지 산출물·타인 변경을 불필요하게 수정하지 않음.
- 실제 구현은 다음 실행 요청부터. 현재 작성한 문서를 보안 패치 완료로 취급하지 않음.

## Sources

- [Next 공식 보안 공지](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr).
- [sharp 공식 보안 공지](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).
- [source-map-js 제작사 수정](https://github.com/7rulnik/source-map-js/pull/79).
- [Zod 제작사 수정](https://github.com/colinhacks/zod/pull/6652).
- 2026-11-05 root package/lock, npm audit/npm view, Next 설치본 upgrading 가이드 확인. 버전표는 확인 시점의 목표이며 향후 모든 취약점 부재를 보증하지 않는다.

## Execution Result

- 2026-11-05 완료1/1. 최종 audit critical0/high0/moderate8, 운영 의존성0. Node22.23.4 clean 설치·159+3개 테스트·린트·타입·빌드 통과. 상세는 T01 Progress.
- Standard 배포 T01로 포인터를 전진했다. 위 계획 당시 기준값과 비교해 결과를 해석한다.
