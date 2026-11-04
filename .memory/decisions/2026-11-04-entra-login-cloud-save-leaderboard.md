# Decisions: Entra ID 로그인·클라우드 저장·TOP 10 랭킹·Static Web Apps 배포

- Date: 2026-11-04
- Status: Confirmed
- Feature: entra-login-cloud-save-leaderboard
- Workspace: C:/Users/김세정/Documents/GitHub/skill-practice
- Game: 짧은 다리의 역습: 전설의 왕갈비뼈를 찾아서
- Scope: 기존 게임의 조직 로그인, 계정별 진행 저장, 최고 기록 랭킹, 기존 공용 Cosmos DB 계정 내 새 DB, 신규 Azure Static Web Apps 배포.
- Attribution: [사용자 선택], [사용자 제공 환경], [코드 확인], [공식 문서 확인], [설계 구체화]를 구분한다. 설계 구체화는 선택한 요구를 연결하는 구현 조건이며, 사용자가 모든 필드·함수·수치를 직접 선택했다는 뜻이 아니다.
- Stage: 인터뷰 결과만 저장한다. 구현, 리소스 생성, 배포, 커밋 및 .memory/current.md 포인터 변경은 이번 단계에서 수행하지 않는다.

## D01. 로그인 대상과 시작 조건

- **Chosen**: dexconsulting.net 조직의 Entra ID 계정 및 해당 조직에 초대된 게스트만 허용한다. 회사·학교 전체 조직이나 개인 Microsoft 계정에 개방하지 않는다. [사용자 선택]
- **Chosen**: 게임 시작 전 로그인 필수. 인증과 계정 저장 데이터 로딩이 끝나기 전에 게임을 시작하지 않는다. [사용자 선택 및 설계 구체화]
- **Rationale**: 기록의 소유자를 처음부터 계정에 연결한다.
- **Boundary**: 이메일 도메인 문자열만 비교하는 인증을 구현하지 않는다. 실제 테넌트 ID와 토큰 발급자를 검증한다. 게스트도 대상 조직에서 발급된 신원으로 구분한다. [설계 구체화]

## D02. Static Web Apps Free와 로그인 구현

- **Chosen**: Azure Static Web Apps Free에서 Microsoft 공식 MSAL 라이브러리로 Entra 로그인을 구현한다. API도 별도로 인증·권한을 검증한다. [사용자 선택]
- **Chosen**: 플랫폼의 Standard 전용 사용자 지정 인증 기능에 의존하지 않는다. 기본 제공 Microsoft 로그인은 모든 Microsoft 계정을 허용하므로 조직 제한을 대신하는 것으로 간주하지 않는다. [공식 문서 확인 및 설계 구체화]
- **Rationale**: 웹사이트 기본요금이 없는 구성으로 조직 로그인 요구를 충족한다.
- **Boundary**: Free는 웹사이트 요금제다. Cosmos DB·관리형 Functions 사용량 등 전체 구성의 비용이 모두 0이라는 뜻이 아니다.
- **UX**: 로그인 실패·취소는 로그인 화면에서 재시도한다. 토큰 갱신 실패 시 플레이를 멈추고 재로그인한다. [설계 구체화]

## D03. 게임 전용 Entra 앱 등록

- **Chosen**: 기존 서비스의 앱 등록을 재사용하지 않고 로그인용·API용 앱 등록을 게임 전용으로 새로 만든다. [사용자 선택]
- **Names**: legendary-rib-corgi-web / legendary-rib-corgi-api를 기본 이름으로 사용한다. 두 등록 모두 대상 조직 전용이다. [설계 구체화]
- **Contract**: 웹 앱은 SPA용 승인 코드 흐름과 PKCE를 MSAL로 처리한다. API 앱은 게임 접근용 위임 범위를 노출하고, 웹 앱은 해당 범위의 액세스 토큰을 요청한다. [설계 구체화]
- **Rationale**: 게임과 API의 권한·리디렉션 주소를 기존 서비스와 분리한다.
- **Secrets**: SPA에 클라이언트 비밀 값을 넣지 않는다. 테넌트 ID, 앱 ID, 리디렉션 주소 등은 실제 등록 후 환경별 설정으로 주입한다.

## D04. 사용자 식별과 API 인증

- **Chosen**: 서버에서 검증한 테넌트 ID와 사용자 개체 ID(oid)를 조합해 계정 식별자를 만든다. 닉네임·이메일을 저장 데이터의 소유자 키로 쓰지 않는다. [설계 구체화]
- **Validation**: API는 Bearer 액세스 토큰의 서명, 발급자, 대상 API(audience), 만료, 대상 테넌트 및 게임 접근 범위를 검증한다. ID 토큰이나 브라우저가 주장하는 사용자 ID로 쓰기를 허용하지 않는다.
- **Isolation**: 읽기·저장·초기화·세션 전환은 요청자의 계정에 한정한다. 다른 사용자의 전체 저장 데이터는 반환하지 않는다.
- **Rationale**: 닉네임이 같거나 바뀌어도 기록 소유권을 유지하고 다른 계정의 기록 덮어쓰기를 막는다.

## D05. TOP 10과 정렬 기준

- **Chosen**: 계정별 대표 기록을 최대 10개 표시한다. 정렬은 진행도 내림차순 → 데스 수 오름차순 → 게임 닉네임 가나다순이다. [사용자 선택]
- **Chosen**: 먼저 달성한 시간이나 짧은 플레이 시간을 동점 기준으로 사용하지 않는다. 사용자가 이름 순으로 직접 지정했다.
- **Presentation**: 순위, 닉네임, 데스 수, 클리어 위치를 표시한다. 10명보다 적으면 실제 기록 수만 표시한다. [사용자 요청 및 설계 구체화]
- **Ordering**: 이름은 Unicode 정규화 후 한국어 정렬 규칙으로 비교한다. 동일 이름까지 같으면 내부 계정 식별자로 순서를 고정해 정확히 최대 10명을 반환한다. 내부 식별자는 랭킹에 노출하지 않는다. [설계 구체화]
- **Query rule**: 데이터베이스 기본 문자열 정렬이 한국어 정렬과 같다고 가정하지 않는다. 한국어 동점 정렬을 TOP 10 절단 전에 적용하며, 경계 동점자를 임의의 조회 개수로 잘라 누락시키지 않는다.
- **Rationale**: 요청한 경쟁 기준과 노출 인원을 일관되게 지킨다.

## D06. 계정당 역대 최고 기록

- **Chosen**: 계정마다 역대 최고 기록 1개를 유지한다. 가장 멀리 도달한 위치와 그 위치를 달성했을 때의 데스 수를 한 쌍으로 저장한다. [사용자 선택]
- **Comparison**: 더 높은 진행도를 달성하거나, 같은 진행도를 더 적은 데스로 달성하면 교체한다. 최고 위치와 별개의 회차에서 나온 최소 데스를 조합하지 않는다. [설계 구체화]
- **Persistence**: 진행 초기화 후에도 최고 기록은 보존한다. 이후 같은 위치에서 더 죽거나 이전 월드를 다시 플레이해도 기존 최고 기록을 악화시키지 않는다.
- **Rationale**: 재도전은 허용하면서 이미 달성한 성과를 유지한다.

## D07. 순위용 진행 지점

- **Chosen**: 각 월드의 시작 → 실제 체크포인트 → 월드 클리어 단위로 순위 진행도를 구분한다. 체크포인트 사이 이동이나 보스 진입만으로 별도 순위 지점을 만들지 않는다. [사용자 선택]
- **Labels**: 월드 2 시작 / 월드 2 체크포인트 1 / 월드 2 클리어처럼 표시한다.
- **Code mapping**: 월드 1의 체크포인트 1·2는 각각 stage-2·stage-4에 있다. 월드 2의 실제 일반맵 경로는 stage-1·2·3이고 stage-4를 건너뛰어 보스로 간다. 보스전에는 체크포인트가 없다. [코드 확인]
- **Implementation**: 실제 플레이 가능한 경로와 유효 체크포인트 목록으로 서버·클라이언트가 공유할 순위 매핑을 정의한다. 가짜 체크포인트나 개발용 점프는 도달 기록으로 인정하지 않는다. 다음 월드 시작과 최종 월드 클리어도 명시적으로 매핑한다. [설계 구체화]
- **Rationale**: 현재 화면의 맵 ID를 그대로 순위로 삼으면 되돌아가기·건너뛰는 맵·보스전에서 의미가 어긋난다.

## D08. 닉네임

- **Chosen**: Entra 계정의 실명 대신 기존 게임에서 입력한 닉네임을 표시한다. 닉네임 중복은 허용하고 계정으로 기록을 구분한다. [사용자 선택]
- **Existing rules**: GameShell.handleNameConfirm은 앞뒤 공백을 제거하고 < > 문자를 제거한 뒤 최대 20자로 제한하며, 빈 값에는 코기를 사용한다. 같은 규칙을 서버에서도 적용한다. [코드 확인 및 설계 구체화]
- **Profile**: 계정의 현재 게임 닉네임을 표시 이름으로 관리한다. 기존 이름 입력 흐름에서 이름이 바뀌면 최고 기록의 표시 이름도 동기화하되 위치·데스 수는 별도로 보존한다. 별도의 닉네임 변경 화면을 범위에 추가하지 않는다. [설계 구체화]
- **Rationale**: 기존 게임 경험을 활용하고 계정 실명 노출을 피한다.

## D09. 저장 범위와 최초 로그인

- **Chosen**: 랭킹뿐 아니라 계정별 게임 진행 데이터를 DB에 저장한다. 다른 PC에서도 같은 계정으로 이어서 플레이한다. [사용자 선택]
- **Scope**: 진행도, 코인, 아이템·장비·의상, 기술 해금, 누적·스테이지별 데스, 수집 기록, 컷신 상태, 키 설정 등 기존 ProgressState를 보존하고 재개 위치 정보를 추가한다. [코드 확인 및 설계 구체화]
- **Chosen**: 첫 로그인 계정은 새 게임으로 시작한다. 기존 브라우저 저장 데이터는 보존하지만 계정이나 랭킹으로 가져오지 않는다. [사용자 선택]
- **Legacy key**: legendary-rib-corgi:progress:v1은 기존 로컬 저장이다. 계정용 캐시·복구 대기 기록과 키를 구분하고 로그아웃·계정 전환 시 다른 계정에 섞이지 않도록 한다.
- **Rationale**: 기존 데이터에는 소유 계정이 없으며, 사용자들이 같은 출발점에서 기록을 쌓도록 선택했다.

## D10. 이어하기 위치

- **Chosen**: 게임을 다시 열거나 다른 PC에서 로그인하면 현재 월드의 마지막 체크포인트부터 재개한다. 현재 월드에서 체크포인트에 도달하지 않았다면 그 월드 시작점부터 시작한다. [사용자 선택]
- **Implementation**: 현재 월드, 재개 스테이지·체크포인트, 필요한 복원 스냅샷을 영구 저장한다. 이전 월드의 체크포인트를 새 월드의 재개점으로 쓰지 않는다. [설계 구체화]
- **Boundary**: 보스 도중 종료도 별도 보스 진입 저장점으로 확장하지 않고 위 재개 규칙을 따른다. 전체 클리어 상태는 새 게임으로 오인하지 않게 보존한다.
- **Rationale**: 일반 ProgressState에는 모든 월드의 재개용 체크포인트 스냅샷이 영구 저장되지 않는다. 현재 Phaser registry/메모리의 스냅샷만으로 기기 간 이어하기를 구현할 수 없다. [코드 확인]

## D11. 저장 시점과 데이터 정합성

- **Chosen**: 기존 자동 저장 이벤트를 기반으로 클라우드 저장을 연결한다. 체크포인트, 사망, 맵 클리어, 아이템·코인 변경, 이름 입력 등 진행 변화가 순서대로 저장되어야 한다. [코드 확인 및 설계 구체화]
- **Records**: 계정 프로필, 현재 회차의 진행·재개 상태, 역대 최고 기록, 활성 세션, 중복 요청 처리 정보를 구분한다. 회차 식별자와 저장 버전·요청 순번을 사용한다.
- **Atomicity**: 같은 계정의 현재 진행과 최고 기록을 함께 바꾸는 작업은 원자적으로 처리한다. 중복 재시도가 사망·코인·구매를 중복 반영하지 않게 한다.
- **Reset**: 진행 초기화는 새 회차를 만들고 기존 게임의 진행·보유품·데스 등을 초기화한다. 계정 신원과 역대 최고 기록은 삭제하지 않는다. 서버 초기화 성공 전에 새 회차를 시작하지 않는다.
- **Rationale**: 체크포인트 달성 시점의 사망 수와 최고 기록이 서로 다른 저장 요청 때문에 어긋나는 것을 막는다.

## D12. 연결·저장 실패

- **Chosen**: 인터넷 단절 또는 DB 저장 실패 시 자동 일시정지한다. 현재 상태를 임시 보관하고 재시도하며, 저장에 성공한 뒤 이어서 플레이한다. [사용자 선택]
- **Behavior**: 화면에 저장 중·재연결 중·재로그인 필요 상태를 구분한다. 실패를 성공으로 표시하거나 빈 기본 저장으로 기존 진행을 덮어쓰지 않는다. [설계 구체화]
- **Recovery**: 계정·회차·세션에 귀속된 미확정 요청을 중복 안전하게 재시도한다. 다른 기기는 서버에 확정 저장된 진행을 기준으로 재개한다.
- **Rationale**: 계속 플레이하다가 기록이 누락되거나 기기별 진행이 갈라지는 일을 줄인다.
- **Limit**: 임시 기록이 아직 서버에 저장되지 않은 상태에서 브라우저 저장소까지 지워진 경우 복구를 보장하지 않는다. 오래된 세션의 대기 요청을 새 회차나 새 세션에 무조건 합치지 않는다.

## D13. 여러 PC·탭의 동시 접속

- **Chosen**: 새 화면에서 여기서 이어하기를 선택하면 기존 화면은 일시정지하고 새 화면으로 플레이 권한을 전환한다. [사용자 선택]
- **Implementation**: 계정당 활성 쓰기 세션 1개를 허용한다. 만료 가능한 세션 임대와 세대 번호를 서버에서 관리하고, 저장 요청마다 유효성을 검증한다. 기존 화면은 주기적 확인으로 전환 사실을 표시한다. [설계 구체화]
- **Takeover**: 전환은 명시적 사용자 조작으로 수행하며 새로 열린 탭이 자동으로 기존 플레이를 빼앗지 않는다. 기존 세션은 전환 이후 저장을 덮어쓸 수 없다.
- **Rationale**: 서로 다른 화면이 같은 진행을 덮어쓰는 충돌을 방지한다.
- **Transport**: 관리형 API에 맞춰 HTTP 요청·주기적 확인으로 구현한다. WebSocket 서버를 새로 추가하지 않는다.

## D14. 기본 서버 검증과 한계

- **Chosen**: 서버에서 로그인 계정, 진행 순서, 데스 수의 유효성, 중복 요청 등을 검증한다. 플레이 과정을 서버에서 재현하는 전체 부정행위 방지는 범위에 포함하지 않는다. [사용자 선택]
- **Checks**: 허용된 월드·스테이지·체크포인트, 회차 내 사망 수의 단조 증가, 정수·범위·스키마, 세션 소유권, 저장 버전과 순번을 검사한다. 순위 숫자·클리어 라벨은 서버가 매핑한다. [설계 구체화]
- **Limit**: 브라우저가 실제 플레이를 계산하므로 이 검증만으로 조작을 완전히 차단한다고 주장하지 않는다.
- **Rationale**: 사내 게임에 필요한 기본 보호를 추가하되 서버 게임 엔진을 새로 만들지 않는다.

## D15. 개발 모드와 운영 기록 분리

- **Chosen**: 개발 모드 기록은 운영 랭킹에서 제외한다. [사용자 선택]
- **Code fact**: 현재 developmentStart는 월드 4에서 시작하도록 하고 월드 1~3 보스 클리어·기술 해금 값을 준비한다. [코드 확인]
- **Implementation**: 이런 개발 편의 진행은 운영 저장 데이터에도 업로드하지 않도록 분리한다. 운영 인증·DB 통합 검증은 정상 월드 1 시작 흐름과 구분된 테스트 데이터 범위로 수행한다. 추가 유료 테스트 DB를 자동 생성하지 않는다. [설계 구체화]
- **Rationale**: 로그인만 한 개발 계정이 월드 4 도달 기록을 얻거나 운영 진행을 변조하는 것을 막는다.

## D16. 랭킹 화면

- **Chosen**: 게임 메뉴에 랭킹 버튼을 추가한다. 누르면 게임을 일시정지하고 TOP 10을 표시한다. 항상 표시하는 사이드바는 만들지 않는다. [사용자 선택]
- **States**: 열 때 서버 기록을 조회하고 로딩·기록 없음·조회 실패·재시도 상태를 제공한다. 가짜 순위나 샘플 기록을 운영 데이터처럼 표시하지 않는다. [설계 구체화]
- **Pause**: 창을 닫을 때 저장 실패·세션 상실 등 다른 일시정지 사유가 남아 있으면 게임을 재개하지 않는다.
- **Rationale**: 기존 메뉴·모달 방식에 맞추고 플레이 공간을 유지한다.

## D17. 기존 공용 Cosmos DB 계정

- **Chosen**: 아래 기존 계정 안에 새 게임 DB를 추가한다. 새 Cosmos DB 계정을 만드는 요청이 아니다. [사용자 직접 요청]
- Subscription: b7af62a9-9a10-4deb-95fa-1690f7bbd33d
- Resource group: grill-me-edu
- Account: maze-rescue-ms-b7af62a9
- API: Azure Cosmos DB for NoSQL. [사용자 제공 환경]
- Capacity mode: 프로비전된 처리량. [사용자 제공 환경]
- enableFreeTier: true. [사용자 제공 환경]
- Existing total provisioned throughput: 3,400 RU/s. 다른 사람들의 DB가 이미 있는 공용 계정이다. [사용자 제공 환경]
- Region reported: Korea Central. [사용자 제공 환경]
- Public network access: 모든 네트워크. [사용자 제공 환경]
- **Preservation**: 다른 DB·컨테이너·할당량을 수정·삭제하지 않는다. 계정 전체의 지역, 방화벽, 인증 방식, 무료 등급, 처리량 상한 등을 자동 변경하지 않는다.
- **Rationale**: 공유 계정을 새 계정처럼 재구성하거나 기존 무료 용량을 회수하면 다른 사용자의 서비스에 영향을 준다.

## D18. 게임 전용 DB와 처리량

- **Chosen**: 데이터베이스 이름은 legendary-rib-corgi. 전용 컨테이너 1개에 수동 400 RU/s를 할당한다. 자동 확장은 선택하지 않았다. [사용자 선택]
- **Container**: game-data를 기본 이름으로 하고 계정 식별자 playerId를 파티션 키로 사용한다. 프로필·진행·최고 기록·세션 문서를 한 컨테이너에서 종류별로 구분한다. [설계 구체화]
- **Reason**: 계정 단위 저장의 원자성과 소유권 검사를 유지하면서 컨테이너마다 별도 최소 처리량을 중복 할당하지 않는다.
- **Billing**: 2026-11-04 공개 단가 조회 결과, Korea Central의 일반 단일 지역·단일 쓰기 기준 100 RU/s당 시간당 USD 0.008이다. 400 RU/s × 730시간은 월 USD 23.36의 처리량 기준 예상액이다. 저장 공간, 세금, 가용 영역·복제 등 추가 구성, 계약 할인·무료 한도 배분 및 네트워크 비용은 별도다.
- **Boundary**: enableFreeTier=true를 새 DB 전체 무료 보장으로 해석하지 않는다. 현재 3,400 RU/s의 상세 구성·기존 청구는 직접 검증하지 않았으므로 실제 증가 청구액을 확정값으로 말하지 않는다.
- **Guard**: 계정 처리량 상한·정책이 생성을 막으면 상한을 임의로 올리지 않는다. 동일 DB 이름이 이미 있으면 소유권을 확인하기 전 덮어쓰거나 통합하지 않는다.

## D19. DB 연결 권한

- **Chosen**: API용 앱 신원에 게임 DB 범위의 데이터 접근 권한을 부여한다. 다른 사람들의 DB에 접근할 수 있는 계정 공용 키를 앱에 사용하지 않는다. [사용자 선택 및 설계 구체화]
- **Scope**: Cosmos DB 데이터 영역 RBAC 범위를 /dbs/legendary-rib-corgi 또는 그 아래 게임 컨테이너로 제한한다. 서버는 고정된 DB·컨테이너만 대상으로 삼는다.
- **Platform constraint**: Static Web Apps의 관리형 Functions는 관리 ID를 지원하지 않는다. 따라서 API용 앱의 서비스 주체와 서버 전용 자격 증명으로 연결한다. 비밀 값은 SWA 서버 환경 설정에 보관하고 브라우저 번들·소스·로그·결정 문서·채팅에 넣지 않는다. [공식 문서 확인 및 설계 구체화]
- **Separation**: 리소스 생성에 쓰는 운영자 관리 권한과 실행 중 API의 게임 데이터 권한은 구분한다. 앱에 계정 전체 관리 권한을 부여하지 않는다.
- **Rationale**: 공용 DB 계정에서 데이터 접근 범위를 게임에 한정한다. 모든 네트워크 설정에서도 데이터 접근 인증은 필수다.

## D20. 신규 Static Web Apps와 실행 구조

- **Chosen**: grill-me-edu에 게임 전용 Azure Static Web App을 새로 생성한다. 이름은 legendary-rib-corgi를 기본으로 하며 Free 요금제를 사용한다. [사용자 선택 및 설계 구체화]
- **Frontend**: 기존 Next.js 게임을 정적 내보내기(output: export)로 빌드한다. 정적 파일은 SWA가 제공하고 Phaser 게임은 브라우저에서 실행한다.
- **Backend**: 관리형 Azure Functions의 /api 경로에서 인증·저장·세션·랭킹을 처리한다. TypeScript/Node.js 22를 기준으로 계획한다. 정적 내보내기에 요청 시점의 Next.js 서버 API를 넣지 않는다. [코드·공식 문서 확인 및 설계 구체화]
- **Exclusions**: App Service B1/F1, 별도 App Service 플랜, Next.js 하이브리드 호스팅은 최종 선택이 아니다.
- **Region**: Korea Central은 기존 Cosmos DB의 지역이다. SWA 관리형 API는 해당 서비스가 지원하는 한국 인접 지역을 선택하고, 실제 구독에서 지원 여부를 리소스 준비 단계에 확인한다. Cosmos DB 지역을 이에 맞춰 변경하지 않는다.
- **Size**: 현재 public의 248개 파일은 약 58.77 MiB다. 최종 정적 빌드 결과 전체를 Free의 환경당 250 MB·파일 수 한도에 대해 검증한다.
- **Rationale**: 기존 게임은 클라이언트 중심이며, 동적 데이터 작업을 관리형 API로 분리할 수 있다.

## D21. API 계약의 기본 경계

- **Chosen**: API의 구체적 스키마는 계획 단계 청사진에서 작성하되 다음 책임과 오류 의미를 유지한다. [설계 구체화]

| 책임 | 기본 계약 |
| --- | --- |
| 계정 부트스트랩·진행 읽기 | 검증된 계정의 프로필·현재 회차·재개 정보·최고 기록을 반환 |
| 세션 시작·이어하기 전환·갱신·종료 | 현재 쓰기 소유권과 세대 번호를 서버에서 관리 |
| 게임 이벤트·저장 | 회차 ID, 요청 ID, 순번·버전을 검증하고 진행·최고 기록을 원자적으로 갱신 |
| 진행 초기화 | 유효한 현재 세션에서 새 회차를 시작하고 최고 기록 유지 |
| 랭킹 읽기 | 인증된 조직 사용자에게 정렬된 최대 10개 공개 표시 필드만 반환 |

- **Errors**: 인증 만료는 401, 권한 거절은 403, 잘못된 데이터는 400, 세션·버전 충돌은 409, 처리량 제한은 429, 일시적 저장 장애는 503 등으로 구분한다. 실패 원인에 맞게 재로그인·전환·재시도·일시정지를 연결한다.
- **Rationale**: 화면과 DB 사이의 소유권·저장 순서·복구 책임을 명확히 한다.

## D22. GitHub 수동 배포

- **Chosen**: GitHub Actions의 Run workflow로 수동 실행한다. dev push마다 자동 배포하지 않는다. [사용자 선택]
- **Repository**: github.com/sejeong223/skill-practice. 현재 작업 브랜치는 dev이며 로컬 origin/HEAD는 main을 가리킨다. 기존 .github 배포 워크플로는 발견되지 않았다. [코드 확인]
- **Workflow**: workflow_dispatch로 빌드·검증·정적 파일과 관리형 API 배포를 실행한다. 현재 게임이 있는 dev를 기본 소스 참조로 두고 배포할 커밋을 명시적으로 확인한다. [설계 구체화]
- **Bootstrap**: 수동 실행 버튼을 사용하려면 워크플로가 GitHub 기본 브랜치에 있어야 하므로 실제 기본 브랜치와 권한을 확인하고 최초 등록 절차를 계획한다. dev에 파일만 추가하고 수동 배포가 준비됐다고 보고하지 않는다.
- **Secrets**: 배포 자격 증명은 GitHub Secrets에 저장한다. 브라우저용 공개 식별자와 API 서버 전용 비밀 값을 분리한다.
- **Rationale**: 공개 사이트를 갱신하는 시점을 사용자가 고른다.

## D23. 사용자 조작과 실행 준비 입력

- **Chosen**: computer-use 방식은 사용하지 않는다. 사용자 브라우저·데스크톱을 조작하지 않고, Azure 화면 확인이나 대화형 로그인 등 필요한 작업은 경로를 안내해 사용자에게 요청한다. [사용자 직접 지시]
- **Observed access**: 인터뷰 중 로컬 Azure CLI에서 대상 구독은 조회되지 않았다. 캐시된 로그인 상태만으로 권한이 영구적으로 없다고 단정하지 않지만, 다른 구독을 대체 대상으로 사용하지 않는다.
- **Execution inputs**: 대상 테넌트 ID, 신규 앱 ID·서비스 주체 ID, 실제 SWA 주소·API 지원 지역, 리디렉션 주소, 앱 등록·DB 생성·게임 범위 역할 할당 권한, 배포 자격 증명은 리소스 준비 단계에서 확인·설정한다.
- **Secret handling**: 비밀 값은 적절한 환경 설정에 직접 입력하도록 안내하며 채팅으로 전달받는 절차를 만들지 않는다.
- **Rationale**: 기능·아키텍처 선택과 실제 배포 시 생성되는 식별자·권한 확인을 구분한다. Confirmed 상태는 실제 Azure 구성이 이미 완료됐다는 뜻이 아니다.

## D24. 검증과 기존 작업 보존

- **Chosen**: 코드 구현 전에 해당 Next.js 16.3.5 설치본의 node_modules/next/dist/docs 안내를 따른다. React 19.2.8, Phaser 3.90 계열과 기존 저장 스키마 v5를 출발점으로 한다. [코드 확인]
- **Required validation**: 다른 조직·계정의 접근 거절, 최고 기록 보존, 동일 위치 데스 비교, 한국어 이름 동점·10위 경계, 실제 체크포인트 매핑, 초기화·회차 분리, 재시도 중복 방지, 저장 실패 일시정지, 세션 전환 후 오래된 쓰기 거절, 다른 PC 재개, 개발 기록 제외, 정적 빌드·API 배포를 검증한다. [설계 구체화]
- **Repository convention**: 새 자동 검증 파일은 기존 scripts/ 바로 아래에 둔다. 별도 테스트 폴더나 test-plans 문서를 만들지 않고 결과는 해당 Task의 Progress에 기록한다. [.memory/current.md의 기존 사용자 지시]
- **Preservation**: 인터뷰 종료 전 작업 트리에는 기존 변경 97개가 있었다. 게임·이미지·스크립트 등 기존 수정과 삭제를 되돌리거나 임의로 섞어 커밋하지 않는다. 이 인터뷰는 결정 문서만 추가한다.
- **Rationale**: 인증·저장 변경에 맞는 검증을 수행하면서 진행 중인 사용자의 다른 작업을 보존한다.

## 요청 밖 발견 사항 — 보고만 하며 범위에 자동 추가하지 않음

- .memory/current.md에 월드 3 인트로 두 번째 자막 이후 자동 진행 중단이 별도 후속 조사 대상으로 남아 있다. 이번 인증·DB·랭킹 작업의 부수 수정으로 포함하지 않는다.
- 기존 게임에는 사망 집계, 닉네임 입력, 진행 초기화, 자동 저장, 이전 월드 선택 기능이 이미 있다. 새 기능에서 중복 구현하지 않고 기존 이벤트·흐름을 연결한다.
- 현재 개발 모드의 월드 4 강제 시작과 체크포인트 스냅샷의 메모리 의존은 새 운영 저장·랭킹 요구와 직접 충돌하므로 D10·D15의 통합 조건으로 다룬다. 월드 내용·난이도 자체를 바꾸는 요청은 아니다.

## 근거 파일

- src/app/layout.tsx, src/app/page.tsx, next.config.ts, package.json
- src/components/game/GameShell.tsx, ResetProgressDialog.tsx, IntroTitleOverlay.tsx
- src/game/core/types.ts, constants.ts, runtimeTypes.ts
- src/game/persistence/ProgressStore.ts, AutoSaveCoordinator.ts, saveTypes.ts
- src/game/systems/CheckpointSystem.ts, worldSelection.ts, developmentStart.ts
- src/game/scenes/StageScene.ts, src/game/data/worlds.ts
- .memory/current.md
- node_modules/next/dist/docs/01-app/02-guides/static-exports.md
- node_modules/next/dist/docs/01-app/01-getting-started/17-deploying.md

## 공식 참고 자료

- [Entra 로그인 대상](https://learn.microsoft.com/en-us/entra/identity-platform/single-and-multi-tenant-apps)
- [SPA와 MSAL 구성](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-spa-app-configuration)
- [Static Web Apps 인증](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization)
- [SWA 사용자 지정 인증의 Standard 제한](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom)
- [SWA API 지원](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-overview)
- [관리형 Functions와 관리 ID 등의 제한](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions)
- [SWA 런타임 설정](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration)
- [SWA 용량 한도](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas)
- [Next.js 정적·하이브리드 지원 구분](https://learn.microsoft.com/en-us/azure/static-web-apps/nextjs)
- [Cosmos DB 무료 등급](https://learn.microsoft.com/en-us/azure/cosmos-db/free-tier)
- [Cosmos DB 처리량 할당](https://learn.microsoft.com/en-us/azure/cosmos-db/set-throughput)
- [계정 전체 처리량](https://learn.microsoft.com/en-us/azure/cosmos-db/limit-total-account-throughput)
- [Cosmos DB 데이터 접근 권한과 범위](https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/how-to-connect-role-based-access-control)
- [Cosmos DB 네트워크 접근과 인증](https://learn.microsoft.com/en-us/azure/cosmos-db/how-to-configure-firewall)
- [GitHub Actions 수동 실행과 기본 브랜치 조건](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
- [Azure 공개 가격 API](https://prices.azure.com/api/retail/prices?$filter=serviceName%20eq%20%27Azure%20Cosmos%20DB%27%20and%20armRegionName%20eq%20%27koreacentral%27)

## 다음 단계

/memory-plan entra-login-cloud-save-leaderboard

이 문서를 바탕으로 리소스 준비·로그인·저장·랭킹·배포의 순차 청사진을 만든다. 계획 단계에서도 구현 코드는 작성하지 않으며, 그때 새 계획과 .memory/current.md 포인터를 초기화한다.

