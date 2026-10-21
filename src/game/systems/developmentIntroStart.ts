import type { ProgressState } from "../core/types";

/** Replay the opening locally without clearing the player's stored progress. */
export function prepareDevelopmentIntroProgress(
  progress: ProgressState,
  isDevelopment: boolean,
): ProgressState {
  if (!isDevelopment) return progress;
  return {
    ...progress,
    onboardingCompleted: false,
    seenCutsceneIds: progress.seenCutsceneIds.filter((id) => id !== "intro-home"),
  };
}
