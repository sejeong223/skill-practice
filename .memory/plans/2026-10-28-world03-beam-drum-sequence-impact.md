# Plan: 월드 3 후반 장애물·체크포인트·철근 충돌음

## Goal

월드 3 일반 스테이지의 철근을 드럼통 통과 직후로 옮기고, 후반에 고정 장애물을 2개씩 더해 8개에서 10개로 늘린다. 코기는 새 배치를 점프로 통과하고 철근을 빠르게 왼쪽으로 돌아 피할 수 있어야 한다. 활성화한 마지막 체크포인트 이후의 모든 사망은 그 지점에서 부활한다. 철근이 바닥이나 코기에 닿을 때 금속 구조물이 실제로 부딪히는 듯한 짧은 `꽝!` 소리를 정확히 한 번 듣는다.

## Source of Truth

- [이번 배치·효과음 결정](../decisions/2026-10-28-world03-beam-drum-sequence-impact.md)
- [기존 무예고 철근 낙하·뒷걸음질 결정](../decisions/2026-10-27-world03-falling-steel-beam.md) — 이번 문서와 충돌하지 않는 규칙 유지
- 현재 `src/game/data/world03SteelBeams.ts`, `src/game/data/world03Construction.ts`, `src/game/systems/World03SteelBeamDropSystem.ts`, `src/game/systems/CheckpointSystem.ts`, `src/game/systems/RestartController.ts`, `src/game/audio/AudioManager.ts` 및 해당 테스트가 실행 기준이다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 후반 장애물·낙하 좌표, 마지막 체크포인트 부활, 금속 충돌음과 재생 연결 | [P01](../phases/2026-10-28-world03-beam-drum-sequence-impact/P01-beam-sequence-impact/phase.md) |

## Task Order and Boundary

| Task | Output | Dependency |
| :--- | :--- | :--- |
| T01 | 1/2/3/3 낙하 지점 재배치, 각 스테이지 후반 장애물 2개 추가, 공간·점프·회피 검사 | 없음 |
| T02 | 월드 3 체크포인트 활성화·스냅샷·사망 부활 경로 검증과 수정 | T01 후반 구간의 사망 회귀를 함께 확인 |
| T03 | 재현 가능한 금속 충돌 WAV, 오디오 등록·출처 기록·자산 검사 | T02와 독립; T02 커밋 뒤 실행 |
| T04 | 명중 또는 바닥 충돌 시 단일 효과음 이벤트, 일반 사망음 중복 억제, 일시정지·재시작 회귀 검사 | T01·T03 |

## Scope and Existing Work

- 계획 단계에서는 `.memory/` 문서만 작성한다. 운영 코드·그림·오디오 파일은 각 Task 실행 때 만든다.
- 기존 미커밋 월드 2 보스·HUD·피루엣 및 직전 월드 3 인트로 시점 수정은 보존한다. 실행 시 Task 파일에 명시한 경로만 스테이징한다.
- 좌표가 판정 영역과 겹치지 않아도 드럼통 다음 철근·꺼지는 바닥과 출구 앞 2개 장애물을 실제 조작으로 통과할 수 있는지 확인해야 한다. 특히 스테이지 2·4의 철근 뒤 좁은 간격과 마지막 180px·150px 장애물 간격은 T01의 필수 게이트다.
- 체크포인트 부활 실패의 원인은 정적 코드만으로 확정되지 않았다. T02에서 `checkpoint-reached` 여부, `CheckpointSystem.getSnapshot()`, 사망 직전 runtime 체크포인트 ID, `RestartController` 부활 좌표를 순서대로 재현해 확인한다. 스냅샷이 없으면 시작점을 택하는 기존 fallback을 그대로 두되, **이미 활성화한 체크포인트**는 사망 직전까지 보존한다.
- 이전 검증 기록에는 월드 3 인트로 뒤 진행이 멈춘 브라우저 세션이 있다. 사용자 결정에 따라 인트로 진행 문제 자체는 이번 계획에 포함하지 않는다. 수동 검증이 막히면 **격리된 테스트 저장**에서 `world-03-intro`를 시청 완료로 표시해 기존 개발 모드의 스테이지 1 직접 시작 경로를 사용하고, 원래 사용자 저장은 건드리지 않는다.
