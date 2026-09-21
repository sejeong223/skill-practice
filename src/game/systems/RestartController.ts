import * as Phaser from "phaser";
import { GameplayEventBus } from "../core/events";
import type { CheckpointSnapshot } from "../core/runtimeTypes";
import type { RuntimeStageState, StageId } from "../core/types";
import { Player } from "../entities/Player";
import { CheckpointSystem } from "./CheckpointSystem";

export class RestartController {
  private readonly player: Player;
  private readonly checkpointSystem: CheckpointSystem;
  private readonly spawn: { x: number; y: number; facing: 1 | -1 };
  private readonly stageId: StageId;
  private readonly runtime: RuntimeStageState;
  private readonly eventBus: GameplayEventBus;
  private readonly onRestart?: () => void;
  private readonly onMapRestore?: (snapshot: CheckpointSnapshot | null) => void;

  public constructor(
    player: Player,
    checkpointSystem: CheckpointSystem,
    spawn: { x: number; y: number; facing: 1 | -1 },
    stageId: StageId,
    runtime: RuntimeStageState,
    eventBus: GameplayEventBus,
    onRestart?: () => void,
    onMapRestore?: (snapshot: CheckpointSnapshot | null) => void,
  ) {
    this.player = player;
    this.checkpointSystem = checkpointSystem;
    this.spawn = spawn;
    this.stageId = stageId;
    this.runtime = runtime;
    this.eventBus = eventBus;
    this.onRestart = onRestart;
    this.onMapRestore = onMapRestore;
  }

  public restartAtCheckpointOrSpawn(): void {
    const target = this.checkpointSystem.getRespawnPosition() ?? this.spawn;

    this.player.resetTo(new Phaser.Math.Vector2(target.x, target.y));
    this.player.setFlipX(target.facing < 0);
    this.onMapRestore?.(this.checkpointSystem.getSnapshot());
    this.onRestart?.();
    this.eventBus.emit("restart", {
      stageId: this.stageId,
      checkpointId: this.runtime.checkpointId,
      attempt: this.runtime.attempt,
      now: performance.now(),
    });
  }
}
