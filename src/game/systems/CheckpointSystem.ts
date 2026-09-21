import { GameplayEventBus } from "../core/events";
import type { CheckpointSnapshot } from "../core/runtimeTypes";
import type { RuntimeStageState, StageId } from "../core/types";
import { Player } from "../entities/Player";

export class CheckpointSystem {
  private readonly player: Player;
  private readonly eventBus: GameplayEventBus;
  private readonly stageId: StageId;
  private readonly runtime: RuntimeStageState;
  private snapshot: CheckpointSnapshot | null = null;

  public constructor(
    player: Player,
    eventBus: GameplayEventBus,
    stageId: StageId,
    runtime: RuntimeStageState,
  ) {
    this.player = player;
    this.eventBus = eventBus;
    this.stageId = stageId;
    this.runtime = runtime;
  }

  public activate(
    checkpointId: string,
    x: number,
    y: number,
    facing: 1 | -1,
    now: number,
  ): boolean {
    if (this.snapshot) {
      return false;
    }

    this.snapshot = {
      checkpointId,
      stageId: this.stageId,
      x,
      y,
      facing,
    };
    this.runtime.checkpointId = checkpointId;
    this.runtime.checkpointUsed = true;
    this.eventBus.emit("checkpoint-reached", {
      stageId: this.stageId,
      checkpointId,
      x,
      y,
      now,
    });
    return true;
  }

  public getSnapshot(): CheckpointSnapshot | null {
    return this.snapshot;
  }

  public getRespawnPosition(): CheckpointSnapshot | null {
    return this.snapshot;
  }

  public resetForStage(): void {
    this.snapshot = null;
    this.runtime.checkpointId = null;
    this.runtime.checkpointUsed = false;
  }

  public getPlayer(): Player {
    return this.player;
  }
}
