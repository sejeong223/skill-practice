import { STAGE_IDS } from "../core/constants";
import type { ProgressState, SelectableWorldId, StageId, World01CheckpointStageId, World01ReplayPoint } from "../core/types";
import { getWorld01Respawn } from "./world01Respawn";

export interface World01ReplayTarget {
  readonly stageId: "world-01-stage-1" | World01CheckpointStageId | "world-01-stage-boss";
  readonly resumeCheckpointId?: string;
  readonly checkpointStageId: World01CheckpointStageId | null;
  readonly bossReplayActive: boolean;
}

export function getWorld01ReplayTarget(point: World01ReplayPoint): World01ReplayTarget {
  switch (point) {
    case "checkpoint-1":
      return {
        stageId: "world-01-stage-2",
        resumeCheckpointId: "world-01-stage-2-checkpoint",
        checkpointStageId: "world-01-stage-2",
        bossReplayActive: false,
      };
    case "checkpoint-2":
      return {
        stageId: "world-01-stage-4",
        resumeCheckpointId: "world-01-stage-4-checkpoint",
        checkpointStageId: "world-01-stage-4",
        bossReplayActive: false,
      };
    case "boss":
      return { stageId: "world-01-stage-boss", checkpointStageId: null, bossReplayActive: true };
    case "start":
      return { stageId: "world-01-stage-1", checkpointStageId: null, bossReplayActive: false };
  }
}

export function isWorldSelectionUnlocked(progress: Pick<ProgressState, "clearedStages">): boolean {
  return progress.clearedStages.includes("world-01-stage-boss");
}

export function getWorldStartStageId(worldId: SelectableWorldId): "world-01-stage-1" | "world-02-stage-1" {
  return worldId === "world-01" ? "world-01-stage-1" : "world-02-stage-1";
}

export function getSelectedWorldResume(
  progress: Pick<ProgressState, "selectedWorldId" | "clearedStages" | "world01CheckpointStageId" | "world01BossReplayActive">,
): { stageId: StageId; resumeCheckpointId?: string } | null {
  if (!isWorldSelectionUnlocked(progress)) return null;
  if (progress.selectedWorldId === "world-01") {
    return progress.world01BossReplayActive
      ? { stageId: "world-01-stage-boss" }
      : getWorld01Respawn(progress);
  }
  if (progress.selectedWorldId === "world-02") {
    return {
      stageId: STAGE_IDS.find((stageId) =>
        stageId.startsWith("world-02-") && !progress.clearedStages.includes(stageId),
      ) ?? "world-02-stage-1",
    };
  }
  return null;
}
