import type { StageId } from "../core/types";

export interface SharedMenuState {
  stageId: StageId;
  mode: "safe" | "play" | "cutscene" | "dead" | "stage-clear" | "ending";
  introReady: boolean;
  paused: boolean;
  shopOpen: boolean;
  catalogOpen: boolean;
  paintOpen: boolean;
  worldSelectOpen: boolean;
  resetProgressDialogOpen: boolean;
}

export function canOpenSharedMenu(state: SharedMenuState): boolean {
  return /^world-0[1-5]-stage-(?:[1-4]|boss)$/.test(state.stageId) &&
    state.mode === "play" && state.introReady && !state.paused && !state.shopOpen &&
    !state.catalogOpen && !state.paintOpen && !state.worldSelectOpen && !state.resetProgressDialogOpen;
}
