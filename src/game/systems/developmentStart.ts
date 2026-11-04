import type { ProgressState, SkillId, StageId } from "../core/types";

const WORLD01_BOSS_STAGE_ID = "world-01-stage-boss";
const WORLD02_BOSS_STAGE_ID = "world-02-stage-boss";
const WORLD03_BOSS_STAGE_ID = "world-03-stage-boss";
export const DEVELOPMENT_STAGE_ID = "world-04-stage-1";

export function prepareDevelopmentProgress(
  progress: ProgressState,
  isDevelopment: boolean,
): ProgressState {
  if (!isDevelopment) return progress;

  return {
    ...progress,
    onboardingCompleted: true,
    selectedWorldId: null,
    clearedStages: [...new Set<StageId>([
      ...progress.clearedStages,
      WORLD01_BOSS_STAGE_ID,
      WORLD02_BOSS_STAGE_ID,
      WORLD03_BOSS_STAGE_ID,
    ])],
    unlockedSkills: [...new Set<SkillId>([...progress.unlockedSkills, "bark", "bite", "dash"])],
    seenCutsceneIds: [...new Set([
      ...progress.seenCutsceneIds,
      "intro-home",
      "world-02-intro",
      "world-02-boss-intro",
      "world-02-boss-clear",
      "world-03-intro",
      "world-03-boss-intro",
      "world-03-boss-clear",
      "world-04-intro",
    ])],
  };
}

export function getDevelopmentEntry(
  progress: ProgressState,
  isDevelopment: boolean,
): {
  readonly sceneKey: "StageScene";
  readonly data: {
    readonly stageId: typeof DEVELOPMENT_STAGE_ID;
    readonly playerName: string;
  };
} | null {
  if (!isDevelopment) return null;
  return {
    sceneKey: "StageScene",
    data: { stageId: DEVELOPMENT_STAGE_ID, playerName: progress.playerName },
  };
}
