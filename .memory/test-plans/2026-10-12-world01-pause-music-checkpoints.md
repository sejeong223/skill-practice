# 월드 1 화면·음악·체크포인트 통합 검증

- 실행일: 2026-10-12, Asia/Seoul.
- 계획: [world01-pause-music-checkpoints](../plans/2026-10-12-world01-pause-music-checkpoints.md).
- 환경: Windows, 기존 `http://localhost:3000` 개발 서버 재사용, Playwright/Chromium headless. 사용자 서버를 중단하지 않았다.
- 화면: 데스크톱 1280×720, 모바일 크기 390×844 및 `hasTouch/isMobile` 브라우저 모방.
- 소리 확인 방식: 실제 Tone/Web Audio 출력에 analyser/MediaRecorder를 연결해 파형·무음·이벤트·재생 위치를 측정했다. 스피커/이어폰 청음과 실제 모바일 기기 검증은 수행하지 않았다.
- 제품에 디버그 UI, 녹음 기능, 테스트 전용 진입 API를 추가하지 않았다. 브라우저 검증 코드는 `.git/refinement-tools/`에서만 실행했다.

## 자동 검사

| 검사 | 결과 | 범위 |
| :--- | :--- | :--- |
| `node --experimental-strip-types --test $taskTestFiles` | pass, 35/35 | `rg --files scripts -g '*.test.mjs'`로 수집한 전체 테스트 |
| `npm.cmd run world01:maps:check` | pass | 일반 맵 4개, 기믹 32개, Tiled 객체 58개 |
| `npx.cmd tsc --noEmit` | pass | 최종 오디오 보완 포함 |
| `npm.cmd run lint` | pass | 최종 오디오 보완 포함 |
| `npm.cmd run build` | pass | Next.js 16.3.5 프로덕션 빌드 |

지연된 음악 예약이 동일한 oscillator 시작 시각으로 보정되는 경계도 보완했다. `canPlayAt(time, previousTime)`은 이미 지난 음표, 중복/역순 예약, 정지 상태 및 이전 장면 소유자의 콜백을 건너뛴다. 정상적인 다음 음표부터 이어지며 3개 악기 모두 회귀 테스트한다. 공유 AudioContext를 suspend/close하는 방식은 사용하지 않는다.

## 통합 시나리오

| ID | 시나리오 | 기대 결과 | 실제 결과 | 상태 | 증거 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| R01 | 보스 첫 입장·재입장과 원 위치 통과 | 코인/원 0개, 숨은 적립 없음, 원래 바닥 유지 | 첫 검증 잔액10 유지, 재입장도 코인0. 기존 원본 타일 지형 유지 | pass | [T01 결과](../phases/2026-10-12-world01-pause-music-checkpoints/P01-feedback-and-audio/T01-boss-coin-cleanup.md#execution-result), [재입장](assets/world01-feedback-integration.json), [보스 화면](assets/world01-feedback-pause-world-01-stage-boss.png) |
| R02 | 간식 획득·사망·재시작·새로고침 | 외형과 첫 안전 간식 유지, 현행 재적립/저장 유지 | 진짜/가짜 모두 `bone-coin`, 첫 가짜 앞 안전 간식4개. 실제 획득10→11, 사망 후 같은 간식12, 새로고침 후12 | pass | [통합 JSON](assets/world01-feedback-integration.json), 지갑 자동 테스트 |
| R03 | 오프닝→월드 1 일반 구간 | 기존 오프닝 유지, 일반곡으로 교체, 한 곡만 재생 | 이름 입력 후 오프닝 관리자 폐기, 일반곡 `world-01-peaceful`. 일반 1~4단계 라우팅 자동 확인 | pass | [T02 결과](../phases/2026-10-12-world01-pause-music-checkpoints/P01-feedback-and-audio/T02-stage-music.md#execution-result), `scripts/stage-music.test.mjs` |
| R04 | 보스 첫 대사 완료·재입장 | 모두 새 보스곡, 기존 곡으로 덮이지 않음 | 첫 대사 종료와 본 대사 생략/재입장 모두 `world-01-calico`. 자동 대사 진행 유지 | pass | [보스 음악](assets/world01-feedback-music.json), [재입장](assets/world01-feedback-integration.json) |
| R05 | 보스 실패 후 4단계 복귀 | 일반곡, 마지막 체크포인트 복원, 차임0 | 실제 투사체 6회로 사망, `world-01-stage-4-checkpoint` 복원, 일반곡과 잔액12 유지, 복원 차임0 | pass | [통합 JSON](assets/world01-feedback-integration.json) |
| R06 | 신규 BGM 각각 16마디 이상 | 루프 진행, 실제 출력, 중복 재생 없음 | 일반곡40초/보스곡36초 녹음, 1루프인12288 ticks 이상 진행. 각 장면 관리자가 3개 악기 시퀀스만 유지 | pass | [최종 음악 측정](assets/world01-feedback-final-music.json), [일반곡 녹음](assets/world01-feedback-final-peaceful.webm), [보스곡 녹음](assets/world01-feedback-final-calico.webm) |
| R06-L | 두 곡의 분위기·청감 | 평화로움/약한 긴장감, 클릭·끊김·음량을 귀로 평가 | 합성 설정과 파형 출력 확인. 실제 스피커/이어폰으로 듣지는 않음 | not-run | 위 녹음으로 후속 청음 가능 |
| R07 | 일반 구간 5초 정지·재개 | 게임과 음악 위치 정지, 무음, 이어 재생 | 정지 전후 ticks 동일, 출력 peak0, AudioContext는 running 유지. 재개 후 ticks와 출력 회복 | pass | [정지 측정](assets/world01-feedback-pause.json) |
| R08 | 보스 정지·재개·반복 토글 | 게임/음악/표시 일치, 누적 없음 | 보스도5초 무음과 위치 유지. 일반/보스 각각 Escape 정지·재개10회, 시퀀스 유지. 방어 회귀 통과 | pass | [정지 측정](assets/world01-feedback-pause.json), [방어 결과](assets/world01-feedback-bowl.json) |
| R09 | 정지 중 입력·늦은 unlock | unlock 완료 후에도 정지 중 음악 재생 금지 | pointer/keyboard 입력과 지연 Promise 완료에도 정지 유지. 재개 때만 곡 시작, 이전 관리자/폐기 뒤 unlock도 영향 없음 | pass | 정지 브라우저 검증, `scripts/audio-pause.test.mjs` |
| R10 | 두 화면 크기와 입력 | 중앙 표시, 반투명 검은 배경, HUD 위, 재개 가능 | z15/검정60%, 프레임 중앙 표시. 390px 폭에서 넘침 없음. Escape/계속하기와 모방 터치4회 동작 | pass | [일반 정지 화면](assets/world01-feedback-pause-world-01-stage-1.png), [모바일 크기](assets/world01-feedback-pause-mobile.png), [터치 기록](assets/world01-feedback-touch.json) |
| R10-D | 실제 모바일 기기 | 실제 터치/오디오 정책 확인 | 모바일 크기·터치는 브라우저에서 모방했으며 실기기는 사용하지 않음 | not-run | [터치 기록](assets/world01-feedback-touch.json)의 `physicalDevice: false` |
| R11 | 장면 교체·초기화 확인창 | 정지 표시 정리, 확인창이 위에 표시 | 새 장면에 정지 표시 남지 않음. 초기화 확인창 z20 > 정지층15, 취소 정상 | pass | [정지 측정](assets/world01-feedback-pause.json) |
| R12 | 2/4단계 체크포인트 접근 | 판정 사각형 숨김, 깃발 바닥 정렬, 최초 차임1 | atlas 픽셀 깃발 각1개, 판정 body 유지/visible=false. 깃발 밑면과 바닥480/512 일치. 실제 이동 통과로 저장/차임 | pass | [최종 깃발 측정](assets/world01-feedback-final-checkpoints.json), [2단계](assets/world01-feedback-final-checkpoint-2.png), [4단계](assets/world01-feedback-final-checkpoint-4.png) |
| R13 | 머무르기·재통과·자동 복원 | 추가 차임0, 새 유효 활성화1, 잔상 없음 | 각 체크포인트 최초1회, 같은 snapshot 재접촉0회, 4단계 자동 복원0회. 깃발1개/종료 효과음 source0 | pass | [최종 깃발 측정](assets/world01-feedback-final-checkpoints.json), 체크포인트 자동 테스트 |
| R14 | BGM 중 차임·실제 방어3회 | 공용 컨텍스트 출력, 깡3회, 사모예드5마리, 다음 피격 체력 감소 | 방어 잔여2→1→0, clang3회, 실제 출력 peak0.0878/0.1080/0.1080. 왼쪽 화면 밖에서5마리 진입, 네 번째 피격 체력3→2 | pass | [방어 JSON](assets/world01-feedback-bowl.json), [방어 녹음](assets/world01-feedback-bowl.webm), [차임 측정](assets/world01-feedback-final-checkpoints.json) |
| R14-L | 효과음의 주관적 식별·음량 | BGM 위 차임/깡 구별, 편안한 음량 | 충돌→이벤트→오디오 출력은 확인. 사람의 귀로 식별/음량을 평가하지 않음 | not-run | 위 녹음과 파형 |
| R15 | 보스 클리어·씬 종료·재진입 | HP10, 정상 다음 장면, 자원 정리 | 실제 J 공격10회로 클리어, 자동 대사8개, 완료 이벤트1회. 기존 관리자 폐기/source0, Enter로 월드2 곡 전환. 실패 후 재도전 HP10/방어3/코인0/방패 유지 | pass | [통합 JSON](assets/world01-feedback-integration.json), [방어 재입장](assets/world01-feedback-bowl.json), 소유권/폐기 자동 테스트 |

## 측정 해석과 보존 범위

- 보스 충돌 검증은 투사체 발사 위치/진행 시점을 제어했지만 실제 생선 가시와 플레이어의 충돌 판정 경로를 거쳤다. 임의 `clang` 이벤트만 발생시킨 검사가 아니다. 체크포인트·간식은 실제 overlap과 이동 입력으로 확인했다.
- 정지는 공유 오디오 컨텍스트를 멈추지 않고 현재 음악 Transport 위치 및 전용 gain을 제어한다. 정지 후 분석 구간의 peak0과 동일 ticks를 함께 확인했다.
- BGM 루프 진행/파형만으로 청감상 클릭·편안함을 증명했다고 보지 않는다. 주관적 청음은 별도 `not-run`으로 남겼다.
- 기존 원본 보스 바닥 및 밥그릇 방어음 수정은 T02에 보존해서 포함했다. [이전 바닥/방어음 기록](2026-10-12-boss-ground-and-audio.md)도 유지했다.
- 현재 사망 뒤 같은 코인 재적립은 유지한다. 상점/의상/클리어 월드 재도전이 준비되기 전 중복 적립 제한을 먼저 넣지 않았다.
- 4단계 끝의 출구 사각형은 체크포인트와 별개이며, [예전 compact T03](../phases/2026-10-01-world01-compact-scenes/P01-world01-map-and-hud/T03-day-flag-and-invisible-exit.md)의 별도 미완료 항목이다. 이번에 해당 Task 전체를 완료 처리하지 않았다.

## Task 커밋

| Task | 커밋 | 결과 |
| :--- | :--- | :--- |
| T01 | `ec7e532` | 보스 기본 코인/원 제거 |
| T02 | `e3fd858` | 일반·보스 신규 음악과 장면별 연결 |
| T03 | `5f1a388` | 픽셀 깃발과 최초 활성화 차임 |
| T04 | `d464ce9` | 음악 정지/재개와 중앙 오버레이 |
| T05 | 커밋 후 청사진에 기록 | 통합 검증·지연 음악 예약 보완·메모리 완료 정리 |
