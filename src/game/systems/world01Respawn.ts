import type { ProgressState, World01CheckpointStageId } from "../core/types";

export function isWorld01CheckpointStageId(value: unknown): value is World01CheckpointStageId {
  return value === "world-01-stage-2" || value === "world-01-stage-4";
}

export function getWorld01Respawn(progress: Pick<ProgressState, "world01CheckpointStageId">): {
  stageId: "world-01-stage-1" | World01CheckpointStageId;
  resumeCheckpointId?: string;
} {
  const stageId = progress.world01CheckpointStageId;
  return isWorld01CheckpointStageId(stageId)
    ? { stageId, resumeCheckpointId: `${stageId}-checkpoint` }
    : { stageId: "world-01-stage-1" };
}
