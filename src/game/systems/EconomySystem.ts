import type { ProgressState, RuntimeStageState, StageId } from "../core/types";
import { TOOL_DEFINITIONS } from "../data/tools";
import { GameEventBus } from "../bridge/GameEventBus";

export class EconomySystem {
  private readonly progress: ProgressState;
  private readonly runtime: RuntimeStageState;
  private readonly eventBus: GameEventBus;

  public constructor(
    progress: ProgressState,
    runtime: RuntimeStageState,
    eventBus: GameEventBus,
  ) {
    this.progress = progress;
    this.runtime = runtime;
    this.eventBus = eventBus;
  }

  public collectCoin(stageId: StageId, amount = 1): boolean {
    if (stageId !== this.runtime.stageId || !Number.isInteger(amount) || amount <= 0) {
      return false;
    }
    this.runtime.currentStageCoins += amount;
    this.emitCoins(stageId);
    return true;
  }

  public commitStageClear(): number {
    const collected = this.runtime.currentStageCoins;
    if (collected === 0) {
      return this.progress.bankedCoins;
    }
    this.progress.bankedCoins += collected;
    this.runtime.currentStageCoins = 0;
    if (!this.progress.clearedStages.includes(this.runtime.stageId)) {
      this.progress.clearedStages.push(this.runtime.stageId);
    }
    this.emitCoins(this.runtime.stageId);
    return this.progress.bankedCoins;
  }

  public handleDeath(): void {
    this.runtime.currentStageCoins = 0;
    this.emitCoins(this.runtime.stageId);
  }

  public purchaseTool(toolId: string): boolean {
    const tool = TOOL_DEFINITIONS.find((candidate) => candidate.id === toolId);
    if (!tool || this.progress.ownedToolIds.includes(toolId) || this.progress.bankedCoins < tool.price) {
      return false;
    }
    this.progress.bankedCoins -= tool.price;
    this.progress.ownedToolIds.push(toolId);
    this.eventBus.emit("tool-purchased", {
      toolId,
      bankedCoins: this.progress.bankedCoins,
    });
    return true;
  }

  public getBankedCoins(): number {
    return this.progress.bankedCoins;
  }

  public getCurrentStageCoins(): number {
    return this.runtime.currentStageCoins;
  }

  private emitCoins(stageId: StageId): void {
    this.eventBus.emit("coin-changed", {
      stageId,
      currentStageCoins: this.runtime.currentStageCoins,
      bankedCoins: this.progress.bankedCoins,
    });
  }
}
