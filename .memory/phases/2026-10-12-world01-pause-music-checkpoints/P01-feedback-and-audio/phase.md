# Phase: P01 월드 1 화면과 소리 피드백

## Status: done

## Goal

보스전 원 제거, 장면별 음악, 체크포인트 깃발/차임, 일시정지 표시와 음악 제어를 구현하고 함께 검증한다.

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done` | 월드 1 보스 기본 코인 생성 제거 | [T01](./T01-boss-coin-cleanup.md) |
| T02 | `done` | 일반 구간/삼색이 BGM 제작과 장면별 라우팅 | [T02](./T02-stage-music.md) |
| T03 | `done` | 실제 체크포인트 픽셀 깃발과 최초 활성화 차임 | [T03](./T03-checkpoint-flag-chime.md) |
| T04 | `done` | BGM 정지/재개 및 중앙 일시정지 오버레이 | [T04](./T04-pause-overlay-audio.md) |
| T05 | `done` | 장면 전환·음악·일시정지·체크포인트 통합 검증 | [T05](./T05-integration-review.md) |

## Progress

- done: 5/5 (active: 없음)
- 전체 Task 완료. T02→T03→T04는 같은 AudioManager를 순차 수정한다.

## Guardrails

- 계획 수립 당시에는 `.memory/` 문서만 작성했고, 후속 `/memory-execute` 요청으로 구현·검증을 진행했다.
- 실행 시 기존 미커밋 보스 바닥/방어음 수정을 보존하며 한국어 커밋을 Task별로 남긴다.
- 음악 도구는 기존 Tone.js/Web Audio. 체크포인트 이미지도 확인된 기존 atlas를 재사용한다.
- 공유 AudioContext를 suspend/close하지 않고 해당 음악의 재생 위치/출력을 제어한다.
- 체크포인트 이미지는 판정과 분리하여 ID·스냅샷·재시작 동작을 유지한다.
- 완료된 이전 계획과 미완료 compact 계획을 일괄 재개/완료 처리하지 않는다.
