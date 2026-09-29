# Task: T02 보이는 장애물과 실제 열린 맨홀로 일반 4개 경로 재구성

## Status: done

## Goal
월드 1 일반 맵 네 개를 3840×720 경로로 재생성한다. 시작부터 보이는 개미·백색 가시·갈매기·상자를 맵마다 하나씩, 2·4단계 거리 구간에 실제 80px 열린 맨홀을 하나씩 배치한다. 2·4단계는 최대 32px의 완만한 높낮이와 짧은 점프를 유지한다. 개미 위 투명 벽과 돌발 생성 기믹을 없애 수동 테스트가 가능하게 한다.

## Decision Summary
- 물리 위험은 총 18개(정적 장애물 16, 열린 맨홀 2). 각 맵의 물리 위험 시작점 간 간격은 최소 656px이다. 3종 가짜 간식 코인은 각 2개씩 공중의 선택 경로에 둔다.
- 체크포인트는 T03에서 변경한다. 이 Task의 커밋 시점에는 기존 네 곳을 임시로 유지해 현재 검증과 충돌하지 않게 하고, 가짜 체크포인트 및 연결 가시는 여기서 제거한다.

## Implementation

### I01. 경로와 배치 데이터

- Related Files:
  - `src/game/data/world01Gimmicks.ts` :: `getWorld01FloorY`, `WORLD01_GIMMICKS`, `WORLD01_GIMMICK_MINIMUMS`, `getWorld01GimmicksForStage`; modify
  - `src/game/core/contentTypes.ts` :: `GimmickKind`, `WorldGimmickDefinition`; modify
  - `src/game/data/world01Maps.ts` :: `createStageMap`, `createGimmickObject`, `createChainRules`; modify
  - `scripts/world01-maps.mjs` :: `makeMap`, `verifyMap`, `run`; modify
  - `public/assets/pixel/maps/world-01/world-01-stage-1.json` through `world-01-stage-4.json` :: generated Tiled maps; modify

#### Details
- **Signatures & Types**:
  ```typescript
  type World01StaticKind = "ant-static" | "white-spike-static" | "seagull-static" | "box-static";
  // Extend GimmickKind with World01StaticKind and "open-manhole".
  export function getWorld01FloorY(stageNumber: 1 | 2 | 3 | 4, x: number): number;
  export function getWorld01OpenManholes(stageNumber: 1 | 2 | 3 | 4): readonly { x: number; width: 80 }[];
  ```
- **Data & Schema Fields**:
  - All maps: width 3840, height 720, tile 16. Stage 1/3 floor y512. Stage 2 floor y512 for x<1536, y496 for 1536–1791, y480 for 1792–2303, y496 for 2304–2815, y512 thereafter. Stage 4 floor y512 for x<1152, y496 for 1152–1791, y480 for 1792–2431, y496 for 2432–3071, y512 thereafter. At each rising boundary build a visibly climbable 16px ledge; no roof or clothesline art may imply solid support without matching tiles.
  - Stage 1 danger center/start x: ant 416, white spike 1088, box 2592, seagull 3300. Green fake coin x2192.
  - Stage 2: ant 384, open manhole 1040–1119, seagull 1696, white spike 2352, box 3008. Reverse coin x848, green coin x2784; checkpoint x1920 remains clear.
  - Stage 3: ant 416, box 1168, white spike 2544, seagull 3280. Fire coin x2176.
  - Stage 4: seagull 400, open manhole 1056–1135, box 1712, white spike 2368, ant 3024. Reverse coin x2056, fire coin x2704; checkpoint x3488 remains clear.
  - Each static danger has `trigger:"walk-enter"`, `hintPolicy:"none"`, `lethal:true`, `outcome:{kind:"instant-death",deathCause:"trap"}`, visible default state, fixed x/y, 32–64px hitbox around drawn body, and `counterplay.action:"jump-before-zone"`. Manhole uses an 80px missing ground tile range plus visible `world-01-manhole-open` rim; `counterplay.action:"jump-before-zone"`. Reuse the existing `WorldGimmickDefinition`/object/chain ID relationship, but do not add proximity activated walls, animals or spikes.
  - Static visuals: ant `world-01-prop-ant`, white spike `world-01-prop-white-spike`, seagull `world-01-seagull-static`, box `world-01-prop-cat-box`. Check actual atlas frame keys in `world-01-props.json` when binding; do not reuse a hidden triggered-spike frame. The static seagull uses T01's new PNG.
  - Coin count exactly 6, with variant color visible before overlap. Green/reverse/fire remain harmful optional pickups; coin center y at least 80px above floor and away from walking hitbox. Each fake variant has two entries; no `fake-checkpoint` records, activation chains, spike reveal objects or cat-chain spawn objects remain in World 1.
- **Execution Flow / Logic**:
  1. Replace the 66-entry dynamic catalogue with the 24-entry layout. For each physical danger, create an inert, visible scene object and tight overlap. For coins keep existing variant outcome semantics. Remove `forward-jump-wall`, `revealed-white-spike`, `jump-pigeon`, `box-cat-arm`, timed spawns, fake checkpoint and chain-source objects from World 1 map definitions.
  2. In `makeMap`, before filling a column, skip all tiles when its center lies in a declared open manhole interval. Add the rim as a noncolliding visual, with the visual opening exactly aligned to absent tiles. Generate all four JSON maps with `npm.cmd run world01:maps`; never hand-edit the generated JSON.
  3. Extend map verification to assert the two empty tile intervals and all other ground tiles; verify danger counts, positions, visibility, and 656px separation. Replace the old minimum 66/8-second cadence constraints with the new catalogue contract in both JS and TS validators.

### I02. Collision and death behavior

- Related Files:
  - `src/game/systems/MapGimmickSystem.ts` :: `createGimmickVisual`, `createPhysicalTrigger`, `update`, `checkWorldBounds`, `reset`; modify
  - `src/game/data/validateMaps.ts` :: `validateCampaignMaps`, `validateGimmicks`, `validateSafeSections`; modify
  - `src/game/scenes/StageScene.ts` :: `update`/death forwarding; modify only if generic world-bounds handler cannot emit fall death
  - `src/game/data/worldMaps.ts` :: World 1 `objectVisualKeys` and `hazardCatalog`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // Each overlap emits one existing gameplay `death-requested` event with
  // {stageId, cause:"trap"|"fall", checkpointId, gimmickId}; no extra life state.
  ```
- **Data & Schema Fields**:
  - `open-manhole` has no overlap death rectangle above the hole; death fires only after the player falls below the walking floor while horizontally inside its 80px opening. If world bounds would catch the player at y720, detect crossing y>floor+96 and emit `cause:"fall"` once per attempt before any bottom-bound landing can rescue them.
  - Static ant, spike, gull and box have no hidden wall body. In particular remove the `forward-jump-wall` physical rectangle responsible for the transparent wall above an ant. The white spike is rendered before the player reaches it.
- **Execution Flow / Logic**:
  1. Render physical objects at their definition coordinates when entering the map, including after restart. Use exact image bounds to derive active overlap; do not rely on wide 96px trigger zones that kill before contact.
  2. If a static hazard intersects the player, emit one death request and allow `DeathSystem`/`RestartController` to perform existing normal-stage respawn. On reset, restore all visible static visuals and keep manhole ground missing.
  3. Guard against duplicate requests while death/restart is underway. Keep non-World-1 gimmick behavior unchanged.

## Acceptance Criteria
- [ ] Four maps contain 16 permanently visible static dangers, two real 80px holes, six visible-variant fake coins and zero fake checkpoints or invisible barriers.
- [ ] Jumping over the ant does not collide with transparent geometry. The manhole kills only when the player falls in; a clean jump crosses it.
- [ ] Stage 2/4 floor changes by at most 16px per ledge, reaches only 32px above baseline, and allows normal running/short jumps to the exit.
- [ ] Every danger is visible before contact, physical danger spacing is at least 656px, and World 1 map/catalogue/Tiled counts agree.

## Validation
- `npm.cmd run world01:maps` — regenerate four Tiled JSON files.
- `npm.cmd run world01:maps:check` — catalogue, tile holes and placement pass.
- `npx.cmd tsc --noEmit` — updated discriminated unions compile.
- `npm.cmd run lint` — no lint errors.
- `npm.cmd run dev` — manually jump over an ant and two open manholes, and run stages 2/4 to exit without hidden collision.

## Commit Message
```text
feat(world01): replace surprise gimmicks with visible sparse hazards

Plan: 2026-09-29-world01-daylight-calico
Phase: P01-route-and-boss
Task: T02-visible-route-and-pits

- Rebuild four gentle routes with static obstacles and real manhole gaps
- Keep six fake snack coins and remove invisible wall logic
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (`world01:maps`, `world01:maps:check`, `tsc --noEmit`, `lint`, `build`)
- commit: T02 한국어 커밋
