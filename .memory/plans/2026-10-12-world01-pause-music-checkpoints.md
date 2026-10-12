# Plan: 월드 1 보스전 잔여 코인·일시정지·음악·체크포인트 피드백

## Goal

보스전에 보이는 노란 원을 제거하고, 일시정지 화면과 BGM의 상태를 맞춘다. 오프닝과 구별되는 월드 1 일반 구간/삼색이 전투 BGM을 각각 만들며, 실제 체크포인트를 픽셀 깃발과 한 번의 ‘띠리링’ 소리로 알린다.

- 작성일: 2026-10-12, Asia/Seoul.
- 사용자 요청: 최신 4개 항목을 모두 반영한 **계획 수립**. 이 단계에서는 구현·음원 생성·이미지 생성·구현 커밋을 하지 않는다.
- 근거: [결정 기록](../decisions/2026-10-12-world01-pause-music-checkpoints.md).

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `pending` | 보스 잔여 코인 제거, 장면별 BGM, 깃발/차임, 일시정지, 통합 검증 | [P01](../phases/2026-10-12-world01-pause-music-checkpoints/P01-feedback-and-audio/phase.md) |

## Confirmed Findings

1. `src/game/data/worlds.ts::createSegment`가 보스에도 코인 ID 3개를 넣는다. `StageRuntime.buildFromSegments`가 이를 x=180/252/324, y=450에 만들고, `StageEntityFactory.createCoin`의 기본 표현이 노란색 18×18 타원이다. 제공된 화면의 원과 대응한다. 월드 1 보스 데이터에서 생성 자체를 없앤다.
2. `StageScene.setPaused`는 runtime/physics만 멈춘다. AudioManager 연결과 중앙 오버레이가 없다. `StageScene.update`가 정지 상태에서도 재개 입력을 읽으므로 Scene 전체를 정지시키지 않는다.
3. 현재 `StageScene`의 AudioManager는 월드 1 보스에서만 생성된다. 일반 구간도 자신의 음악/효과음 관리자를 가져야 하며, 보스 도입 후 `playMusic("boss")` 직접 호출도 새 라우팅에 맞춰야 한다.
4. 기존 음악 도구는 `tone` 패키지의 Tone.js 시퀀서와 Web Audio 합성이다. 오프닝의 `cat-entry`도 `world-01-alley`를 사용하므로 이 키를 덮어쓰지 않고 새 키 2개를 추가한다.
5. `world-01-props.png`를 직접 확인했다. atlas의 `fake-checkpoint` 프레임은 깃대·받침·주황색 천이 있는 완성된 픽셀 깃발이다. 이미지 자체에는 가짜라는 문구가 없으므로 실제 체크포인트의 시각 표현으로 재사용할 수 있다. 동작은 이미지 이름이 아니라 객체 ID/속성과 CheckpointSystem이 결정한다.
6. `checkpoint-reached` → 효과음 연결은 이미 있지만 일반 구간에는 AudioManager가 없어 들리지 않는다. 기존 짧은 사각파 두 음을 부드러운 전용 차임으로 바꾸고, 실제 최초 활성화에만 재생한다.

## Scope and Order

| Task | 결과 | 주요 수정 대상 |
| :--- | :--- | :--- |
| T01 | 보스 원의 원인인 기본 코인 제거 | `worlds.ts`, 보스 콘텐츠 회귀 테스트 |
| T02 | 월드 1 평화로운 곡/보스 곡 제작 및 장면별 선택 | `AudioManager.ts`, `audioManifest.ts`, 새 음악 데이터/라우팅, `StageScene.ts`, 월드 컷신 데이터 |
| T03 | 기존 픽셀 깃발 연결, 최초 통과 차임 | `StageEntityFactory.ts`, `assetManifest.ts`, `CheckpointSystem.ts`, `AudioManager.ts`, `StageScene.ts` |
| T04 | 정지/재개 음악 동기화와 중앙 일시정지 오버레이 | `AudioManager.ts`, `StageScene.ts`, `GameShell.tsx`, 새 `PauseOverlay.tsx`, `globals.css` |
| T05 | 실제 장면 전환·체크포인트·정지·전투 회귀 확인 | 통합 검증 기록 및 필요한 수정 |

음악 소유권을 먼저 일반 구간까지 연결해야 체크포인트 차임과 일시정지 검증이 실제 게임에서 성립한다. 같은 오디오/장면 수명주기를 공유하므로 Phase는 하나로 두고, 관찰 가능한 결과 단위로 Task를 나눈다.

## Acceptance

- 월드 1 보스의 원/숨은 코인 판정이 모두 사라지고 일반 구간의 간식 및 적립 동작은 유지된다.
- 게임 정지 중 중앙 ‘일시정지’와 반투명 검은 배경이 게임/HUD 위에 보인다. BGM 진행 위치와 소리가 멈추며 재개 시 그 지점부터 이어진다.
- 오프닝, 월드 1 일반 구간, 삼색이 전투에서 서로 다른 곡이 선택된다. 이번 신규 제작은 일반 구간 1곡과 보스 1곡이다.
- 스테이지 2/4 실제 체크포인트에 픽셀 깃발이 보인다. 첫 활성화에만 부드러운 ‘띠리링’이 나고 재접촉/자동 복원은 중복 재생하지 않는다.
- 기존 보스 땅, 밥그릇 ‘깡’, HP 10, 방어 3회, 왼쪽 사모예드 5마리, 코인 영구 적립을 회귀시키지 않는다.

## Baseline and Existing Work

- [이동·간식·전투 개선](./2026-10-12-world01-gameplay-refinement.md)의 T01~T05는 완료 상태를 유지한다.
- 시작 시 이미 수정된 `StageScene.ts`의 보스 바닥 타일과 `AudioManager.ts`의 공용 Tone 컨텍스트/방어음 수정은 **현재 작업 트리가 기준**이다. HEAD로 복구하거나 새 코드로 통째로 덮어쓰지 않는다. [기존 검증](../test-plans/2026-10-12-boss-ground-and-audio.md)과 첨부 증거를 보존한다.
- [예전 compact 계획](./2026-10-01-world01-compact-scenes.md)의 T02 보스 arena/배경, T03 출구, T04 하트는 별도 미완료다. T03의 체크포인트 깃발 부분만 새 T03이 맡는다. 깃발의 예전 신규 SVG 안 대신 이번에 확인한 기존 atlas 재사용으로 구체화한다. 예전 Task 전체를 done으로 바꾸지 않는다.
- 코인 재획득 정책은 유지한다. 상점/의상과 클리어한 월드 재도전을 함께 설계하고 정상 반복 수급이 준비된 뒤 중복 적립을 제한한다. 이번에는 제한 로직·월드 재도전·상점 Task를 추가하지 않는다.
- 새로 발견한 별도 기능/정리 작업을 임의로 포함하지 않는다. 월드 2~5 신규 작곡, 보스 arena 크기 변경, 출구/수집품 시각 정리는 이번 완료 조건이 아니다.

## Execution and Reporting

`/memory-execute`에서 T01→T05를 순차 실행한다. 각 Task 검증을 통과하면 청사진의 한국어 메시지로 커밋하고 Task/Phase/current를 동기화한다. 기존 사용자 요청대로 타입·빌드·테스트 오류는 수정 후 계속 진행한다. 해소하지 못한 실행 장애나 실제 청음/기기 검증 미실시는 사실대로 기록한다.

실제 스피커로 듣지 않고 파형/이벤트만 확인한 경우 ‘청음 완료’로 쓰지 않는다. 계획 단계에서는 테스트를 실행한 것으로 표시하지 않는다.
