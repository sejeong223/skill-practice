# Task: T02 Death Counter and Pause Control

## Status: done

## Goal

On every death, briefly cover the game with a black screen showing a corgi-face icon and the saved lifetime death count. Add a working pixel-art pause/resume button at the top right and make the configured pause key control the same state.

## Decision Summary

- Use ProgressState.deathsTotal, which DeathSystem already increments and persists.
- Show the icon and literal “x -N” count for 900ms, then clear the overlay and return the UI to play mode.
- Keep respawn automatic and immediate; the overlay is presentation only.
- Pause and resume both StageRuntime and Phaser Arcade Physics. Keep StageScene updates active so the configured pause key can resume a paused stage.
- Place the button immediately left of the existing top-right exit button. Show two pixel bars while playing and a pixel triangle while paused.

## Implementation

### I01. Publish death and pause state to the React game overlay

- **Related Files**
  - src/game/stages/stageEvents.ts :: StageEventMap, add typed pause events.
  - src/game/systems/DeathSystem.ts :: handleDeath, emit the existing typed death event through persistenceEventBus.
  - src/game/scenes/StageScene.ts :: create, update, shutdown handler, and a new pause-state helper.
  - src/components/game/GameShell.tsx :: event handling, timeout lifecycle, pause state, and GameOverlay props.

#### Details

- Add StageEventMap entries:
  - pause-requested: { paused: boolean } for React-to-Phaser requests.
  - pause-state-changed: { paused: boolean } for Phaser-to-React confirmation.
- In DeathSystem.handleDeath, after incrementing ProgressState and emitting death-count-updated, emit persistenceEventBus death with exactly { stageId: context.stageId, cause: context.cause }. Do not remove the existing GameplayEventBus death event.
- In StageScene.create, subscribe to pause-requested and store its unsubscribe callback in eventUnsubscribers. Apply the requested state and emit pause-state-changed after applying it.
- In StageScene.update, read InputManager.getSnapshot().pausePressed before the runtime-status early return. Toggle only between play and paused. When paused, return before player, gimmick, interaction, enemy, and camera updates.
- The pause helper calls StageRuntime.pause()/resume() and this.physics.world.pause()/resume(). It must not pause the Phaser Scene itself, because the scene update loop must continue reading the pause key.
- Remove the pause-requested subscription during the existing StageScene shutdown cleanup.
- In GameShell, track paused, deathOverlayVisible, and deathOverlayCount. Subscribe directly to pause-state-changed with an effect that sets paused from payload and unsubscribes on cleanup. The UI pause callback emits pause-requested with the desired boolean; do not optimistically mark the UI paused before Phaser confirms.
- On death-count-updated, continue refreshing progress from progressRef. On death, set deathOverlayCount from progressRef.current.deathsTotal, show the death overlay, and set mode=dead. Start or replace a 900ms timeout; when it expires, hide the overlay and set mode=play. Clear the timeout on a later death and on component unmount.

### I02. Render the death counter and the top-right pixel control

- **Related Files**
  - src/components/game/DeathCounterOverlay.tsx :: new transient full-viewport overlay.
  - public/assets/pixel/characters/corgi/corgi-face-icon.svg :: new small pixel-art portrait using the existing corgi orange, cream, brown, and pink palette.
  - src/components/game/GameShell.tsx :: render DeathCounterOverlay when visible.
  - src/components/game/GameOverlay.tsx :: accept paused and onTogglePause props and pass them to Hud.
  - src/components/game/Hud.tsx :: add the pause/resume button and inline pixel-art SVG glyphs.
  - src/app/globals.css :: death overlay and pause button styles.

#### Details

- DeathCounterOverlay props:
  - deathCount: number
  - visible: boolean
- Render only while visible. Cover the game content frame with opaque black. Center one horizontal group containing the corgi-face image with Korean alt text “코기 얼굴” and text formatted exactly as “x -” followed by deathCount.
- Use image-rendering: pixelated on the icon. Keep the overlay above game canvas and HUD; do not change the Phaser restart or death behavior.
- The HUD control is a semantic button with Korean accessible label “일시정지” while playing and “계속하기” while paused. Its pause glyph is two crisp-edged vertical pixel bars; its paused glyph is a crisp-edged right-pointing triangle.
- Position the pause button at the content frame's top-right, immediately left of the existing exit button. Keep both controls clickable.

## Acceptance Criteria

- [ ] Each stage death increments the existing saved lifetime count and makes the overlay display that updated count.
- [ ] Overlay text is the corgi-face icon followed by “x -N” centered on opaque black for 900ms; it clears after that interval and the game UI returns to play mode.
- [ ] Repeated deaths replace the pending hide timer and show the new count; unmount clears the timer.
- [ ] Clicking the top-right pause button halts player movement, physics, enemies, hazards, and camera updates; clicking its resume state restores them.
- [ ] The configured pause key toggles the same state, including resuming while paused.
- [ ] The pause button uses crisp pixel-art glyphs and does not overlap the existing exit button.

## Validation

- npm.cmd run lint
- npm.cmd run build
- Manual review: die twice and verify counts 1 then 2 (or the existing saved total), overlay timing, and return to play; pause and resume with both the button and configured key.

## Commit Message

    feat(game-ui): 사망 횟수와 일시정지 기능 추가

    Plan: 2026-09-25-world01-polish
    Phase: P01-world01-polish
    Task: T02-death-counter-and-pause

    - 저장된 사망 횟수를 검은 오버레이에 잠시 표시한다.
    - 픽셀 아트 버튼과 지정 키로 게임을 멈추고 다시 시작한다.

## Progress

- [x] Implementation complete
- [x] Validation passed (lint, build)
- [ ] Manual in-game death and pause interaction review
- commit: pending
