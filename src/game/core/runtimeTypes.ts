import type { StageId } from "./types";

export interface CheckpointSnapshot {
  checkpointId: string;
  stageId: StageId;
  x: number;
  y: number;
  facing: 1 | -1;
}
