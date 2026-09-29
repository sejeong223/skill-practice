# Task: T05 World 1 검증과 수동 플레이테스트

## Status: superseded

> 2026-09-29: [월드 1 낮 경로와 삼색이 보스 계획](../../../plans/2026-09-29-world01-daylight-calico.md)의 T02·T03·T07로 교체됨. 아래 내용은 옛 66개 돌발 함정 설계 기록이다.

## Goal

World 1 일반 4개 맵이 최소 기믹 수량, 무힌트 정책, 안전 구간, 단일 루트, checkpoint·exit 위치, chain 참조를 만족하는지 자동 검증하고, 사람이 실제로 순서대로 플레이해 사망·재시작·파훼 가능성을 확인한다.

## Implementation

### I01. World gimmick validator

- Related Files:
  - `src/game/data/validateMaps.ts` :: `validateStageMap`, `validateCampaignMaps`; modify
  - `src/game/data/validateContent.ts` :: World gimmick registry integration; modify
  - `src/game/debug/MapDebugOverlay.ts` :: gimmick id/last outcome display; modify

#### Details

- validator는 worldId별 `gimmicks.length >= 30`을 검사하고 World 1은 `>=54`와 계열별 최소 수량을 검사한다.
- `sectionIndex`가 1 또는 5인 gimmick, `hintPolicy !== "none"`, `lethal !== true`, missing counterplay/outcome, missing objectId, missing chain target은 오류다.
- `forward-jump-wall`의 counterplay가 `move-backward`, `ground-collapse`가 `jump-before-zone`, `ground-rise`가 `micro-forward-then-back`, name bubble이 `mash-jump + requiredPresses:100`인지 검사한다.
- safe-entry/safe-exit의 lethal trap, forced movement, blocking chain은 기존 validator와 함께 오류로 보고한다.
- 개발 오버레이에는 `gimmickId`, trigger 상태, counterpresses, last outcome을 표시하되 production에는 생성하지 않는다.

### I02. 수동 플레이테스트 체크리스트

- Related Files:
  - `.memory/test-plans/2026-09-23-world01-playtest.md` :: test matrix and evidence; new
  - `.memory/phases/2026-09-23-legendary-rib-world-campaign/P01-world01-back-alley/phase.md` :: completion evidence; modify

### I03. 코기 옆태 걷기 애니메이션과 흔들림 제거

- Related Files:
  - `src/game/assets/assetManifest.json` :: `corgi-run` spritesheet metadata; modify
  - `public/assets/pixel/characters/corgi/corgi-run.png` :: generated side-view walk cycle; new
  - `src/game/entities/Player.ts` :: default player texture, facing and collision alignment; modify
  - `src/game/entities/PlayerAnimator.ts` :: run animation and stable idle fallback; modify

#### Details

- 기존 승인 코기의 디자인을 참조해 오른쪽을 향한 옆모습 4프레임 걷기 스프라이트를 생성한다. 왼쪽 이동은 `flipX`로 반전한다.
- 좌우 이동 중 지면에 있을 때 Phaser의 `corgi-run` 애니메이션을 재생하고, 정지·공중 상태는 걷기 0번 프레임으로 고정한다.
- 애니메이션 에셋이 없을 때 실행되던 시간 기반 기울기·세로 스케일 fallback을 제거한다. 프레임마다 캐릭터의 각도와 크기는 바뀌지 않아야 한다.
- 수동 확인에 양방향 걷기, 방향 전환, 정지/공중 상태에서의 고정 프레임, 발 기준선 안정성을 추가한다.

### I04. 플레이 중 상시 상태창과 개발 문구 제거

- Related Files:
  - `src/components/game/GameShell.tsx` :: status-panel open state; modify
  - `src/components/game/GameOverlay.tsx` :: conditional settings panels; modify
  - `src/components/game/Hud.tsx` :: explicit status/settings toggle; modify
  - `src/game/scenes/StageScene.ts` :: remove always-visible internal status text; modify

#### Details

- 플레이 시작 시 캐릭터/설정 패널은 닫고 간단한 HUD만 표시한다. HUD의 상태 버튼으로 명시적으로 열고 닫는다.
- 안전 구역이 아닐 때 `SHOP CLOSED` 안내 패널을 항상 표시하지 않는다.
- stage/coin/death/checkpoint 정보를 플레이 화면에 상시 그리던 Phaser `statusText`는 제거한다. 개발 정보는 F1 진단 오버레이에 한정한다.

#### Details

- 각 stage에서 section 1 진입과 section 5 탈출이 즉사 없이 가능한지 확인한다.
- 최소 한 번씩 다음의 실패·성공 쌍을 기록한다: forward walk vs backward start, forward jump vs backward movement, walk into collapse vs pre-jump, rise timer timing, fake coin avoid, true checkpoint vs fake checkpoint, box jump-retreat, cloud retreat, white spike precision, no-jump pigeon, Space 99/100 mash.
- 코기 옆태 걷기: 좌우 입력 시 프레임 애니메이션·좌우 반전, 정지/공중 시 프레임 고정, 회전·스케일·발 기준선 흔들림이 없는지 확인한다.
- 모든 사망은 즉시 재시작되며, checkpoint 이전의 stage coins는 0, banked coins는 유지, 기믹 snapshot과 death count는 결정된 계약을 따른다.
- 같은 seed로 재시작한 두 시도의 trigger 좌표·연쇄 순서·death outcome이 같아야 한다.
- 단일 메인 루트에서 실제로 갈림길이나 지름길이 생기지 않았는지 화면 녹화 또는 스크린샷으로 확인한다.

## Acceptance Criteria

- [ ] World 1 일반 4개 report의 errors가 0이다.
- [ ] World 1 기믹 수량과 계열별 반복 횟수가 계획을 충족한다.
- [ ] 자동 검증으로 잡히지 않는 조작감·충돌 겹침·전경 가림을 수동 확인했다.
- [ ] 수동 테스트 결과가 `.memory/test-plans/2026-09-23-world01-playtest.md`에 기록됐다.

## Validation

- `npm.cmd run lint`
- `npm.cmd run build`
- `node` 또는 앱 내 diagnostic으로 `validateCampaignMaps(CONTENT_REGISTRY)` 실행
- `npm.cmd run dev` 후 World 1 stage 1→4 순서 플레이테스트

## Commit Message

```text
test(map): 월드1 억까 검증과 플레이테스트 기준 추가

Plan: 2026-09-23-legendary-rib-world-campaign
Phase: P01-world01-back-alley
Task: T05-world01-validation-and-playtest

- Validate gimmick counts, hidden-hint rules, and safe sections
- Record World 1 manual counterplay and checkpoint regression tests
```

## Progress

- [x] 자동 검증기·F1 진단·F2/F3 검수 화면·수동 테스트 체크리스트 구현
- [x] 자동 검증 통과 (`world01:maps:check`, `validateCampaignMaps`, lint, build)
- [x] 코기 옆태 4프레임 걷기 애니메이션, 기본 상태 패널 숨김, 좌우 브라우저 스모크 검증
- [ ] 네 스테이지 맵 디자인 사용자 검수 및 실제 플레이테스트
- commit: pending — 맵 검수 및 실제 플레이테스트 전에는 완료/커밋하지 않음
