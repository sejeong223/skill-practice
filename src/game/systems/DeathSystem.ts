import { GameplayEventBus } from "../core/events";
import { isStageId } from "../data/validateContent";
import type { ProgressState, RuntimeStageState, StageId } from "../core/types";
import { RestartController } from "./RestartController";

export interface DeathContext {
  stageId: StageId;
  cause: "enemy" | "trap" | "fall" | "tool-drawback" | "scripted";
  checkpointId: string | null;
}

export class DeathSystem {
  private readonly progress: ProgressState;
  private readonly runtime: RuntimeStageState;
  private readonly restartController: RestartController;
  private readonly eventBus: GameplayEventBus;
  private readonly unsubscribe: () => void;
  private handlingDeath = false;

  public constructor(
    progress: ProgressState,
    runtime: RuntimeStageState,
    restartController: RestartController,
    eventBus: GameplayEventBus,
  ) {
    this.progress = progress;
    this.runtime = runtime;
    this.restartController = restartController;
    this.eventBus = eventBus;
    this.unsubscribe = eventBus.on("death-requested", (payload) => {
      if (!isStageId(payload.stageId)) {
        return;
      }

      this.handleDeath({
        stageId: payload.stageId,
        cause: payload.cause,
        checkpointId: payload.checkpointId,
      });
    });
  }

  public handleDeath(context: DeathContext): void {
    if (this.handlingDeath) {
      return;
    }

    this.handlingDeath = true;
    this.progress.deathsTotal += 1;
    this.progress.deathsByStage[context.stageId] =
      (this.progress.deathsByStage[context.stageId] ?? 0) + 1;
    this.runtime.currentStageCoins = 0;
    this.runtime.attempt += 1;

    const now = performance.now();
    this.eventBus.emit("death", {
      stageId: context.stageId,
      cause: context.cause,
      checkpointId: context.checkpointId,
      now,
    });
    this.restartController.restartAtCheckpointOrSpawn();
    this.handlingDeath = false;
  }

  public getDeathCount(stageId?: StageId): number {
    if (!stageId) {
      return this.progress.deathsTotal;
    }

    return this.progress.deathsByStage[stageId] ?? 0;
  }

  public destroy(): void {
    this.unsubscribe();
  }
}
