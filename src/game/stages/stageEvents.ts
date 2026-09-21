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
  "player-name-confirmed": {
    playerName: string;
  };
  "skill-unlocked": {
    skillId: string;
  };
  "tool-purchased": {
    toolId: string;
    bankedCoins: number;
  };
  "collectible-found": {
    collectibleId: string;
    firstDiscovery: boolean;
  };
  "keybinds-changed": {
    keybinds: Record<string, string>;
  };
  "drawback-discovered": {
    toolId: string;
    drawbackId: string;
  };
  "death-count-updated": {
    stageId: StageId;
    deathsTotal: number;
  };
  "equipment-change-requested": {
    attackToolId?: string;
    defenseToolId?: string;
  };
}
