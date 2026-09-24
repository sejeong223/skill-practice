# Decisions: World 1 Gameplay Polish

- Date: 2026-09-25
- Status: Proposed defaults for the requested plan

## D01. Death counter
- **Chosen**: Show the saved lifetime total from ProgressState.deathsTotal.
- **Rationale**: DeathSystem already increments and persists this counter on every death; it gives the requested count without adding another counter or save field.

## D02. World 1 floor contact
- **Chosen**: Spawn each of the four World 1 normal stages at the World 1 floor height for x=96, which is y=512. Leave other worlds' spawn positions unchanged.
- **Rationale**: The World 1 normal-stage spawn is currently y=440 while the floor at x=96 is y=512. The existing player body bottom is aligned to the sprite anchor, so the 72px spawn offset explains the visible gap.

## D03. Movement speed
- **Chosen**: Raise DEFAULT_PLAYER_TUNING.runSpeed from 220 to 240.
- **Rationale**: This is about a 9% increase and matches “a little faster” while retaining the shared tuning used by the player controller.

## D04. Ground collapse
- **Chosen**: Give ground-collapse gimmicks a 192px (12 tile) opening and remove gameplay tiles from the floor row through the bottom of the tile layer.
- **Rationale**: The current 64px opening is narrower than the 72px player body and only removes two tile rows, leaving solid ground below the visible hole.

## D05. Hazard visibility
- **Chosen**: Reveal white spikes when the grounded player enters a 96px approach area, without triggering their lethal chain until the existing contact overlap. Show the invisible wall's pixel-styled shape on impact and keep it visible through its existing 620ms death delay.
- **Rationale**: This gives the player a readable reaction window and exposes the wall at the collision that causes death.

## D06. Death screen
- **Chosen**: Display a black overlay for 900ms after each death, centered with a corgi-face icon and the literal counter format “x -N”; then restore the play UI.
- **Rationale**: The scene respawns immediately, so a short overlay makes the count readable without leaving gameplay covered.

## D07. Pause control
- **Chosen**: Add a top-right pixel-art pause button beside the existing exit button. It pauses/resumes StageRuntime and Arcade Physics; the existing configured pause key also toggles it. Show a pixel-art play glyph and Korean accessible label while paused.
- **Rationale**: Both input paths control the same pause state, and pausing Arcade Physics prevents the player and world from continuing to move.

## D08. Korean item and control labels
- **Chosen**: Localize visible tool names, effects, drawbacks, slots, and keybind labels. Keep stable tool IDs, effect identifiers, saved key codes, and input behavior unchanged.
- **Rationale**: Presentation strings can be Korean without changing gameplay data or invalidating saved progress and keybinds.
