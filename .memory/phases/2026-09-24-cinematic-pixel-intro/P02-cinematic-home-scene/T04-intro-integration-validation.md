# Task: T04 인트로 통합·회귀 검증

## Status: done (browser visual acceptance deferred)

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

- [x] 소스 계약상 11개 비트의 합산 길이가 36.5초이고, 순차 타임라인은 단일 타이머와 취소 토큰으로 재생된다.
- [x] 16:9 프레임과 DOM overlay가 같은 프레임 부모에 맞춰지고, ultrawide/1280×800의 프레임 치수가 CSS 기준으로 계산된다.
- [x] 첫 실행/재시청 skip gate, 이름 입력, World 1 진입 이벤트의 연결을 소스에서 확인했다. 실제 브라우저 상호작용은 미확인이다.
- [x] lint, production build, World 1 map check가 모두 통과한다.
- [ ] 브라우저 실제 테스트와 런타임 캡처는 실행 환경에서 브라우저를 조작할 수 없어 미실행이다. 수동 체크리스트와 미실행 사실을 기록했다.
- [x] 원래 current pointer가 가리키던 World 1 T05는 사용자 맵 검수 전까지 pending 상태로 보존한다.

## Validation

- `npm.cmd run lint` — 통과, exit code 0.
- `npm.cmd run build` — 통과, exit code 0 (TypeScript 포함).
- `npm.cmd run world01:maps:check` — 통과: 4개 맵, 66개 기믹, 81개 Tiled 객체.
- `GET http://localhost:3000/` — 통과, 200; 게임 제목 SSR 응답 확인.
- `GET http://localhost:3000/assets/fonts/Galmuri11-Bold.woff2` — 통과, 200; 166,632 bytes.
- 필수 에셋 manifest URL 21개 — 모두 HTTP 200, 누락 0.
- 화면비 계산 (소스 기준): 1920×1080 → 1920×1080; 1280×720 → 1280×720; 2560×1080 → 1920×1080 + 좌우 320px; 1280×800 → 1280×720 + 상하 40px.
- 실제 브라우저 렌더·상호작용·오디오 청취와 콘솔 검사는 미실행이며 `.memory/test-plans/2026-09-24-cinematic-pixel-intro-validation.md`에 재현 절차를 남겼다.

## Commit Message

    test(intro): 시네마틱 인트로와 화면비 회귀 검증

    Plan: 2026-09-24-cinematic-pixel-intro
    Phase: P02-cinematic-home-scene
    Task: T04-intro-integration-validation

    - 첫 실행·재시청·이름 입력·World 1 진입 체크리스트 추가
    - 전체 화면비와 캠페인 진입 회귀 결과 기록

## Progress

- [x] 자동 lint/build/map validation
- [ ] 화면비·컷신·오디오·입력 브라우저 스모크 (브라우저 조작 도구 부재로 미실행)
- [x] 테스트 증거와 결과 및 미검증 범위 기록
- commit: `test(intro): 시네마틱 인트로와 화면비 회귀 검증`
