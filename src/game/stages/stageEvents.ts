import type { StageId } from "../core/types";

export interface StageEventMap {
  "stage-started": {
    stageId: StageId;
    attempt: number;
  };
  "coin-changed": {
    stageId: StageId;
    currentStageCoins: number;
    bankedCoins: number;
  };
  death: {
    stageId: StageId;
    cause: "enemy" | "trap" | "fall" | "tool-drawback" | "scripted";
  };
  "checkpoint-activated": {
    stageId: StageId;
    checkpointId: string;
  };
  "stage-completed": {
    stageId: StageId;
    nextStageId: StageId | null;
    bankedCoins: number;
  };
  "cutscene-requested": {
    stageId: StageId;
    cutsceneId: string;
  };
  "shop-requested": {
    stageId: StageId;
  };
}
