import { GameplayEventBus } from "../core/events";
import type { CheckpointSnapshot, MapRuntimeSnapshot } from "../core/runtimeTypes";
import type { RuntimeStageState, StageId } from "../core/types";
import type { Player } from "../entities/Player";

export interface CheckpointActivationOptions {
  readonly silent?: boolean;
}

export class CheckpointSystem {
  private readonly player: Player;
  private readonly eventBus: GameplayEventBus;
  private readonly stageId: StageId;
  private readonly runtime: RuntimeStageState;
  private readonly createMapSnapshot?: (checkpointId: string) => MapRuntimeSnapshot | null;
  private readonly isFakeCheckpoint?: (checkpointId: string) => boolean;
  private snapshot: CheckpointSnapshot | null = null;

  public constructor(
    player: Player,
    eventBus: GameplayEventBus,
    stageId: StageId,
    runtime: RuntimeStageState,
    createMapSnapshot?: (checkpointId: string) => MapRuntimeSnapshot | null,
    isFakeCheckpoint?: (checkpointId: string) => boolean,
  ) {
    this.player = player;
    this.eventBus = eventBus;
    this.stageId = stageId;
    this.runtime = runtime;
    this.createMapSnapshot = createMapSnapshot;
    this.isFakeCheckpoint = isFakeCheckpoint;
  }

  public activate(
    checkpointId: string,
    x: number,
    y: number,
    facing: 1 | -1,
    now: number,
    options?: CheckpointActivationOptions,
  ): boolean {
    if (this.snapshot || this.isFakeCheckpoint?.(checkpointId)) {
      return false;
    }

    this.snapshot = {
      checkpointId,
      stageId: this.stageId,
      x,
      y,
      facing,
      randomSeed: this.runtime.randomSeed,
      mapSnapshotVersion: this.runtime.mapSnapshotVersion,
      mapSnapshot: this.createMapSnapshot?.(checkpointId) ?? undefined,
    };
    this.runtime.checkpointId = checkpointId;
    this.runtime.checkpointUsed = true;
    this.runtime.checkpointSeed = this.runtime.randomSeed;
    if (!options?.silent) {
      this.eventBus.emit("checkpoint-reached", {
        stageId: this.stageId,
        checkpointId,
        x,
        y,
        now,
      });
    }
    return true;
  }

  public getSnapshot(): CheckpointSnapshot | null {
    return this.snapshot;
  }

  public restore(snapshot: CheckpointSnapshot): boolean {
    if (snapshot.stageId !== this.stageId || this.isFakeCheckpoint?.(snapshot.checkpointId)) return false;
    this.snapshot = structuredClone(snapshot);
    this.runtime.checkpointId = snapshot.checkpointId;
    this.runtime.checkpointUsed = true;
    this.runtime.randomSeed = snapshot.randomSeed ?? this.runtime.randomSeed;
    this.runtime.checkpointSeed = this.runtime.randomSeed;
    this.runtime.mapSnapshotVersion = snapshot.mapSnapshotVersion ?? 0;
    return true;
  }

  public getRespawnPosition(): CheckpointSnapshot | null {
    return this.snapshot;
  }

  public resetForStage(): void {
    this.snapshot = null;
    this.runtime.checkpointId = null;
    this.runtime.checkpointUsed = false;
    this.runtime.checkpointSeed = null;
    this.runtime.mapSnapshotVersion = 0;
  }

  public getPlayer(): Player {
    return this.player;
  }
}
