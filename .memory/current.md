# Current Context

## Active Plan

[월드 1 보스전 원·일시정지·음악·체크포인트](./plans/2026-10-12-world01-pause-music-checkpoints.md)

## Active Phase

[P01 월드 1 화면과 소리 피드백](./phases/2026-10-12-world01-pause-music-checkpoints/P01-feedback-and-audio/phase.md)

## Active Task

[T02-stage-music](./phases/2026-10-12-world01-pause-music-checkpoints/P01-feedback-and-audio/T02-stage-music.md)

## Status

- T01 완료: ec7e532. 진행률 1/5.
- 사용자 요청에 따라 다음 Task를 즉시 이어서 실행한다.

## Next Step (IMPORTANT)

T02-stage-music 청사진을 읽고 순차 구현·검증·한국어 커밋을 진행한다.

## Existing Worktree Baseline

- 시작 전에 이미 `src/game/scenes/StageScene.ts`의 보스 타일 바닥과 `src/game/audio/AudioManager.ts`의 공용 Tone 컨텍스트/방어음/gesture unlock 수정이 미커밋 상태였다. 이 변경을 실행 기준으로 삼고 되돌리지 않는다.
- [보스 바닥 및 방어음 검증](./test-plans/2026-10-12-boss-ground-and-audio.md)과 `.memory/test-plans/assets/world01-boss-ground.png`, `world01-bowl-clang-fixed.json`, `world01-bowl-clang-fixed.webm`을 보존한다.
- 이전 메모리 문서의 미커밋 상점/재도전 정책 보완도 보존한다. 새 Task와 무관한 변경을 임의 정리하거나 전체 파일을 HEAD로 복원하지 않는다.

## Completed Work

- [월드 1 이동 흐름·간식·삼색이 전투 개선](./plans/2026-10-12-world01-gameplay-refinement.md): T01 `c253d57`, T02 `3a435d1`, T03 `9eb4cf7`, T04 `eb06803`, T05 `4e6e312`, 완료 정리 `f1329e7`. 완료 상태를 유지한다.
- 당시 자동21건·타입·lint·빌드·브라우저 통합 검증은 [해당 기록](./test-plans/2026-10-12-world01-gameplay-refinement.md)에 있다. 이 결과를 새 작업의 검증 결과로 대신 쓰지 않는다. 실제 스피커/이어폰 청음과 실제 모바일 터치 검증은 당시 미실시였다.
- [컷신 대사 자동 진행](./plans/2026-10-06-cutscene-auto-advance.md): `b55e26c`, `1b2f230`, `aa48a8c`, 완료.

## Previous Work Pointer

- [예전 compact Phase](./phases/2026-10-01-world01-compact-scenes/P01-world01-map-and-hud/phase.md): T01은 앞선 개선 계획으로 대체됐다. T02 보스 arena/배경, T03 출구, T04 하트는 별도 미완료다.
- 예전 T03의 체크포인트 깃발 부분은 **이번 T03**으로 위임한다. 기존 픽셀 깃발 재사용으로 구체화했으며 출구 숨김을 같이 실행하거나 옛 Task 전체를 done으로 만들지 않는다.
- 새 계획 완료 뒤 옛 계획을 자동 재개하지 않는다. 재개 요청이 오면 T02부터 검토하되 기믹32개·보스HP10·새 간식 외형·최근 바닥/방어음 수정을 옛 기준으로 되돌리지 않는다.

## Deferred Shop and Replay Policy

- [후속 로드맵](./plans/2026-10-12-world01-gameplay-refinement.md#follow-up-roadmap--의상-상점과-반복-수급)을 유지한다. 현재 사망·재시작 후 같은 코인 재획득/재적립은 허용한다.
- 상점·코기 의상 구매/착용을 계획할 때 클리어한 월드 재도전도 함께 설계한다. 이전 월드에 돌아가는 데 전체 게임 엔딩이나 진행 초기화를 요구하지 않는다.
- 정상 반복 수급 경로가 준비·검증된 뒤에만 같은 스테이지 도전 내 사망/재시작/재접속 중복 적립을 제한한다. 스테이지 클리어 뒤 새 도전의 재획득은 허용한다.
- 이 후속 정책을 위한 구현 Task는 아직 없다. 이번 오디오/시각 피드백 계획에서 코인 제한만 먼저 실행하지 않는다. 상점 UI·의상·재도전 선택 단위·회차 저장 모델은 후속 상세 계획에서 정한다.
