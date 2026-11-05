# Plan: Static Web Apps Standard 배포 재개

- Date: 2026-11-05
- Status: ready
- Decisions: [Standard 전환·로컬 준비 우선](../decisions/2026-11-05-azure-standard-release-replan.md)
- Task count: 6 (한 Phase)
- Prerequisite: [심각·높음 보안 수정](./2026-11-05-dependency-security-fix.md) 1개 Task 완료 후 이 계획 T01부터 재개한다. 배포 Task 수는6개로 유지한다.
- Previous work: [이전 계획](./2026-11-04-entra-login-cloud-save-leaderboard.md)의 완료 P01/P02 10개 Task와 생성된 Entra/DB를 재사용한다. 미완료 P03 4개 Task는 이 계획으로 대체하며 완료로 처리하지 않는다.

## Goal

`legendary-rib-corgi`를 Azure Static Web Apps Standard에 정적 프런트와 관리형 Functions API로 배포한다. 로컬 패키징·설정 검사·수동 workflow 준비를 모두 끝낸 뒤 유료 SWA를 생성한다. 실제 URL, 배포 소스 SHA, 로그인·저장·이어하기·TOP10 검증 증거까지 확보해야 완료다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01-standard-release | `in_progress` | 보안 수정 완료 후 로컬 준비 → Standard 리소스 → 수동 배포 → 실제 검증 | [P01](../phases/2026-11-05-azure-standard-release/P01-standard-release/phase.md) |

## Task Order and Boundaries

| 순서 | 결과 | 외부 쓰기 | 기존 청사진에서 가져올 책임 |
| --- | --- | --- | --- |
| T01-static-package | Next 정적 산출물·독립 API·preflight/production 빌드 구분 | 없음 | 이전 P03-T02 |
| T02-standard-tooling | Standard 생성/검증 도구·기존 리소스 재사용·대역 테스트 | 없음 | 이전 P03-T01 준비 코드 |
| T03-manual-workflow | 로컬 수동 배포 YAML·소스 SHA/공개 설정 검사 | 없음 | 이전 P03-T03 코드 작성 부분 |
| T04-standard-resources | 실제 Standard 앱·URI·서버 설정·기존 리소스 보존 확인 | 게임 SWA 및 기존 게임 앱 공개 설정만 | 이전 P03-T01 미완료 외부 작업 |
| T05-production-deploy | workflow 기본 브랜치 등록·최종 빌드·실제 수동 배포 | 명시된 저장소와 게임 SWA | 이전 P03-T03 실행 부분 |
| T06-release-validation | 실제 HTTP·제한된 DB 신원·사용자 로그인/기기 전환 증거 | 격리된 테스트 문서만 | 이전 P03-T04 |

모두 하나의 배포 작업이므로 Phase는 나누지 않는다. Task는 독립적으로 검증·커밋 가능한 산출물과 외부 실행 경계로 나눈다. T01~T03이 끝나기 전에 유료 SWA를 생성하지 않는다. T04는 T01~T03의 완료 기록과 커밋을 확인해야 한다.

2026-11-05 추가 요청으로 별도 보안 계획을 선행 연결했다. 보안1/1 완료 → 이 계획 T01~T06 순서이며, 새 Next 버전에서 정적 빌드를 준비한다. T03 수동 workflow는 root 전체 의존성의 `npm audit --audit-level=high` 성공을 요구한다. 보통 경고는 기록하되 이 검사에서 실패 기준으로 삼지 않는다.

## Reused Target and Evidence

- subscription `b7af62a9-9a10-4deb-95fa-1690f7bbd33d`; tenant `69c1e470-4528-435a-a1ae-de98e0aac738`; RG `grill-me-edu`.
- SWA `legendary-rib-corgi`, **Standard**, `eastasia` 우선(실행 시 지원 재확인). 새 앱1개. 다른 사람의 SWA/구독을 대체 대상으로 사용하지 않는다.
- web client `e467e8bc-c900-4d08-88be-7f0a5fce2474`; API client `a2e3f4fa-56e5-4ab5-ba41-43cb974b8722`; API SP object `f02b1a27-859d-4872-8549-99ad95927132`; scope GUID `d36060b6-6582-45d3-a95f-5b1b8b742883`.
- 기존 Cosmos `maze-rescue-ms-b7af62a9`, DB `legendary-rib-corgi`, container `game-data`, `/playerId`, 전용 manual400RU/s, TTL -1, DB 공유 처리량 없음. Cosmos `enableFreeTier=true`와 SWA Standard는 별개다.
- 2026-11-04 실제 확인값: 기존 DB7개/3400RU, 게임400RU 추가, Free SWA10개/Standard2개. 이번 계획에서 Azure 상태를 재조회한 값은 아니다.
- 로컬 `.git/azure-game-resources.json`, `.git/azure-game-apps.json` 생성 증거와 [이전 T01 Progress](../phases/2026-11-04-entra-login-cloud-save-leaderboard/P03-azure-release/T01-resource-setup.md#progress)를 보존한다. 오래된 증거의 plan ID를 새 계획명으로 무작정 덮어쓰지 않는다.

## Implementation Rules

- Next 설치본 문서를 따라 `output: export`, `trailingSlash: true`, 이미지 unoptimized, `out/`를 사용한다. 관리형 API는 Node22, `build/game-api/` 독립 패키지. `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`를 다시 확인한 뒤 구현한다.
- 로컬 검증은 `preflight`, 실제 배포는 `production`으로 명시한다. 테스트용 URL/dirty 작업 트리의 산출물을 운영 산출물로 취급하지 않는다. production은 실제 SWA origin과 확정 커밋으로 다시 빌드한다.
- 공식 Standard 환경당500MB/파일15000개를 보수적 십진수 `500000000` bytes와 `15000`으로 검사한다. 전체 환경 한도2GB, 기본 운영 환경1개만 사용. 이전250MiB 기준은 제거한다.
- `/auth/redirect/`는 MSAL5 토큰 갱신용으로 실제 정적 파일이 필요하며 no-store/COOP 없음. `/api`를 index.html로 바꾸는 전역 fallback이나 플랫폼 authenticated 역할을 도입하지 않는다.
- API·브라우저용 공개 환경 변수와 비밀을 분리한다. 비밀은 사용자 직접 환경 입력, 채팅/로그/Git/프런트 빌드에 포함하지 않는다.
- 모든 실제 Azure 호출은 고정 구독/tenant를 검증한다. 공용 계정 키·계정 설정 변경·처리량 증가·다른 DB 문서 조회·타인 앱 삭제·유료 부가 기능 추가 금지.
- computer-use/자동 브라우저 조작 금지. CLI/HTTP 자동 검사와 사용자 수동 로그인·기기 검증을 구분한다.
- 자동 테스트는 `scripts/` 바로 아래. 결과는 Task Progress. 별도 테스트 폴더나 `.memory/test-plans`를 생성하지 않는다.
- Windows에서는 `npm.cmd`, `npx.cmd`; PowerShell은 해당 프로세스에만 `-ExecutionPolicy Bypass`. 배포 CI는 Ubuntu/Node22. 시스템 Node가 다르면 `npx.cmd --yes --package=node@22 -- <명령>`으로 Node22 PATH를 제공하고 버전을 확인한다.
- 완료된 Task마다 청사진의 한국어 메시지로 커밋하고 다음 포인터로 이동한다. 미커밋 게임/아트 변경과 이전 준비 코드를 구분하며 관련 hunk만 선별한다. 외부 검증 미완료는 done이 아니다.

## Scope Exclusions Confirmed by User

- 최초에는 의존성 보안 경고와 월드3 인트로 모두 후속 작업이었으나, 2026-11-05 추가 요청으로 **심각·높음4개 패키지 수정 계획**을 선행 연결했다. [최신 결정](../decisions/2026-11-05-dependency-security-fix.md)이 이 범위의 이전 보류 결정을 대체한다.
- 사용자는 보통8개를 별도 후속으로 확정했다. 월드3 인트로도 계속 범위 밖이다. 보안 수정은 별도 Plan1개 Task이며 이 배포 Plan에 중복 집계하지 않는다.
- 현재는 두 계획의 문서 작성만 완료했다. 보안 패키지 설치/변경이나 배포를 실행한 것으로 해석하지 않는다.
- 로그인·저장·랭킹 재구현, 전체 서버 물리 검증, 다른 게임 DB 정비, App Service/별도 Functions 앱/새 사용자 지정 인증 체계는 범위 밖이다.

## 보안 참고 기록 — 2026-11-05 읽기 전용 재확인

- 설명 요청에 따라 root `npm.cmd audit --json`을 실행했다. 패키지 경고12개: critical1/high3/moderate8/info0/low0. 이는 취약점 공지12개나 실제 침해12건이라는 뜻이 아니며, 하나의 라이브러리 취약점이 여러 의존 패키지 경고로 전파되기도 한다. 이전20개 결과는 당시 기록으로 보존한다.
- critical 패키지는 직접 의존성 `next@16.3.5`. audit에는 next/og ImageResponse, SVG 이미지 최적화, 특정 use cache 함수 등 여러 공지가 포함된다. npm이 제시한 Next 수정 후보는16.4.5이나 이번에는 설치/변경하지 않았다.
- [제작사 use cache 보안 공지](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr)는 App Router의 Cache Components와 여러 typed array를 반환하는 use cache 함수에서 원격 코드 실행 가능성을 설명하며16.4.1에서수정됐다고명시한다. 현재 src/next.config.ts 검색에서 use cache/cacheComponents 사용은 없었으나 제작사는 해당기능미사용시에도업데이트를권고한다. 정적배포계획만으로모든경고가해소됐다고단정하지않는다.
- high 패키지는 sharp, source-map-js, zod; moderate에는 minimatch와이를경유하는ESLint/TypeScript도구들이포함된다. 설치된직접/간접의존성과사용경로에따라실제노출이다르므로경고수만으로영향을판정하지않는다. dev서버·빌드도구경고도운영정적파일과구분한별도점검대상이다.
- `npm audit fix --force` 같은 자동변경은 수행하지 않았다. 이후 사용자 요청으로 [보안 수정 청사진](../phases/2026-11-05-dependency-security-fix/P01-security/T01-dependency-patches.md)을 추가했다. 보통 경고에 대한 eslint-config-next15.5.29 하향 제안은 적용하지 않는다. 배포 기능 검증 통과가 보안 패치 완료를 뜻하지 않는다.

## Completion Criteria

- 선행 보안 계획1/1 완료 및 기록 확인. 이 계획의6개 Task와 중복 집계하지 않는다.
- 6개 Task 완료, 실제 Standard URL과 성공 workflow run/source SHA 기록.
- 실제 조직 로그인·계정별 저장·재개·세션 전환·랭킹·초기화/최고 기록 보존의 필수 확인 결과 기록.
- 보호 대상 보존, 테스트 데이터만 정리, 비밀 노출 없음. 못한 수동 확인은 미확인으로 남기며 완료를 주장하지 않는다.
- 기존 완료10개 Task를 새6개에 중복 집계하지 않는다. 구 계획 P03은 superseded로 보존한다.

## References

- [SWA 한도](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas), [런타임·라우팅 설정](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration).
- [사전 빌드 배포](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration), [관리형 Functions 제약](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions).
- [GitHub 수동 workflow의 기본 브랜치 요건](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).


## Latest Execution

- 선행 보안 계획1/1 완료(`2aa6cbc`, 2026-11-05). root audit critical0/high0/moderate8 및 Node22 검증 통과.
- 배포1/6: T01 완료. 정적284개/64,626,462bytes, API7개 경로 독립 로드, 경계 테스트13개·린트·타입·실제 로컬 HTTP 검사 통과. 현재 T02 Standard 도구 검증 단계이며 Azure/GitHub 쓰기는 아직 없다.
