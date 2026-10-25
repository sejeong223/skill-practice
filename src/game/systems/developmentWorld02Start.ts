import type { ProgressState } from "../core/types";

const WORLD01_BOSS_STAGE_ID = "world-01-stage-boss";

export function prepareDevelopmentWorld02Progress(
  progress: ProgressState,
  isDevelopment: boolean,
): ProgressState {
  if (!isDevelopment) return progress;

  return {
    ...progress,
    onboardingCompleted: true,
    selectedWorldId: "world-02",
    clearedStages: progress.clearedStages.includes(WORLD01_BOSS_STAGE_ID)
      ? [...progress.clearedStages]
      : [...progress.clearedStages, WORLD01_BOSS_STAGE_ID],
    unlockedSkills: progress.unlockedSkills.includes("bark")
      ? [...progress.unlockedSkills]
      : [...progress.unlockedSkills, "bark"],
    seenCutsceneIds: progress.seenCutsceneIds.includes("intro-home")
      ? [...progress.seenCutsceneIds]
      : [...progress.seenCutsceneIds, "intro-home"],
  };
}

export function getDevelopmentWorld02Entry(
  progress: ProgressState,
  isDevelopment: boolean,
):
  | { readonly sceneKey: "StageScene"; readonly data: { readonly stageId: "world-02-stage-1"; readonly playerName: string } }
  | null {
  if (!isDevelopment) return null;
  return {
    sceneKey: "StageScene",
    data: { stageId: "world-02-stage-1", playerName: progress.playerName },
  };
}
