import { STAGE_IDS } from "../core/constants";
import type { ProgressState, SelectableWorldId, StageId } from "../core/types";
import { getWorld01Respawn } from "./world01Respawn";

export function isWorldSelectionUnlocked(progress: Pick<ProgressState, "clearedStages">): boolean {
  return progress.clearedStages.includes("world-01-stage-boss");
}

export function getWorldStartStageId(worldId: SelectableWorldId): "world-01-stage-1" | "world-02-stage-1" {
  return worldId === "world-01" ? "world-01-stage-1" : "world-02-stage-1";
}

export function getSelectedWorldResume(
  progress: Pick<ProgressState, "selectedWorldId" | "clearedStages" | "world01CheckpointStageId">,
): { stageId: StageId; resumeCheckpointId?: string } | null {
  if (!isWorldSelectionUnlocked(progress)) return null;
  if (progress.selectedWorldId === "world-01") return getWorld01Respawn(progress);
  if (progress.selectedWorldId === "world-02") {
    return {
      stageId: STAGE_IDS.find((stageId) =>
        stageId.startsWith("world-02-") && !progress.clearedStages.includes(stageId),
      ) ?? "world-02-stage-1",
    };
  }
  return null;
}
