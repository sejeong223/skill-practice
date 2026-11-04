# Plan: Entra ID 로그인·계정 저장·TOP 10 랭킹·Static Web Apps 배포

- Date: 2026-11-04
- Status: in_progress (계획 준비 완료, 구현 미착수)
- Decisions: [확정 결정](../decisions/2026-11-04-entra-login-cloud-save-leaderboard.md)
- Task count: 14 (P01 5 + P02 5 + P03 4)
- Execution: 아래 순서대로 한 Task씩 구현·검증·커밋하고 current.md를 전진한다.

## Goal

조직 Entra ID 로그인 후 계정별로 게임을 이어서 하고, 진행도 → 달성 당시 데스 수 → 닉네임 가나다순의 역대 최고 기록 TOP 10을 표시한다. 기존 공용 Cosmos DB 계정 안의 게임 전용 DB와 새 Static Web Apps Free로 배포한다. 완료는 코드 작성뿐 아니라 실제 조직 로그인, 다른 PC 이어하기, 수동 배포와 보호 대상 미변경까지 확인한 상태다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01-cloud-api | `done` | 공유 계약·인증·클라우드 API (5 Tasks) | [P01](../phases/2026-11-04-entra-login-cloud-save-leaderboard/P01-cloud-api/phase.md) |
| P02-game-integration | `done` | 로그인·이어하기·게임 화면 연결 (5 Tasks) | [P02](../phases/2026-11-04-entra-login-cloud-save-leaderboard/P02-game-integration/phase.md) |
| P03-azure-release | `in_progress` | Azure 리소스·정적 배포·통합 검증 (4 Tasks) | [P03](../phases/2026-11-04-entra-login-cloud-save-leaderboard/P03-azure-release/phase.md) |

## Execution Order

- P01-cloud-api: T01-contracts → T02-api-auth → T03-account-session → T04-save-reset → T05-leaderboard
- P02-game-integration: T01-auth-gate → T02-save-client → T03-resume-bridge → T04-cloud-game → T05-ranking-ui
- P03-azure-release: T01-resource-setup → T02-static-package → T03-manual-deploy → T04-release-validation
- P01은 테스트 저장소·로컬 서명키로 검증하여 Azure 식별자 발급을 기다리며 구현 전체가 막히지 않게 한다.
- P02는 P01 계약을 그대로 소비하고, 실제 인증이 필요한 수동 확인은 P03에서 완료한다. 테스트 대역의 성공을 실제 Azure 성공으로 보고하지 않는다.
- P03-T01 실제 리소스 준비 → T02 배포 산출물 → T03 수동 배포 → T04 실제 통합 검증. 필요한 사용자 입력이 없으면 해당 Task를 done 처리하지 않는다.

## Architecture and Physical Boundaries

- 웹: Next 16.3.5 정적 export / React 19 / Phaser. `src/game/cloud/`에 브라우저·서버 공용 순수 계약과 진행 매핑, `src/auth/`에 MSAL, `src/game/persistence/cloud/`에 클라이언트.
- API: `api/`의 TypeScript Azure Functions v4 / Node 22. `jose`로 액세스 토큰 검증, `@azure/identity`의 서버 전용 앱 자격 증명, `@azure/cosmos`로 고정 DB 접근. 게임 엔진·DOM을 API에서 import하지 않는다.
- 배포: `next.config.ts`, `public/staticwebapp.config.json`, `.github/workflows/deploy-legendary-rib-corgi.yml`, 기존 `scripts/` 아래 빌드·준비·검증 도구.
- API 서비스 → 게임 런타임 → 외부 리소스라는 물리적 경계 때문에 세 Phase로 나눈다. UI 요소마다 별도 Phase를 만들지 않는다.

## Fixed Product Rules

- 대상 조직의 tenant ID/issuer 검증. 초대 게스트 허용. 이메일 접미사·닉네임을 권한으로 쓰지 않는다.
- 최초 계정은 새 저장. 기존 `legendary-rib-corgi:progress:v1` 보존, 가져오기 없음. 전체 ProgressState v5 + 전 월드 재개 스냅샷.
- 현재 월드 마지막 실제 체크포인트, 없으면 월드 시작에서 재개. 보스 진입은 저장점 아님. 최종 클리어 보존.
- 최고 진행 지점과 그 달성 순간 데스를 한 쌍으로 저장. 초기화는 새 runId, 최고 기록·계정 신원 보존.
- 계정당 활성 writer 하나. 명시적 이어하기 전환 + 세대 번호로 오래된 쓰기 차단. 오류 시 자동 정지, 확인된 저장 이후 재개.
- 개발 월드 4 점프는 로컬 전용. 운영 클라우드 테스트는 별도 test namespace, 정상 월드 1 시작. 새 유료 테스트 DB는 생성하지 않는다.
- 랭킹 필드: 순위, 닉네임, 데스 수, 클리어 위치. 최대 10명. 시간으로 동점 정렬하지 않는다.

## Azure Target and Guardrails

- Subscription: `b7af62a9-9a10-4deb-95fa-1690f7bbd33d`
- Resource group: `grill-me-edu`
- Existing account: `maze-rescue-ms-b7af62a9`, NoSQL, 사용자 확인 Korea Central / provisioned / Free Tier enabled / 총 3400 RU/s / 모든 네트워크.
- New database: `legendary-rib-corgi`; container `game-data`; partition `/playerId`; 컨테이너 전용 수동 400 RU/s. DB 공유 처리량을 추가하지 않는다.
- 다른 사람 DB, 처리량, 계정 상한·지역·방화벽·인증 설정 보존. 동일 이름 충돌은 소유권 확인 전 중단. 다른 구독을 대체 대상으로 쓰지 않는다.
- Entra registrations: `legendary-rib-corgi-web` / `legendary-rib-corgi-api`. 서버 앱 서비스 주체의 Cosmos 데이터 권한은 게임 DB 이하로 한정.
- SWA: `legendary-rib-corgi`, Free, 관리형 API 지원 아시아 지역은 P03에서 확인. App Service·하이브리드 호스팅·관리 ID·공유 Cosmos 마스터 키 사용 없음.
- 처리량 비용은 결정 D18에서 설명한 단일 지역 기준 추정이며 실제 새 DB가 무료라는 보장은 없다. 이 계획은 추가 과금 리소스나 상한 상향을 승인하지 않는다.
- computer-use 금지. Azure 포털/대화형 로그인 확인이 필요하면 사용자에게 정확한 메뉴 경로를 안내한다. 비밀 값은 환경 설정에 직접 입력하고 채팅·문서에 받지 않는다.

## Contract Decisions Made by This Plan

다음 수치는 사용자의 별도 제품 요구가 아니라 확정 요구를 구현하기 위한 기술 기본값이다.
- transport schema 1 / ProgressState 5, UUID runId·sessionId·requestId, 서버 version과 순번.
- lease 60초, heartbeat 15초, 동일 소유자 만료 갱신 가능하되 takeover 이후 불가. 저장마다 session 문서 ETag를 같은 batch에 포함.
- 순차 요청 한 개만 전송, snapshot은 관찰 시 깊은 복사, 구조 이벤트는 debounce로 합치지 않음.
- 요청 256 KiB / progress 192 KiB / checkpoint 48 KiB 상한, receipt 7일 TTL, 1·2·4·8·15초 재시도와 Retry-After 존중.
- 실제 테스트 계정은 서버 allowlist로 `test:` partition namespace에 배정. 클라이언트가 prod/test 또는 playerId를 선택하지 못한다.
- 공통 계약의 상세 필드·오류·진행 규칙은 P01-T01에 정의하고 각 소비 Task에 필요한 계약을 반복 명시한다.

## Verification and Completion

- 모든 자동 검증은 기존 `scripts/` 바로 아래. 새 tests/ 또는 .memory/test-plans 생성 금지. 수행 결과·한계·커밋은 각 Task Progress.
- API: 소유권 음성 사례, JWKS 서명, batch 경쟁, lease fencing, 중복 요청, 새 회차, 한국어 경계 동점 전체 조회.
- 클라이언트: 서버 오류를 기본 저장으로 덮어쓰지 않기, Strict Mode 중복 mount 정리, 계정 전환의 오래된 promise 차단, 메뉴 닫기·씬 전환·Escape가 필수 정지를 풀지 않기.
- 게임: 월드 1 CP stage2/4, 월드 2 stage4 제외·역방향 이동, 전 월드 재개, 복원 이벤트 재점수 금지, 최종 클리어.
- 배포: 정적 산출물 250 MB/15000 파일 한도 검사, Node22 API 실제 로드, 수동 workflow 기본 브랜치 존재와 정확한 소스 SHA.
- 실제 인증·배포·기기 전환은 CLI/HTTP + 사용자의 수동 UI 확인. 자동 브라우저 조작을 검증의 필수 조건으로 넣지 않는다.

## Existing Work and Exclusions

- 계획 수립 시 이미 게임·그림·테스트에 다수 미커밋 변경(인터뷰 시작 97개)이 있다. 이 계획은 이를 기준 작업 트리로 보존하며 구현 시 Task 변경 hunk만 선별 커밋한다. git add . / reset --hard / 임의 stash 금지.
- 이전 월드 4 계획 8/8 완료, 기록 보존. 월드 3 인트로 두 번째 자막 이후 자동 진행 중단은 이미 별도 작업으로 결정됐으므로 포함하지 않는다.
- 실시간 WebSocket, 전체 서버 게임 시뮬레이션, 새로운 닉네임 수정 화면, 기존 로컬 기록 이전, 다른 DB 정비는 범위 밖.
- 이 단계에서는 .memory 문서만 작성한다. 실제 설치·코드 수정·리소스 생성·배포·커밋은 실행 단계에 한다.

## Official References

- [Functions Node v4](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node): app.http 등록과 패키지 main 진입점.
- [SWA 설정](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration): 정적 설정 파일 위치와 Node 22 API 런타임.
- [SWA 빌드 설정](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration): 사전 빌드 시 app_location/api_location 및 skip 옵션.
- [수동 workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow): 기본 브랜치 등록 조건.
- 추가 근거는 연결한 결정 문서의 공식 참고 자료와 설치된 Next 정적 내보내기 문서.

