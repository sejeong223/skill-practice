# Task: T04 인트로 통합·회귀 검증

## Status: pending

## Goal

픽셀 인트로의 장면·텍스트·사운드·전체 창 레이아웃을 첫 실행과 재시청 흐름에서 검증하고 World 1 진입 및 기존 캠페인 회귀를 확인한다.

## Decision Summary

- 자동화 검증은 lint/build/map validation이며 브라우저 실제 시각 검수는 별도로 기록한다.
- 화면 크기에 맞춘 크기 조절은 허용하되 논리 화면비를 바꾸거나 고정 좌표 UI를 캔버스 밖으로 보내지 않는다.

## Implementation

### I01. 수동/자동 회귀 체크리스트

- Related Files:
  - .memory/test-plans/2026-09-24-cinematic-pixel-intro-validation.md :: 재현 절차·결과·스크린샷 위치; new
  - .memory/phases/2026-09-24-cinematic-pixel-intro/P02-cinematic-home-scene/phase.md :: 결과와 완료 여부; modify
  - .memory/current.md :: 다음 active task 및 기존 T05 보류 상태; modify

#### Details

- 체크리스트에는 첫 로드/첫 재생, 11개 비트 대사 순서, actor/camera animation, autoplay 차단/해제, cutscene 뒤 타이틀·이름, World 1 stage 1 화면을 별도 항목으로 기록한다.
- viewport는 1920×1080과 1280×720의 16:9 전체 화면, 2560×1080 ultrawide, 1280×800의 비표준 화면비를 검수한다. 프레임 경계, themed bars, 캔버스와 DOM 대화창 정렬, 텍스트 잘림을 캡처한다.
- 브라우저 localStorage를 초기화한 첫 플레이에서 건너뛰기 버튼/키가 먹히지 않는지 확인하고, 인트로를 완료한 뒤 새로고침한 재생에서만 건너뛰기가 나타나는지 확인한다.
- 이름 입력 20자 경계, 공백 입력, 특수문자 필터, 사용자 지정 이름이 시작 이벤트와 progress에 저장되는지 확인한다.
- World 1 입장 후 상태창은 기본 닫힘, 플레이 HUD는 표시, 콘솔 오류 및 필수 에셋 404가 없어야 한다. 전체 월드 플레이테스트 자체는 이 계획에 포함하지 않는다.
- 같은 browser smoke에서 이전 World 1 map checks, 씬 종료 뒤 event subscription 및 AudioContext timer 잔존 여부를 점검한다.
- 실제 결과와 브라우저/화면비/이름/성공 여부/스크린샷을 체크리스트에 기록한다. 실패가 있으면 관련 Task로 돌아가 수정하고 다시 실행한다.

### I02. 필수 자동 검증

- Related Files:
  - package.json scripts — lint/build/world01:maps:check; read-only
  - src/game/config.ts, src/game/scenes/PreloadScene.ts, src/game/scenes/IntroScene.ts — 앱 진입 회귀; read-only for test

#### Details

- npm.cmd run lint와 npm.cmd run build를 모두 통과시킨다.
- npm.cmd run world01:maps:check가 World 1 기존 맵/기믹 수 검증에서 통과해야 한다.
- 자동화 검증은 이미지의 품질, 대사 읽기 용이성, 배우의 시각적 일관성을 승인하지 않는다. 해당 항목은 사용자와 실제 화면을 보며 확인한다.

## Acceptance Criteria

- [ ] 11개 비트가 35~40초 안에 중복/건너뜀/잔류 타이머 없이 한 번 재생된다.
- [ ] 16:9 캔버스와 DOM overlay는 viewport 경계까지 이어지며 ultrawide/1280×800에서 비율이 보존되고 UI가 잘리지 않는다.
- [ ] 재시청만 skip, 첫 플레이 자동 완료, 이름 입력 후 World 1 진입이 검증된다.
- [ ] lint, production build, World 1 map check가 모두 통과한다.
- [ ] 브라우저 실제 테스트 결과와 증거 경로가 checklist에 기록되고 사용자가 미리보기와 실행 장면을 확인할 수 있다.
- [ ] 원래 current pointer가 가리키던 World 1 T05는 사용자 맵 검수 완료 전까지 pending 상태로 보존된다.

## Validation

- npm.cmd run lint — 기대: exit code 0.
- npm.cmd run build — 기대: exit code 0.
- npm.cmd run world01:maps:check — 기대: 기존 World 1 map schema/check 통과.
- npm.cmd run dev — 위 체크리스트 해상도와 진행 흐름을 실제 브라우저에서 검증하고 기록한다.

## Commit Message

    test(intro): 시네마틱 인트로와 화면비 회귀 검증

    Plan: 2026-09-24-cinematic-pixel-intro
    Phase: P02-cinematic-home-scene
    Task: T04-intro-integration-validation

    - 첫 실행·재시청·이름 입력·World 1 진입 체크리스트 추가
    - 전체 화면비와 캠페인 진입 회귀 결과 기록

## Progress

- [ ] 자동 lint/build/map validation
- [ ] 화면비·컷신·오디오·입력 브라우저 스모크
- [ ] 테스트 증거와 결과 기록
- commit: pending
