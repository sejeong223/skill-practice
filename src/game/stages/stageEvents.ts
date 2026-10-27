import type { CosmeticId, CustomOutfitDesign, CustomOutfitId, MarketCategory, SelectableWorldId, StageId, WorldSelectionRequest } from "../core/types";
import type { CutsceneBeat } from "../cutscenes/types";
import type { BossFeedbackSnapshot } from "../systems/bossFeedback";
import type { BossVictoryStageId } from "../data/bossVictoryPresentation";

export interface StageEventMap {
  "boss-feedback-changed": BossFeedbackSnapshot;
  "world-selection-requested": WorldSelectionRequest;
  "world-selection-committed": { worldId: SelectableWorldId };
  "stage-started": {
    stageId: StageId;
    attempt: number;
  };
  "coin-changed": {
    stageId: StageId;
    currentStageCoins: number;
    bankedCoins: number;
  };
  "coin-collected": {
    stageId: StageId;
    coinId: string;
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
    stageId: StageId;
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
  "ending-finished": { cutsceneId: "ending-homecoming" };
  "stage-clear-scene-opened": {
    stageId: BossVictoryStageId;
    nextStageId: "world-02-stage-1" | "world-03-stage-1";
  };
  "skill-unlock-scene-opened": {
    stageId: BossVictoryStageId;
    skillId: "bark" | "bite";
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
    // 자동 타이머와 별개로 선택적 빠른 넘김 입력을 허용한다.
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
  "shop-state-changed": {
    open: boolean;
    closeViaEscape: boolean;
  };
  "catalog-state-changed": {
    open: boolean;
    closeViaEscape: boolean;
  };
  "paint-state-changed": {
    open: boolean;
    closeViaEscape: boolean;
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
  "market-item-purchased": {
    itemId: string;
    category: MarketCategory;
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
  "cosmetic-change-requested": {
    outfitId?: CosmeticId | null;
    accessoryId?: CosmeticId | null;
  };
  "custom-outfit-change-requested": {
    id: CustomOutfitId | null;
    design: CustomOutfitDesign | null;
  };
  "custom-outfit-saved": {
    design: CustomOutfitDesign;
  };
}
