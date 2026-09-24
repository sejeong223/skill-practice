# Plan: World 1 Gameplay Polish

## Goal

Address the seven requested World 1/gameplay presentation issues: place the corgi on the World 1 floor at spawn, make the invisible wall and white spikes readable in time, make collapsing ground a real fall-through opening, show a brief lifetime death counter, increase corgi movement speed slightly, add a working pixel-art pause control, and show tool and control labels in Korean. Keep existing gameplay identifiers, item effects, unrelated worlds and cutscenes unchanged.

## Decisions

See [the decision record](../decisions/2026-09-25-world01-polish.md). Its numeric defaults are explicit planning assumptions and can be adjusted before execution.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `completed` | World 1 floor and hazard corrections, death/pause UI, and Korean item/control labels | [P01](../phases/2026-09-25-world01-polish/P01-world01-polish/phase.md) |

## Execution Order

1. Correct World 1 spawn grounding, shared run speed, hazard visibility, and collapse geometry. Regenerate the four World 1 Tiled JSON maps from their TypeScript source.
2. Bridge death and pause state to the overlay; add the transient death counter and top-right pause/resume control.
3. Localize all visible tool presentation and keybind labels while retaining stable internal identifiers and actual keyboard bindings.
4. Run the listed map, lint, build, and manual visual checks during implementation. No production code or tests are part of this planning step.

## Scope Boundary

- World 1 map changes apply to normal stages 1–4 only.
- The shared movement speed and global item/control presentation change only because those are requested user-facing behaviors.
- Do not change item mechanics, saved tool IDs, saved key codes, unrelated map layouts, cutscenes, or other requested-unrelated presentation.

## Definition of Done

- [ ] World 1 normal-stage spawn puts the corgi's feet on the floor; other world spawn coordinates stay unchanged.
- [ ] The wall silhouette appears on impact and remains readable through the death delay; World 1 white spikes are visible at least 96px before their lethal contact region.
- [ ] Each World 1 ground-collapse gap spans 192px and removes every gameplay tile from the floor row to the bottom of that map, allowing the corgi to fall through and trigger the existing fall death.
- [ ] Each death displays the corgi-face icon and “x -N” on a black overlay using the saved lifetime count, then clears after 900ms.
- [ ] Run speed is 240 (from 220); the top-right pixel-art button and configured pause key stop and resume the stage simulation.
- [ ] All visible tool names/effects/drawbacks/slots and keybind labels are Korean; internal IDs and behavior are unchanged.
- [x] World 1 map generation/check, lint, and build pass.
- [ ] Manual gameplay and visual scenarios in the Task blueprints pass.
