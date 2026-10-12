# Current Context

## Active Plan

[2026-10-12-world01-camera-exit-sfx](./plans/2026-10-12-world01-camera-exit-sfx.md)

## Active Phase

[P01](./phases/2026-10-12-world01-camera-exit-sfx/P01-player-feedback/phase.md)

## Active Task

[T03-new-feedback-audio](./phases/2026-10-12-world01-camera-exit-sfx/P01-player-feedback/T03-new-feedback-audio.md)

## Status

- T02: 974eb99; 2/3

## Next Step (IMPORTANT)

T03-new-feedback-audio

## Existing Worktree Baseline

- 시작 전에 이미 `src/game/scenes/StageScene.ts`의 보스 타일 바닥과 `src/game/audio/AudioManager.ts`의 공용 Tone 컨텍스트/방어음/gesture unlock 수정이 미커밋 상태였다. 실행 기준으로 보존했으며 이번 T02(`e3fd858`)에 포함했다.
- [보스 바닥 및 방어음 검증](./test-plans/2026-10-12-boss-ground-and-audio.md)과 `.memory/test-plans/assets/world01-boss-ground.png`, `world01-bowl-clang-fixed.json`, `world01-bowl-clang-fixed.webm`을 보존한다.
- 이전 메모리 문서의 미커밋 상점/재도전 정책 보완도 보존한다. 새 Task와 무관한 변경을 임의 정리하거나 전체 파일을 HEAD로 복원하지 않는다.

## Completed Work

- [월드 1 화면·음악·체크포인트](./plans/2026-10-12-world01-pause-music-checkpoints.md): T01 `ec7e532`, T02 `e3fd858`, T03 `5f1a388`, T04 `d464ce9`, T05 `093d458`. 전체5/5 완료, 다음 Task 없음. 자동35건·맵·타입·lint·빌드 및 브라우저 통합 결과는 [검증 기록](./test-plans/2026-10-12-world01-pause-music-checkpoints.md)에 있다. 실제 청음/실기기는 미실시다.
- [월드 1 이동 흐름·간식·삼색이 전투 개선](./plans/2026-10-12-world01-gameplay-refinement.md): T01 `c253d57`, T02 `3a435d1`, T03 `9eb4cf7`, T04 `eb06803`, T05 `4e6e312`, 완료 정리 `f1329e7`. 완료 상태를 유지한다.
- 당시 자동21건·타입·lint·빌드·브라우저 통합 검증은 [해당 기록](./test-plans/2026-10-12-world01-gameplay-refinement.md)에 있다. 이 결과를 새 작업의 검증 결과로 대신 쓰지 않는다. 실제 스피커/이어폰 청음과 실제 모바일 터치 검증은 당시 미실시였다.
- [컷신 대사 자동 진행](./plans/2026-10-06-cutscene-auto-advance.md): `b55e26c`, `1b2f230`, `aa48a8c`, 완료.

## Previous Work Pointer

- [예전 compact Phase](./phases/2026-10-01-world01-compact-scenes/P01-world01-map-and-hud/phase.md): T01/T03은 최신 계획으로 대체됐다. T02 보스 arena 크기/배경, T04 하트는 별도 미완료다.
- 깃발은 `5f1a388`, 출구 표시 제거·끝 이탈 전환·깃발 부활은 `974eb99`에서 완료했다. 옛 T03은 요구가 바뀌어 superseded이며 재실행하지 않는다.
- 새 계획 완료 뒤 옛 계획을 자동 재개하지 않는다. 재개 요청이 오면 T02부터 검토하되 기믹32개·보스HP10·새 간식 외형·최근 바닥/방어음 수정을 옛 기준으로 되돌리지 않는다.

## Deferred Shop and Replay Policy

- [후속 로드맵](./plans/2026-10-12-world01-gameplay-refinement.md#follow-up-roadmap--의상-상점과-반복-수급)을 유지한다. 현재 사망·재시작 후 같은 코인 재획득/재적립은 허용한다.
- 상점·코기 의상 구매/착용을 계획할 때 클리어한 월드 재도전도 함께 설계한다. 이전 월드에 돌아가는 데 전체 게임 엔딩이나 진행 초기화를 요구하지 않는다.
- 정상 반복 수급 경로가 준비·검증된 뒤에만 같은 스테이지 도전 내 사망/재시작/재접속 중복 적립을 제한한다. 스테이지 클리어 뒤 새 도전의 재획득은 허용한다.
- 이 후속 정책을 위한 구현 Task는 아직 없다. 이번 오디오/시각 피드백 계획에서 코인 제한만 먼저 실행하지 않는다. 상점 UI·의상·재도전 선택 단위·회차 저장 모델은 후속 상세 계획에서 정한다.
