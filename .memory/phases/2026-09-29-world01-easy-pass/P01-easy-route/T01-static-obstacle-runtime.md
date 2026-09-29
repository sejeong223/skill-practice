# Task: T01 정적 장애물 판정과 갈매기 에셋

## Status: pending

## Goal
개미·백색 가시·갈매기·상자를 처음부터 보이는 고정 장애물로 처리하는 공통 런타임을 추가한다. 이 Task에서는 기존 월드 1 배치를 건드리지 않아 단독 검증이 가능해야 한다.

## Decision Summary
- 새 종류 `static-ant`, `static-white-spike`, `static-seagull`, `static-box`를 추가한다. 기존 돌발 기믹 종류는 월드 2 이후 재사용 가능하도록 보존한다.
- 갈매기는 기존 아틀라스의 `pigeon` 프레임과 다른 동물이다. 독립 픽셀 SVG를 필수 이미지로 로드한다.

## Implementation

### I01. 타입·에셋 등록
- Related Files:
  - `src/game/core/contentTypes.ts` :: `GimmickKind` — 새 정적 종류 4개; modify
  - `src/game/assets/assetManifest.json` :: `PIXEL_ASSETS` 원본 — 갈매기 필수 이미지 등록; modify
  - `public/assets/pixel/props/world-01/seagull.svg` :: SVG 이미지 — 고정 갈매기 그림; new
  - `src/game/scenes/PreloadScene.ts` :: `PreloadScene.loadAsset` — 기존 `kind: "image"` 로더 사용; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  export type GimmickKind =
    | "static-ant" | "static-white-spike" | "static-seagull" | "static-box"
    // 기존 union 멤버 유지
    ;
  ```
- **Data & Schema Fields**:
  - 에셋 항목: `{ "key": "world-01-prop-seagull", "kind": "image", "url": "/assets/pixel/props/world-01/seagull.svg", "worldId": "world-01", "required": true }`.
  - `WorldGimmickDefinition` 기존 필드 `kind`, `trigger`, `x`, `y`, `width`, `height`, `visualKey`, `counterplay`, `outcome`을 그대로 사용한다. 저장 스키마 변경 없음.
- **Execution Flow / Logic**:
  1. `GimmickKind` union에 정확히 위 4개 문자열을 더한다. 옛 문자열은 삭제하지 않는다.
  2. SVG는 아래 내용 그대로 작성한다. 텍스트·그림자·부드러운 그라디언트는 넣지 않는다.
     ```svg
     <svg xmlns="http://www.w3.org/2000/svg" width="34" height="32" viewBox="0 0 34 32" shape-rendering="crispEdges">
       <rect x="5" y="10" width="22" height="16" fill="#473843"/>
       <rect x="7" y="8" width="20" height="17" fill="#fff8e7"/>
       <rect x="9" y="4" width="13" height="8" fill="#8295a0"/>
       <rect x="20" y="2" width="8" height="13" fill="#fff8e7"/>
       <rect x="25" y="6" width="2" height="2" fill="#473843"/>
       <rect x="28" y="11" width="6" height="4" fill="#f0b95f"/>
       <rect x="12" y="25" width="3" height="6" fill="#d59555"/>
       <rect x="21" y="25" width="3" height="6" fill="#d59555"/>
       <rect x="10" y="30" width="7" height="2" fill="#d59555"/>
       <rect x="19" y="30" width="7" height="2" fill="#d59555"/>
     </svg>
     ```
  3. 에셋 항목을 `world-01-props` 옆에 등록하여 `PreloadScene`의 기존 필수 이미지 순회가 로드하게 한다.
  4. SVG가 빠지면 `PreloadScene`의 기존 필수 에셋 오류 경로를 그대로 사용한다.

### I02. 고정 장애물 런타임
- Related Files:
  - `src/game/systems/MapGimmickSystem.ts` :: `MapGimmickSystem.update`, `overlapsGimmick`, `createGimmickVisual`, `getVisualY`, `getVisualSize`, `isDefaultVisible` — 가시성·판정·접촉 결과; modify
  - `src/game/data/world01Maps.ts` :: `createChainRules` — `walk-enter`가 `object-enter`로 매핑되고 사망 action을 생성하는 기존 경로 확인; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  private overlapsGimmick(gimmick: WorldGimmickDefinition): boolean;
  private createGimmickVisual(gimmick: WorldGimmickDefinition): void;
  private getVisualY(gimmick: WorldGimmickDefinition): number;
  private getVisualSize(gimmick: WorldGimmickDefinition): [number, number];
  private isDefaultVisible(gimmick: WorldGimmickDefinition): boolean;
  ```
- **Data & Schema Fields**:
  - 신규 종류 4개의 `trigger`는 `"walk-enter"`, `counterplay.action`은 `"jump-before-zone"`, `outcome`은 `{ kind: "instant-death", deathCause: "trap" }`로 T02에서 배치한다.
  - 표시 크기 `[width,height]`: 개미 `[30,20]`, 백색 가시 `[38,28]`, 갈매기 `[34,32]`, 상자 `[42,36]`.
- **Execution Flow / Logic**:
  1. `update` switch에서 4종은 `overlapsGimmick` 통과 즉시 `beginGimmick(gimmick, time, "object-enter")`를 호출한다. `jumpPressed`, 방향, 지상 여부, 타이머를 조건으로 추가하지 않는다.
  2. `overlapsGimmick`에서 4종의 영역은 `floorY = gimmick.y + gimmick.height`, `hitWidth = visualWidth - 8`, `hitHeight = visualHeight - 4`를 기준으로 `new Phaser.Geom.Rectangle(gimmick.x + gimmick.width / 2 - hitWidth / 2, floorY - hitHeight, hitWidth, hitHeight)`로 만든다. 그림보다 4px씩 안쪽으로 들어오는 가로 판정과 4px 낮은 세로 판정으로 빈 투명 여백을 피한다.
  3. `getVisualY`는 4종에 `floorY - visualHeight / 2`를 반환하여 그림의 아랫면을 바닥선에 맞춘다. `getVisualSize`는 위 크기를 반환한다. `isDefaultVisible`은 4종 모두 `true`다. `reset`도 기존 `isDefaultVisible` 경로를 사용한다.
  4. `createGimmickVisual`은 `static-seagull`에서 텍스처 키 `world-01-prop-seagull`을 직접 사용하고, 나머지 3종에서는 기존 `world-01-props` 아틀라스 프레임 `ant`, `white-spike`, `cat-box`를 사용한다. `visualKey`가 각각 그 프레임 이름이다.
  5. 접촉 후 상태 전이는 기존 `beginGimmick` → `MapInteractionSystem` chain action → 사망 요청을 사용한다. 프레임마다 중복 호출되지 않도록 기존 `armed` 검사에 의존한다.

## Acceptance Criteria
- [ ] 새 4종은 생성 직후 및 재시작 후에도 보이고 움직이지 않는다.
- [ ] 그림 위 빈 공간은 통과 가능하고 보이는 부분과 겹칠 때만 판정된다.
- [ ] 기존 월드 1 맵과 돌발 기믹은 이 Task의 중간 상태에서 동작이 변하지 않는다.
- [ ] 갈매기 SVG가 로드되고 기존 비둘기 프레임을 잘못 사용하지 않는다.

## Validation
- `npx.cmd tsc --noEmit` — 새 종류 분기 타입 검사 통과
- `npx.cmd eslint src/game/core/contentTypes.ts src/game/systems/MapGimmickSystem.ts` — 관련 파일 린트 통과
- `npm.cmd run world01:maps:check` — 기존 맵과 데이터가 아직 일치함
- `npm.cmd run build` — 갈매기 필수 에셋 경로를 포함한 빌드 통과

## Commit Message
```text
feat(game): add visible static world one obstacles

Plan: 2026-09-29-world01-easy-pass
Phase: P01-easy-route
Task: T01-static-obstacle-runtime

- Add contact-only static obstacle kinds
- Load a fixed seagull sprite for World 1
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
