# Task: T02 첫 스테이지 연속 모래 바닥과 이름 변경

## Status: done

## Goal

월드 2 첫 스테이지의 기존 갈색 임시 발판을 연속된 모래 바닥 이미지와 일치하는 충돌면으로 바꾸고, HUD 이름을 `지옥의 동네 놀이터`로 바꾼다.

## Decision Summary

- T01의 필수 이미지 키 `world-02-sand-floor`와 정확히 512×216 PNG가 존재한다는 전제다.
- 첫 스테이지에서만 x=0..3840, y=504의 연속 바닥을 적용한다. 나머지 월드/스테이지의 맵·발판·함정·제목은 보존한다.

## Implementation

### I01. 첫 스테이지 이름과 충돌 플랫폼

- Related Files:
  - `src/game/data/worlds.ts` :: `WORLD_BLUEPRINTS`의 `world-02.stageTitles[0]`; modify.
  - `src/game/data/worlds.ts` :: `createSegment(stageId, segmentNumber, isBoss, length)`; modify.
  - `src/game/core/constants.ts` :: `NORMAL_MAP_WIDTH = 3840`; read-only.

#### Signatures & Types

```typescript
function createSegment(
  stageId: StageId,
  segmentNumber: number,
  isBoss: boolean,
  length: number,
): StageSegment
```

#### Data & Schema Fields

- `world-02.stageTitles[0]`: 정확히 `"지옥의 동네 놀이터"`.
- `world-02-stage-1`의 `StageSegment.platforms`: 첫 구간에만 `{ id: stageId + "-segment-1-platform", x: NORMAL_MAP_WIDTH / 2, y: 520, width: NORMAL_MAP_WIDTH, height: 32 }` 한 개. 2~5구간은 빈 배열. `StageRuntime.offsetPlatform()`이 첫 구간의 offset 0을 더하므로 실제 충돌 범위는 x=0..3840, 윗면 y=504다.
- `StageSegment.traps/enemies/coins/collectibles/decorations`: 기존 배열 및 위치 생성 로직 유지. 다른 스테이지의 `platforms`도 기존 정의 그대로다.

#### Execution Flow / Logic

1. `stageId === "world-02-stage-1"`인 경우에만 위 플랫폼 배열을 사용한다. boss/다른 스테이지는 기존 분기를 따른다.
2. 임시 Tiled 맵 파일이 아직 없으므로 `StageRuntime.buildFromSegments()`가 첫 구간의 전체 폭 플랫폼 하나와 기존 장애물·적을 생성한다.
3. 출구 runout은 `StageScene.createExitFloor()`가 마지막이자 유일한 플랫폼의 오른쪽 끝 x=3840과 윗면 y=504를 읽어 기존처럼 이어 준다.

### I02. 모래 이미지 렌더링과 충돌 유지

- Related Files:
  - `src/game/scenes/StageScene.ts` :: `StageScene.sandFloor?: Phaser.GameObjects.TileSprite`; new field.
  - `src/game/scenes/StageScene.ts` :: `StageScene.create`의 `runtime.build()` 직후와 플랫폼 collider 루프; modify.
  - `src/game/scenes/StageScene.ts` :: `StageScene.createWorld02SandFloor(stage: StageDefinition): void`; new private method.
  - `src/game/scenes/StageScene.ts` :: `shutdown` 정리 콜백; modify.
  - `src/game/stages/StageEntityFactory.ts` :: `createPlatform()`은 충돌 가능한 Phaser 사각형을 생성함; read-only.
  - `src/game/maps/TiledMapLoader.ts` :: 맵 파일이 생기면 `loadedMap`이 `null`이 아닐 수 있음; read-only.

#### Signatures & Types

```typescript
private sandFloor?: Phaser.GameObjects.TileSprite;
private createWorld02SandFloor(stage: StageDefinition): void;
```

#### Data & Schema Fields

- `sandFloor`: 현재 씬에서만 소유하는 Phaser `TileSprite` 또는 `undefined`; 저장 데이터와 이벤트 계약에는 추가 필드가 없다.
- 이미지 키는 정확히 `"world-02-sand-floor"`, 깊이는 `-2`, 스크롤 팩터는 `1`, x=0, y=504, 표시 폭=3840, 높이=216이다.

#### Execution Flow / Logic

1. `StageScene.create()`에서 runtime 생성 직후 `stage.id === "world-02-stage-1" && !this.loadedMap`일 때만 `createWorld02SandFloor(stage)`를 호출한다. 실제 Tiled 맵이 추가되면 중복 바닥을 만들지 않는다.
2. helper는 `this.runtime.getEntities("platform")`에서 유일한 Phaser 사각형을 가져와 `getBounds().top`이 504인지 확인한다. 없거나 여러 개면 명확한 오류를 던져 보이는 바닥과 충돌 바닥이 어긋난 채 진행하지 않는다.
3. `this.add.tileSprite(0, floorY, stage.mapWidth, stage.mapHeight - floorY, "world-02-sand-floor")`에 `.setOrigin(0).setDepth(-2).setScrollFactor(1)`을 적용한다. PNG가 512×216이므로 x방향으로만 자연스럽게 반복되고 화면 아래까지 채운다. 원경/중경(-30/-20) 위, 함정(-1)·적·코기 아래에 렌더링한다.
4. 기존 플랫폼 collider 루프에서는 이 첫 스테이지의 플랫폼 사각형만 `setVisible(false)`로 숨기되 `this.physics.add.collider(this.player, record.entity)`는 계속 만든다. 다른 월드/스테이지에는 적용하지 않는다.
5. `shutdown`에서 `sandFloor?.destroy()` 후 `undefined`로 비운다. 재시작·스테이지 전환 때 모래 타일스프라이트가 남지 않는다.

### I03. 충돌 범위와 HUD 검증

- Related Files:
  - `scripts/world02-sand-floor.test.mjs` :: 첫 스테이지 정의 검증; new.
  - `src/components/game/GameShell.tsx` :: `stage.title`을 `GameOverlay`로 전달; read-only.
  - `src/components/game/Hud.tsx` :: `stageTitle` 출력; read-only.

#### Details

- 테스트는 `scripts/world01-respawn.test.mjs`의 `createRequire` + TypeScript `transpileModule` 등록 패턴으로 `STAGE_DEFINITIONS`를 읽는다.
- 첫 스테이지 `title === "지옥의 동네 놀이터"`, `mapWidth === 3840`, `segments.flatMap(s => s.platforms)`가 정확히 하나이고 `{ x: 1920, y: 520, width: 3840, height: 32 }`인지 확인한다. 왼쪽 0·오른쪽 3840·윗면 504를 계산해 검증한다.
- 월드 2 stage-2 정의의 플랫폼 수/값은 기존 규칙을 유지하고, 월드 1 stage-1의 제목·맵 정의가 영향을 받지 않는지도 확인한다.
- 실제 플레이에서는 입구 x=96→섹션 경계→체크포인트→출구까지 이동하며 시각/충돌 틈, 장애물 가림, 바닥 반복 이음새를 확인한다.

## Acceptance Criteria

- [x] 첫 스테이지에서 코기가 전체 x=0..3840 구간의 모래 위를 계속 걸을 수 있고, 섹션 경계나 출구 앞에서 보이는 바닥을 뚫고 떨어지지 않는다.
- [x] 모래 이미지는 갈색 임시 사각형 대신 표시되며 기존 함정·적·코인·체크포인트·출구가 계속 나타난다.
- [x] HUD 이름은 `지옥의 동네 놀이터`이고 월드/스테이지 ID 및 나머지 제목은 그대로다.
- [x] 실제 Tiled 맵이 추가되면 임시 모래 렌더러가 중복 생성되지 않는다.

## Validation

- `node --test scripts/world02-sand-floor.test.mjs` — 연속 충돌 범위·이름·인접 스테이지 회귀 검사 통과.
- `npx.cmd eslint src/game/data/worlds.ts src/game/scenes/StageScene.ts scripts/world02-sand-floor.test.mjs` — 관련 파일 린트 통과.
- `npx.cmd tsc --noEmit` — Phaser/콘텐츠 타입 검사 통과.
- `npm.cmd run build` — 프로덕션 빌드 통과.
- 개발 실행에서 월드 2 첫 스테이지 입구부터 출구까지 실제 이동·장애물 표시·모래 이음새를 육안 확인한다.

## Commit Message

```text
feat(world02): 첫 스테이지 모래 바닥과 이름 적용

Plan: 2026-10-14-world02-sand-floor-and-stage-title
Phase: P01-sand-floor-and-title
Task: T02-sand-floor-runtime-and-title

- 연속 충돌 바닥과 모래 타일스프라이트 연결
- 첫 스테이지 이름을 지옥의 동네 놀이터로 변경
```

## Progress

- [x] 구현 완료
- [x] 검증 통과: 테스트 2건, 관련 파일 린트, 타입 검사, 프로덕션 빌드. Chrome에서 HUD와 이미지, 구간 경계 걷기(740→928), 다섯 지점의 발 위치 y=504, 출구 연결·함정·적·코인 확인.
- commit: pending
