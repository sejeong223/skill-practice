import type { StageId } from "../core/types";
import type { CutsceneBeat } from "../cutscenes/types";

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
  "boss-hearts-changed": {
    stageId: "world-01-stage-boss";
    remaining: 0 | 1 | 2 | 3;
  };
  "map-state-restored": {
    stageId: StageId;
    checkpointId: string | null;
  };
  "gimmick-diagnostics": {
    stageId: StageId;
    gimmickId: string;
    status: "armed" | "triggered" | "escaped" | "dead";
    counterpresses: number;
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
  "cutscene-started": {
    cutsceneId: string;
    skipAllowed: boolean;
  };
  "cutscene-beat": {
    cutsceneId: string;
    beat: CutsceneBeat;
    index: number;
    totalBeats: number;
    skipAllowed: boolean;
    manualAdvance?: boolean;
    captionIndex?: number;
    captionCount?: number;
  };
  "cutscene-finished": {
    cutsceneId: string;
    skipped: boolean;
  };
  "cutscene-skip-requested": Record<string, never>;
  "cutscene-advance-requested": Record<string, never>;
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
  "pause-requested": {
    paused: boolean;
  };
  "pause-state-changed": {
    paused: boolean;
  };
  "equipment-change-requested": {
    attackToolId?: string;
    defenseToolId?: string;
  };
}
