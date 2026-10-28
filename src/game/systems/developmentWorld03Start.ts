import type { ProgressState, SkillId, StageId } from "../core/types";
import { getWorld03Entry, type World03Entry } from "./world03IntroRouting";

const WORLD01_BOSS_STAGE_ID = "world-01-stage-boss";
const WORLD02_BOSS_STAGE_ID = "world-02-stage-boss";

export function prepareDevelopmentWorld03Progress(
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
    ])],
    unlockedSkills: [...new Set<SkillId>([...progress.unlockedSkills, "bark", "bite"])],
    seenCutsceneIds: [...new Set([
      ...progress.seenCutsceneIds,
      "intro-home",
      "world-02-intro",
      "world-02-boss-intro",
      "world-02-boss-clear",
    ])],
  };
}

export function getDevelopmentWorld03Entry(
  progress: ProgressState,
  isDevelopment: boolean,
): World03Entry | null {
  if (!isDevelopment) return null;
  return getWorld03Entry(progress);
}
