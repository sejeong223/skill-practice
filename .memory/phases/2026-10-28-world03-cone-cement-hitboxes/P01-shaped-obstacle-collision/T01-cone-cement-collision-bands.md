# Task: T01 안전 콘·시멘트 포대의 높이별 히트박스

## Status: done

## Goal

월드 3 안전 콘과 시멘트 포대의 윗부분에서 빈 픽셀 공간에 닿아 사망하는 가로 판정을 줄인다. 넓은 하단은 계속 위험하게 유지하고, 나머지 장애물·배치·재시작 동작은 바꾸지 않는다.

## Decision Summary

- 사용자 범위는 안전 콘(`traffic-cone`)과 포대자루(`cement-bag`) 두 종류다. 드럼통은 이번 계획에서 제외한다.
- 현재 두 사물은 각각 23×34px, 29×32px의 **단일** 원본 좌표 히트박스를 1.25배 확대한다. PNG의 투명 영역이 위로 갈수록 커지므로 각 사물을 원본 PNG의 상단부터 바닥까지 이어지는 **4개 직사각형 띠**로 교체한다. 픽셀별 완전 일치 판정은 요구하지 않는다.
- 기존 `World03ObstaclePlacement.width/height`는 장애물 전체의 보수적인 바깥 폭·높이와 배치 안전 검사에 계속 사용한다. 새 띠는 런타임 충돌에만 적용한다.

## Implementation

### I01. 그림의 불투명 픽셀 범위로 두 충돌 프로필 정의

- Related Files:
  - `src/game/data/world03Construction.ts` :: `World03ObstacleKind`, `World03ObstaclePlacement`, `WORLD03_OBSTACLE_SCALE`, `HITBOX`, 새 `World03HitboxBand`, `World03CollisionProfile`, `WORLD03_TAPERED_HITBOXES` — 기존 배치/전체 크기는 유지하고 두 종류의 원본 픽셀 좌표 프로필만 추가; modify
  - `public/assets/pixel/objects/world-03/traffic-cone.png` :: 32×40 RGBA 픽셀 아트 — 좌표 기준; read-only
  - `public/assets/pixel/objects/world-03/cement-bag.png` :: 34×36 RGBA 픽셀 아트 — 좌표 기준; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  export interface World03HitboxBand {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  }
  export interface World03CollisionProfile {
    readonly sourceWidth: number;
    readonly sourceHeight: number;
    readonly bands: readonly World03HitboxBand[];
  }
  export const WORLD03_TAPERED_HITBOXES:
    Readonly<Partial<Record<World03ObstacleKind, World03CollisionProfile>>>;
  // getWorld03Obstacles(stageId: StageId): readonly World03ObstaclePlacement[] 유지
  ```
- **Data & Schema Fields**:
  - `left/top`은 원본 PNG에서 포함, `right/bottom`은 제외하는 정수 좌표다. `0 <= left < right <= sourceWidth`, `0 <= top < bottom <= sourceHeight`를 지킨다. 모두 필수 `number`; null은 없다.
  - `traffic-cone`: `sourceWidth:32`, `sourceHeight:40`, `bands:[{left:12,top:6,right:19,bottom:10},{left:5,top:10,right:22,bottom:18},{left:7,top:18,right:24,bottom:29},{left:4,top:29,right:27,bottom:40}]`.
  - `cement-bag`: `sourceWidth:34`, `sourceHeight:36`, `bands:[{left:5,top:4,right:27,bottom:8},{left:4,top:8,right:27,bottom:15},{left:3,top:15,right:29,bottom:26},{left:2,top:26,right:31,bottom:36}]`.
  - 위 값은 현재 PNG에서 알파가 0보다 큰 픽셀을 각 높이 구간별로 감싼 최소 가로 범위다. 화면 가로폭은 순서대로 콘 `8.75/21.25/21.25/28.75px`, 포대 `27.5/28.75/32.5/36.25px`다. 기존 단일 가로폭은 콘 `28.75px`, 포대 `36.25px`였다.
  - `World03ObstaclePlacement`의 `id/kind/x/width/height` 필드와 4개 스테이지의 `POSITIONS/KINDS/COIN_POSITIONS`는 수정하지 않는다. 드럼 반지름에 사용되는 `height`도 그대로다.
- **Execution Flow / Logic**:
  1. Precondition: 두 프로필만 `WORLD03_TAPERED_HITBOXES`에 등록하고, 각 띠의 세로 구간이 서로 겹치거나 비지 않게 연결한다. 콘은 y=6~40, 포대는 y=4~36을 덮는다.
  2. Core Processing: 프로필은 원본 PNG의 픽셀 좌표만 보관한다. 1.25배 화면 좌표 변환은 런타임에서 수행해 데이터와 표시 배율이 어긋나지 않게 한다.
  3. Error Handling: 이미지 크기나 불투명 픽셀 범위가 바뀌면 I03의 자산 검사가 실패해야 한다. 그림을 자동 변경하거나 런타임에서 묵시적으로 크기를 보정하지 않는다.
  4. State/Return: `getWorld03Obstacles`가 반환하는 8개 장애물과 기존 `width/height` 값은 변하지 않는다.

### I02. 안전 콘·포대만 4개 정적 충돌 영역으로 생성

- Related Files:
  - `src/game/systems/World03ConstructionObstacles.ts` :: `World03ConstructionObstacles.constructor`, `update`, `resetForAttempt`, `destroy`, `DrumRuntime` — 두 종류에만 띠별 `Zone`과 overlap 콜라이더를 만들고 나머지는 현재의 단일 `Zone` 유지; modify
  - `src/game/entities/Player.ts` :: `Player`의 72×40px 몸체 — 충돌 상대 확인; read-only
  - `src/game/scenes/StageScene.ts` :: `World03ConstructionObstacles` 생성·업데이트·재시작 호출 — 연동 확인; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  constructor(
    scene: Phaser.Scene,
    player: Player,
    stageId: StageId,
    eventBus: GameplayEventBus,
    getCheckpointId: () => string | null,
    canHandleContact: () => boolean,
  );
  // 기존 public update(deltaMs: number), resetForAttempt(): void, destroy(): void 유지
  ```
- **Data & Schema Fields**:
  - 새 프로필 띠별 `Zone`은 `x/y/width/height`가 모두 화면 픽셀 좌표의 `number`다. `FLOOR_Y=504`, `WORLD03_OBSTACLE_SCALE=1.25`를 사용한다.
  - 띠의 화면 좌표는 `leftWorld = obstacle.x + (band.left - profile.sourceWidth/2) * scale`, `rightWorld = obstacle.x + (band.right - profile.sourceWidth/2) * scale`, `topWorld = FLOOR_Y - (profile.sourceHeight - band.top) * scale`, `bottomWorld = FLOOR_Y - (profile.sourceHeight - band.bottom) * scale`이다. `Zone` 중심은 각 양 끝의 평균, 크기는 차이다. 비대칭 그림을 무조건 `obstacle.x` 중심에 맞추지 않는다.
  - 기준 확인값: 1스테이지 콘 x=380의 맨 위 띠는 x=`375..383.75`, y=`461.5..466.5`; 포대 x=740의 맨 위 띠는 x=`725..752.5`, y=`464..469`다.
- **Execution Flow / Logic**:
  1. Precondition: `getWorld03Obstacles(stageId)`가 제공하는 월드 3 일반 스테이지 8개만 처리한다. 기존 이미지 한 장의 위치·origin·배율은 유지한다.
  2. Core Processing: 콘·포대이면 프로필의 4개 띠 각각에 `scene.add.zone` → `scene.physics.add.existing(zone,true)` → `StaticBody.updateFromGameObject()` → `scene.physics.add.overlap(player,zone,callback)`을 적용한다. 다른 4종은 현재 `obstacle.width/height`와 손수레 +6px x 오프셋의 단일 영역을 그대로 쓴다. 드럼은 단일 영역을 그대로 `DrumRuntime.zone`에 연결해 굴림·리셋 때 이미지와 함께 이동한다.
  3. Error Handling: 여러 띠가 같은 프레임에 겹쳐도 기존 `destroyed/contactPending/canHandleContact()` 검사로 `death-requested`는 한 번만 발행한다. 일시정지·사망 중에는 기존 조건대로 무시한다.
  4. State Transition: 생성한 모든 `Zone`과 콜라이더를 기존 `zones/colliders` 배열에 보관해 `destroy()`에서 전부 해제한다. `resetForAttempt()`는 기존처럼 `contactPending`을 지우고 드럼만 원위치로 옮긴다. 콘·포대의 고정 띠는 움직이지 않는다.

### I03. 픽셀 윤곽·콜라이더 개수·재시작 회귀 검사

- Related Files:
  - `scripts/world03-construction-assets.test.mjs` :: PNG 메타데이터·알파 검사 — 두 프로필의 source 크기와 각 띠의 실제 알파 바운딩 박스가 일치하는 검증 추가; modify
  - `scripts/world03-construction-obstacles.test.mjs` :: `createHarness`, 드럼·손수레 테스트, 새 콘·포대 테스트 — 단일 Zone 인덱스 가정을 제거하고 생성·접촉·정리 검증; modify
  - `scripts/world03-construction-stages.test.mjs` :: 4개 스테이지의 8자리·코인·꺼지는 바닥 회귀 — 실행만; read-only

#### Details

- PNG 검사는 `sharp(...).ensureAlpha().raw()`에서 각 band의 `alpha > 0`인 픽셀의 최소 `left/top/right/bottom`을 구해 I01 값과 비교한다. profile의 `sourceWidth/sourceHeight`는 PNG 메타데이터와 같아야 한다. 두 PNG 파일은 수정하지 않는다.
- 시스템 모의 장면은 스테이지 1의 이미지가 8개인 상태에서 충돌 영역과 콜라이더가 각각 17개(콘 2개·포대 1개가 각 1→4개), 스테이지 3은 각각 14개(콘 1개·포대 1개)임을 확인한다. 콘·포대의 맨 위 띠가 I02 기준 화면 좌표와 일치하고, 하단 띠가 바닥 y=504까지 이어지는지 검사한다.
- 기존 테스트의 `zones[images.indexOf(drum)]` / `zones[images.indexOf(wheelbarrow)]`는 더 이상 참이 아니다. 좌표·너비·높이 또는 명시적인 장애물 ID로 해당 단일 Zone을 찾아 드럼 240px 발동·160px 이동·원위치, 손수레 오프셋 +6px·접촉 1회·destroy를 계속 검사한다.
- 새 콘·포대 중 한 띠의 overlap 콜백을 호출하면 기존 체크포인트 ID가 담긴 `death-requested`가 한 번만 나와야 한다. 다른 띠를 같은 시도에서 호출해도 중복되지 않아야 하며, `resetForAttempt()` 뒤에는 다시 한 번 나와야 한다. `canHandleContact()`가 false일 때는 나오지 않아야 한다.
- 브라우저에서 1스테이지의 콘(x=380)과 포대(x=740)를 각각 점프하며 윗부분 옆의 빈 공간에서는 사망하지 않고, 보이는 넓은 하단에 닿으면 기존처럼 사망하는지 확인한다. 실제 화면 검증과 자동 검사 결과를 Task 완료 기록에 구분해 남긴다.

## Acceptance Criteria

- [ ] 두 사물의 맨 위 가로 판정은 각각 8.75px, 27.5px이며 하단은 기존 28.75px, 36.25px를 유지한다.
- [ ] 안전 콘·포대의 4개 영역이 그림의 불투명 픽셀을 덮고 바닥까지 빈틈없이 이어진다.
- [ ] 월드 3 각 스테이지의 이미지 장애물은 여전히 8개이고, 다른 4종·드럼 이동·손수레·코인·꺼지는 바닥·보스전은 기존 동작을 유지한다.
- [ ] 한 번의 접촉에 사망 이벤트는 한 번만 발생하고, 재시작과 장면 종료 시 콜라이더 상태가 정상 복원·해제된다.

## Validation

- `node --experimental-strip-types --test scripts/world03-construction-obstacles.test.mjs scripts/world03-construction-assets.test.mjs scripts/world03-construction-stages.test.mjs` — 띠 좌표, 그림 알파, 기존 장애물·배치 회귀 통과.
- `node scripts/validate-assets.mjs` — 두 PNG 및 전체 필수 자산 유효.
- `npx.cmd tsc --noEmit` — 타입 오류 없음.
- `npm.cmd run lint` — 린트 오류 없음.
- `npm.cmd run build` — 번들 오류 없음.
- 브라우저에서 스테이지 1 콘·포대의 위쪽 통과와 하단 접촉을 직접 확인하고 결과를 기록한다. 화면 자동화가 불가능하면 자동 검증과 구분해 미확인으로 명시한다.

## Commit Message

```text
fix(game): 월드 3 안전 콘과 포대 히트박스 폭 보정

Plan: 2026-10-28-world03-cone-cement-hitboxes
Phase: P01-shaped-obstacle-collision
Task: T01-cone-cement-collision-bands

- 픽셀 윤곽에 맞춰 두 장애물의 높이별 충돌 영역 적용
- 다른 장애물과 재시작 동작의 회귀 검사
```

## Progress

- [x] 구현 완료
- [x] 자동 검증 통과 (실제 플레이 확인 한계는 [검증 기록](../../../test-plans/2026-10-28-world03-cone-cement-hitboxes.md)에 명시)
- commit: 이 Task의 Git 커밋 참조
