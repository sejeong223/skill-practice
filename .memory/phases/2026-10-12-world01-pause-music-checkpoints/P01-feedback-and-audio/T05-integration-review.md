# Task: T05 월드 1 화면·음악·체크포인트 통합 검증

## Status: pending

## Goal

보스전 원 제거, 두 신규 BGM, 체크포인트 깃발/차임, 일시정지가 실제 게임 흐름에서 함께 동작하는지 확인하고 Task별 한국어 커밋/진행 기록을 마무리한다.

## Decision Summary

- T01~T04 구현과 해당 테스트가 완료된 상태에서 경계 동작을 검증한다. 이미 통과한 검사는 변경/실패/미해결 우려가 있을 때만 반복한다.
- 실제 청음과 파형/이벤트 검사를 구분한다. 검증을 위해 제품에 디버그 화면이나 테스트 전용 진입 기능을 추가하지 않는다.
- 계획 시작 전에 있던 보스 바닥/방어음과 지갑 적립 정책을 유지해야 한다.

## Implementation

### I01. 검증 기록과 증거

- Related Files:
  - `.memory/test-plans/2026-10-12-world01-pause-music-checkpoints.md` :: 시나리오/결과/한계; new
  - `.memory/test-plans/assets/world01-feedback-*` :: 필요한 화면·오디오·관찰 결과; new, 실제 생성한 증거만
  - `src/game/data/worlds.ts`, `src/game/audio/AudioManager.ts`, `src/game/audio/musicArrangements.ts`, `src/game/audio/stageMusic.ts`, `src/game/scenes/StageScene.ts`, `src/game/systems/CheckpointSystem.ts`, `src/game/stages/StageEntityFactory.ts`, `src/components/game/GameShell.tsx`, `src/components/game/PauseOverlay.tsx`, `src/app/globals.css` :: 통합 결함이 확인될 때만 modify

#### Details

- **Signatures & Types**: 새 런타임 모델/API는 추가하지 않는다. 검증 표 필드는 `ID`, `시나리오`, `기대 결과`, `실제 결과`, `상태(pass/fail/not-run)`, `증거`다. 측정 기록에는 viewport, 실행 환경, stageId, 음악 키, transport 위치, 이벤트 횟수를 함께 적는다.
- **Execution Flow / Logic**: 실행 중인 개발 서버가 있으면 재사용한다. 없으면 `npm.cmd run dev`로 띄우고 서버/주소를 기록한다. 기존 사용자 서버를 중단하거나 포트를 뺏지 않는다. 브라우저 스크립트 또는 기존 테스트 도구를 재사용하되 실제 입력→게임 이벤트→오디오 출력 순서가 연결된 경로도 검증한다.
- **Error & Exception Handling**: 자동 검증/타입/빌드 오류는 원인을 수정하고 관련 검사부터 재실행한다. 해소 불가능한 도구/환경 제한은 실패와 구분하여 기록한다. 실제 스피커/이어폰 청음이나 실기기 터치를 수행하지 못했으면 해당 항목을 not-run으로 남긴다.
- **State Transition & Return**: 필수 기능 검증 통과 후 완료 처리한다. 미실시 주관적 청음/실기기 항목은 제한으로 명시하고 통과로 둔갑시키지 않는다.

### I02. 통합 시나리오

| ID | 시나리오 | 기대 결과 |
| :--- | :--- | :--- |
| R01 | 보스 첫 입장/재입장과 이전 원 위치 통과 | 노란 원 및 coin entity 0개, 숨은 지갑 적립 없음, 원래 타일 바닥 유지 |
| R02 | 일반 구간 간식 획득과 사망 후 재시작 | 기존 진짜/가짜 간식 구분 숨김과 첫 안전 간식 유지, 지갑 적립/재획득 정책 유지 |
| R03 | 오프닝→월드 1 일반 구간 | 오프닝은 기존 곡, 1~4단계는 world-01-peaceful, 동시에 한 곡만 재생 |
| R04 | 보스 첫 대사 완료/이미 본 대사/재입장 | 모두 world-01-calico 선택, 이전 boss/alley로 덮이지 않음, 대사 자동 진행 유지 |
| R05 | 보스 실패 후 4단계 마지막 체크포인트 복귀 | world-01-peaceful로 전환, 체크포인트 복원 정상, 복원 자체 차임 0번 |
| R06 | 두 신규 BGM 각각 1루프 이상 | 16마디 길이 맞음, 루프 클릭/끊김/중첩 없음. 평화로움/약한 긴장감 청음은 별도 상태 기록 |
| R07 | 일반 구간 일시정지 5초와 재개 | runtime/physics 정지, Tone ticks/position 유지, mute ramp 뒤 BGM 출력 없음, 재개 시 이어 재생 |
| R08 | 보스전 정지/재개 및 빠른 토글 10회 | 음악/게임/오버레이 상태 일치, 재생 개수 증가 없음, 생선 가시·방어 상태 회귀 없음 |
| R09 | 정지 중 pointerdown/keydown 또는 늦게 완료되는 unlock | AudioContext가 unlock되어도 paused=true 동안 BGM은 시작되지 않음 |
| R10 | 정지 화면 1280×720 및 390×844 | 프레임 중앙 일시정지/검은 60% 배경, HUD보다 위, 계속하기/Escape 동작, 가로세로 overflow 없음 |
| R11 | 정지 전후 장면 교체/초기화 확인창 | 새 장면에 정지 표시가 남지 않음, 초기화 창 z20이 정지층15 위, 취소/복귀 가능 |
| R12 | 2/4단계 체크포인트 접근/통과 | 빨간 반투명 판정 사각형 안 보임, 픽셀 깃발 바닥 정렬, 최초 저장+차임 한 번 |
| R13 | 체크포인트 머무르기/재통과/재시작 | 같은 snapshot에서 차임 추가0, 새 유효 활성화에서는1, 깃발 중복/잔상 없음 |
| R14 | BGM 중 체크포인트 차임과 보스 방어 3회 | 공용 Tone context 실제 출력, 차임/깡 식별 가능, 3회 깡 뒤 왼쪽 사모예드5마리, 네 번째 피격 HP 감소 |
| R15 | 보스 클리어·씬 종료·재진입 반복 | HP10 유지, 음악/gesture/subscription/source 누수와 과거 곡 재등장 없음 |

- R07/R09는 실제 Tone transport와 출력 노드의 무음/재개 구간을 관찰한다. mock 이벤트 횟수만으로 확인하거나 제품에 상시 녹음 기능을 넣지 않는다.
- R14는 실제 투사체와 밥그릇 충돌 경로도 확인한다. 임의 clang emit 검사만으로 대체하지 않는다. [이전 방어음 검증](../../../test-plans/2026-10-12-boss-ground-and-audio.md)을 참고한다.
- 실제 귀로 듣지 못한 음량/분위기 평가는 ‘출력 확인, 청음 미실시’로 분리한다.

### I03. 자동 검사와 메모리 동기화

- Related Files:
  - `scripts/boss-stage-content.test.mjs`, `scripts/stage-music.test.mjs`, `scripts/checkpoint-feedback.test.mjs`, `scripts/audio-pause.test.mjs` :: 신규 동작 검사; 필요 시 modify
  - `scripts/bowl-defense.test.mjs`, `scripts/samoyed-surge.test.mjs`, `scripts/fishbone-trajectory.test.mjs`, `scripts/calico-melee-hitbox.test.mjs`, `scripts/cutscene-auto-advance.test.mjs`, `scripts/snack-wallet.test.mjs`, `scripts/stage-progression.test.mjs` :: 기존 회귀; read-only unless 실제 결함 수정
  - `.memory/current.md`, 이 Phase의 `phase.md`, T01~T05, 상위 계획 :: 완료 상태; modify
  - `.memory/phases/2026-10-01-world01-compact-scenes/P01-world01-map-and-hud/T03-day-flag-and-invisible-exit.md` :: 깃발 부분 위임 결과만 갱신; modify

#### Details

- 최종 코드에서 아직 검증하지 않은 범위에 필요한 검사를 실행한다. 타입/lint/build가 T04 최종 코드에서 이미 통과했고 이후 문서만 바뀌었다면 결과를 인용한다.
- git diff를 검토해 작업 시작 전 보스 바닥/방어음 변경이 보존됐는지 확인한다. 이번 범위와 무관한 사용자 변경은 임의 커밋하지 않는다. 원래 미커밋이던 파일을 수정한 경우 기존 승인된 수정과 이번 수정의 경계를 커밋 설명에 남긴다.
- 각 Task의 한국어 커밋/검증 기록을 확인하고 T05를 커밋한다. 검증 통과 후에만 done으로 쓰고 Phase=5/5, current Active Task=없음으로 갱신한다.
- 예전 compact T03는 깃발 부분만 새 T03 완료를 링크한다. 출구 숨김 등이 남으므로 전체 done으로 만들지 않는다. 이전 완료된 gameplay-refinement 이력과 상점/재도전 정책도 보존한다.

## Acceptance Criteria

- [ ] 사용자 요청 4개와 필수 통합 시나리오의 검증 결과/증거가 남는다.
- [ ] 현재 변경의 타입/lint/build/자동 테스트가 통과한다.
- [ ] 기존 보스 바닥·방어음·HP10·방어3회·사모예드5마리·지갑 적립이 유지된다.
- [ ] Task별 한국어 커밋, Phase 진행률, current 포인터가 일치한다.
- [ ] 미실시 청음/실기기 확인은 명시하고 테스트 통과로 대신 주장하지 않는다.

## Validation

- PowerShell: `$taskTestFiles = @(rg --files scripts -g '*.test.mjs'); node --experimental-strip-types --test $taskTestFiles` — 기존/신규 자동 회귀.
- `npm.cmd run world01:maps:check` — 일반 구간 맵/간식/체크포인트 기준 보존.
- `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build` — 현재 코드 검사. 통과 후 새 코드 변경이 없으면 중복 실행하지 않는다.
- `git diff --check` — 문서/코드 공백 오류 없음.
- 브라우저 R01~R15와 실제 청음 범위를 기록한다.

## Commit Message

```text
test(world01): 음악과 일시정지 및 체크포인트 통합 동작을 검증한다

Plan: 2026-10-12-world01-pause-music-checkpoints
Phase: P01-feedback-and-audio
Task: T05-integration-review

- 보스 원 제거와 장면별 음악 및 체크포인트 피드백 검증
- 정지와 재개 및 잠금 해제 경계의 오디오 회귀 확인
- 기존 전투와 적립 정책을 보존하고 결과와 실행 포인터 동기화
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
