import { GameplayEventBus } from "../core/events";
import { GameEventBus } from "../bridge/GameEventBus";
import { isStageId } from "../data/validateContent";
import type { ProgressState, RuntimeStageState, StageId } from "../core/types";
import type { RestartController } from "./RestartController";
import type { GimmickOutcome } from "../core/contentTypes";

export interface DeathContext {
  stageId: StageId;
  cause: "enemy" | "trap" | "fall" | "tool-drawback" | "scripted";
  checkpointId: string | null;
  gimmickId?: string;
  outcome?: GimmickOutcome["kind"];
}

export class DeathSystem {
  private readonly progress: ProgressState;
  private readonly runtime: RuntimeStageState;
  private readonly restartController: RestartController;
  private readonly eventBus: GameplayEventBus;
  private readonly persistenceEventBus?: GameEventBus;
  private readonly unsubscribe: () => void;
  private readonly canHandleDeath: () => boolean;
  private handlingDeath = false;
  private destroyed = false;

  public constructor(
    progress: ProgressState,
    runtime: RuntimeStageState,
    restartController: RestartController,
    eventBus: GameplayEventBus,
    persistenceEventBus?: GameEventBus,
    canHandleDeath: () => boolean = () => true,
  ) {
    this.progress = progress;
    this.runtime = runtime;
    this.restartController = restartController;
    this.eventBus = eventBus;
    this.persistenceEventBus = persistenceEventBus;
    this.canHandleDeath = canHandleDeath;
    this.unsubscribe = eventBus.on("death-requested", (payload) => {
      if (!isStageId(payload.stageId)) {
        return;
      }

      this.handleDeath({
        stageId: payload.stageId,
        cause: payload.cause,
        checkpointId: payload.checkpointId,
        gimmickId: payload.gimmickId,
        outcome: payload.outcome,
      });
    });
  }

  public handleDeath(context: DeathContext): void {
    if (this.destroyed || this.handlingDeath || context.stageId !== this.runtime.stageId || !this.canHandleDeath()) {
      return;
    }

    this.handlingDeath = true;
    try {
      this.progress.deathsTotal += 1;
      this.progress.deathsByStage[context.stageId] =
        (this.progress.deathsByStage[context.stageId] ?? 0) + 1;
      this.persistenceEventBus?.emit("death-count-updated", {
        stageId: context.stageId,
        deathsTotal: this.progress.deathsTotal,
      });
      this.persistenceEventBus?.emit("death", {
        stageId: context.stageId,
        cause: context.cause,
      });
      this.runtime.currentStageCoins = 0;
      this.runtime.attempt += 1;

      const now = performance.now();
      this.eventBus.emit("death", {
        stageId: context.stageId,
        cause: context.cause,
        checkpointId: context.checkpointId,
        ...(context.gimmickId ? { gimmickId: context.gimmickId } : {}),
        ...(context.outcome ? { outcome: context.outcome } : {}),
        now,
      });
      this.restartController.restartAtCheckpointOrSpawn();
    } finally {
      // Ignore other collision callbacks from this update, including requests
      // made during the synchronous restart. The next update can count again.
      queueMicrotask(() => { this.handlingDeath = false; });
    }
  }

  public getDeathCount(stageId?: StageId): number {
    if (!stageId) {
      return this.progress.deathsTotal;
    }

    return this.progress.deathsByStage[stageId] ?? 0;
  }

  public destroy(): void {
    this.destroyed = true;
    this.unsubscribe();
  }
}
