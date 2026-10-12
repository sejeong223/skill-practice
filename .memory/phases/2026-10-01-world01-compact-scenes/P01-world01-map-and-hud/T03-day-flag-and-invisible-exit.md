# Task: T03 낮 색상의 체크포인트 깃발과 보이지 않는 출구

## Status: pending

## Goal

월드 1의 두 실제 체크포인트에 픽셀 깃발을 표시하고, 스테이지 사이를 잇는 반투명 출구 사각형을 숨긴다. 물리 겹침과 진행·재시도 동작은 유지한다.

## Decision Summary

- 기존 월드 1 props atlas의 `fake-checkpoint` 깃발 형태를 참고하되, 실제 체크포인트는 밝은 낮 색상으로 구분한다.
- 월드 1에만 적용한다. 다른 월드의 임시 체크포인트·출구 시각은 건드리지 않는다.
- 월드 1 보스맵의 검증용 출구도 숨겨 보스 arena에 사각형이 나타나지 않게 한다.

## Implementation

### I01. 낮 색상의 픽셀 깃발 에셋

- Related Files:
  - `public/assets/pixel/props/world-01/world-01-props.png` :: 기존 깃발 실루엣 참조; read-only
  - `public/assets/pixel/props/world-01/checkpoint-day-flag.svg` :: 픽셀 깃발; new
  - `src/game/assets/assetManifest.json` :: 깃발 이미지 등록; modify

#### Details

- **Signatures & Types**: manifest 항목은 `key="world-01-checkpoint-day-flag"`, `kind="image"`, `url="/assets/pixel/props/world-01/checkpoint-day-flag.svg"`, `worldId="world-01"`, `required=true`.
- **Data & Schema Fields**: SVG는 `viewBox="0 0 48 120"`, `width=48`, `height=120`, `shape-rendering="crispEdges"`. 투명 배경 위에 짙은 갈색 외곽/깃대 `#5f3942`, 크림빛 천 `#fff1bb`, 낮색 노랑 `#f4d778`, 접힌 부분 `#d49b4d`로 깃발 실루엣을 만든다. 깃대가 아래까지 이어지고 윗부분에 물결치는 사각 픽셀 깃발을 배치한다. 외곽 직사각형 패널이나 투명색 상자를 넣지 않는다.
- **Execution Flow / Logic**: 기존 atlas의 `fake-checkpoint` 프레임은 가짜 체크포인트용이므로 수정하지 않는다. 새 SVG가 실제 체크포인트 전용임을 키와 파일명으로 분리한다. Phaser 이미지 로더가 SVG를 원본 픽셀 크기로 표시하도록 캔버스에서 `setDisplaySize(48,120)`을 사용한다.
- **Failure/State**: 에셋이 없으면 진짜 체크포인트가 표시되지 않으므로 `required=true`와 수동 로드 확인을 적용한다. 기존 atlas 프레임 키와 겹치지 않는다.

### I02. 판정 영역과 표현 분리

- Related Files:
  - `src/game/stages/StageEntityFactory.ts` :: `createCheckpoint`, `createExit`; modify
  - `src/game/stages/StageRuntime.ts` :: `buildFromMap`의 중심 좌표 전달/엔티티 정리 확인; read-only
  - `src/game/scenes/StageScene.ts` :: `checkpoint`·`exit` overlap 사용 확인; read-only

#### Details

- **Signatures & Types**: `createCheckpoint(scene: Phaser.Scene,id: string,x: number,y: number): Phaser.GameObjects.Rectangle`; `createExit(scene: Phaser.Scene,id: string,x: number,y: number): Phaser.GameObjects.Rectangle`. 반환 타입과 `stageEntityKind`/`entityId` 데이터는 유지한다.
- **Execution Flow / Logic**:
  1. 정확히 `world-01-stage-2-checkpoint`와 `world-01-stage-4-checkpoint`에만 기존 크기 18×120 정적 Arcade 사각형 body를 만든 뒤 `setVisible(false)`로 숨긴다. `x/y`는 `StageRuntime.buildFromMap`에서 object 중심으로 전달되는 값이다.
  2. 별도 깃발 이미지를 같은 중심 `(x,y)`에 48×120 크기, depth 5로 그린다. 이미지 자체에는 충돌을 추가하지 않는다. 정적 body 사각형의 `destroy` 이벤트에 이미지 파괴를 연결해 씬 재시작·스테이지 이동 때 유령 깃발이 남지 않게 한다.
  3. 나머지 체크포인트 ID는 기존 직사각형과 정적 body를 유지한다. 월드 1 출구 ID `world-01-stage-[1-4]-exit` 및 `world-01-stage-boss-exit`의 사각형은 `setVisible(false)`로 숨기되 Arcade 정적 body와 `stageEntityKind="exit"`를 유지한다.
  4. 일반 맵에서 플레이어가 출구 body와 겹치면 기존 `StageScene`의 `runtime.complete()`가 호출되어 다음 스테이지로 이동한다. 보스 출구 겹침은 기존처럼 무시한다. 체크포인트 겹침은 `activateCheckpoint(record.id)`를 호출한다.
- **Failure/State**: 깃발의 장식 이미지를 따로 만든 경우 `StageRuntime.clearEntities()`가 body만 파괴한다. 반드시 body 소멸에 이미지를 연결한다. `setVisible(false)`는 물리 body를 끄지 않으므로 overlap 동작을 유지한다. 절대 `setActive(false)` 또는 body 제거로 출구를 숨기지 않는다.

## Acceptance Criteria

- [ ] 스테이지 2/4 실제 체크포인트에 밝은 픽셀 깃발이 보이고, 기존 어두운 반투명 체크포인트 사각형은 보이지 않는다.
- [ ] 일반 스테이지 1~4 출구와 보스맵의 검증용 출구에 반투명 사각형이 보이지 않는다.
- [ ] 깃발을 지나면 체크포인트가 활성화되고, 일반 맵 끝으로 가면 기존처럼 다음 스테이지로 넘어간다.
- [ ] 스테이지를 재시작하거나 다른 씬으로 이동해도 깃발 이미지가 중복·잔류하지 않는다. 월드 2~5의 엔티티 시각과 진행 동작은 유지된다.

## Validation

- `npx tsc --noEmit` → Phaser 객체와 정적 body 타입 오류 없음.
- `npm run lint` → SVG 등록 및 엔티티 코드 린트 오류 없음.
- `npm run build` → 필수 깃발 에셋과 화면 코드 빌드 통과.
- `npm run test:progression` → 월드 1 출구 연결·저장 ID 회귀 통과.
- `npm run dev` → 스테이지 2·4 체크포인트 접촉/사망 재시작, 스테이지 1~4 출구 접촉, 보스전 우측 출구 시각을 직접 확인.

## Commit Message

```text
feat(world01): show day checkpoint flags and hide exit markers

Plan: 2026-10-01-world01-compact-scenes
Phase: P01-world01-map-and-hud
Task: T03-day-flag-and-invisible-exit

- Add a bright pixel flag for the two real checkpoints
- Keep checkpoint and exit overlap bodies while hiding placeholder rectangles
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
