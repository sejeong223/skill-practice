# Task: T01 World 1 Grounding and Hazard Feedback

## Status: done

## Goal

Make each World 1 normal stage start with the corgi's feet on the floor; increase shared horizontal run speed slightly; reveal the invisible wall when it hits the corgi; reveal white spikes early enough to react; and make ground-collapse gimmicks leave a 192px-wide opening all the way through the gameplay tile layer.

## Decision Summary

- World 1 spawn x remains 96 and uses floor y=512 from getWorld01FloorY(stageNumber, 96). Other worlds keep y=440.
- DEFAULT_PLAYER_TUNING.runSpeed changes from 220 to 240.
- Only ground-collapse gimmicks use width 192px; all other World 1 gimmicks retain width 64px.
- White spikes reveal when a grounded corgi enters the 96px approach region. Their existing lethal trigger remains the actual contact overlap.
- The invisible wall becomes visible on impact for the existing 620ms before death. Its collision body is disabled as before.
- Collapse removes tiles from the floor row to layer.layer.height, not just the next two rows.

## Implementation

### I01. Floor-aligned World 1 spawn and shared movement tuning

- **Related Files**
  - src/game/data/worlds.ts :: createNormalStage, modify. Import getWorld01FloorY from data/world01Gimmicks.ts. For world-01 only, set spawn.y to getWorld01FloorY(stageNumber, 96); retain spawn.x=96 and y=440 for other worlds.
  - src/game/entities/playerTypes.ts :: DEFAULT_PLAYER_TUNING, modify runSpeed only from 220 to 240.
  - scripts/world01-maps.mjs :: verifyMap and route-point validation, modify. Its current validation starts and ends at hard-coded y=440. Import getWorld01FloorY once and use the floor height at x=96 and x=3744 for the corresponding World 1 route endpoints.

#### Details

- The World 1 floor at x=96 is y=512 for stages 1–4. The player body bottom is aligned to Player sprite y with the current origin, body offset, and 40px body height; spawn y=512 therefore places the physics feet at the floor surface.
- Keep all other spawn coordinates and all other Player body/origin settings unchanged.
- Set runSpeed to exactly 240. Do not change acceleration, deceleration, gravity, jump velocity, or maximum speed.
- The map validator's route timing continues to derive from DEFAULT_PLAYER_TUNING.runSpeed, so its measured time uses the new shared tuning.

### I02. Reveal the World 1 invisible wall and white spikes at readable times

- **Related Files**
  - src/game/systems/MapGimmickSystem.ts :: update, createPhysicalTrigger, handleWallImpact, reset, modify.

#### Details

- For a forward-jump-wall, retain the current 16px by 96px physical rectangle, activation condition, impact impulse, camera shake, and 620ms death deadline. On collision, disable its static body and make the same rectangle visible with a fill color 0x5f3942 at alpha 0.9 and 4px outline in 0xf0b95f at alpha 1. Keep it visible until death/reset; reset must hide it and leave its body disabled.
- Define the white-spike reveal lead as 96 world pixels. While the gimmick is armed and the player is grounded and moving toward it, reveal the existing white-spike visual when the player's forward body edge enters the region ending 96px before gimmick.x.
- Revealing a spike only changes its visual. Do not call beginGimmick, change the runtime status, or request death until the existing white-spike contact overlap is reached.
- Keep white spikes hidden on reset until the corgi enters the approach region. Keep fake-checkpoint spikes and all other trap visibility behavior unchanged.

### I03. Open collapse zones through the World 1 gameplay map

- **Related Files**
  - src/game/data/world01Gimmicks.ts :: makeGimmick, modify width selection by kind.
  - src/game/systems/MapGimmickSystem.ts :: removeGround and restoreCollapsedTiles, modify.
  - public/assets/pixel/maps/world-01/world-01-stage-1.json, generated output.
  - public/assets/pixel/maps/world-01/world-01-stage-2.json, generated output.
  - public/assets/pixel/maps/world-01/world-01-stage-3.json, generated output.
  - public/assets/pixel/maps/world-01/world-01-stage-4.json, generated output.

#### Details

- Assign width=192 to kind ground-collapse and width=64 to all other kinds in makeGimmick. The 192px width is twelve 16px tiles and exceeds the Player body width of 72px.
- removeGround derives tileStartX and tileEndX from the gimmick's x and width as it does now. Starting at floorRow, visit every y row while y < layer.layer.height; remove each present tile and record its x, y, and original index in collapsedTiles.
- Retain restoreCollapsedTiles behavior so a death/restart restores every removed tile. Do not alter ground-rise or other tile behavior.
- Regenerate the four JSON maps using the project generator so their World 1 gimmick object widths match the TypeScript catalog. Do not hand-edit generated JSON.

## Acceptance Criteria

- [ ] World 1 stages 1–4 spawn at x=96, y=512; other worlds still spawn at their existing coordinates.
- [ ] A grounded corgi's physics feet touch the floor after spawn without an initial 72px drop.
- [ ] Run speed is exactly 240 and all other player tuning values remain unchanged.
- [ ] After the ant is avoided and the corgi hits the invisible wall, its outlined shape is visible during the 620ms impact/death window and hidden after reset.
- [ ] A white spike appears once the grounded, forward-moving corgi enters its 96px approach region; it remains nonlethal until the current contact trigger is reached.
- [ ] Each ground-collapse hole is 192px wide and clear from the floor row to the map layer bottom; the corgi falls through, reaches the existing world-bounds fall death, and the ground restores after restart.
- [ ] All four generated map object catalogs remain synchronized with the TypeScript gimmick definitions.

## Validation

- npm.cmd run world01:maps
- npm.cmd run world01:maps:check
- npm.cmd run lint
- npm.cmd run build
- Manual World 1 stage 1–4 review: spawn contact; ant-to-wall collision visibility; spike reveal lead; collapse width/depth, fall, death, and restoration.

## Commit Message

    feat(world01): 월드 1 발판과 함정 보정

    Plan: 2026-09-25-world01-polish
    Phase: P01-world01-polish
    Task: T01-grounding-and-hazards

    - 월드 1 시작 위치와 코기 이동 속도를 조정한다.
    - 함정을 드러내고 바닥에 완전한 낙하 구멍을 만든다.

## Progress

- [x] Implementation complete
- [x] Validation passed (map generation/check, lint, build)
- [ ] Manual interactive gameplay review (no interactive browser control available in this execution environment)
- commit: 04aa2c0
