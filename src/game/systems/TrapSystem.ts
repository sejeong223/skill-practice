import * as Phaser from "phaser";
import type { TrapDefinition } from "../core/contentTypes";
import { GameplayEventBus } from "../core/events";
import type { StageId } from "../core/types";
import { Player } from "../entities/Player";
import { Trap } from "../entities/Trap";

export class TrapSystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly eventBus: GameplayEventBus;
  private readonly stageId: StageId;
  private readonly getCheckpointId: () => string | null;
  private definitions: readonly TrapDefinition[] = [];
  private traps: Trap[] = [];
  private attemptSeed = 1;
  private lastTriggeredAt = new Map<string, number>();
  private currentTime = 0;

  public constructor(
    scene: Phaser.Scene,
    player: Player,
    eventBus: GameplayEventBus,
    stageId: StageId,
    getCheckpointId: () => string | null,
  ) {
    this.scene = scene;
    this.player = player;
    this.eventBus = eventBus;
    this.stageId = stageId;
    this.getCheckpointId = getCheckpointId;
  }

  public spawn(
    definitions: readonly TrapDefinition[],
    attemptSeed = 1,
  ): void {
    this.clear();
    this.definitions = definitions;
    this.attemptSeed = attemptSeed;
    this.traps = definitions.map((definition, index) => {
      const position = this.resolvePosition(definition, index);
      const trap = new Trap(
        this.scene,
        definition,
        position.x,
        position.y,
      );
      this.scene.physics.add.overlap(this.player, trap, () => {
        this.triggerTrap(trap, this.currentTime);
      });
      return trap;
    });
  }

  public update(time: number): void {
    this.currentTime = time;
  }

  public triggerTrap(trap: Trap, now: number): boolean {
    if (!trap.active) {
      return false;
    }

    const lastTriggered = this.lastTriggeredAt.get(trap.definition.id) ?? -Infinity;
    if (now - lastTriggered < 500) {
      return false;
    }

    this.lastTriggeredAt.set(trap.definition.id, now);
    this.eventBus.emit("trap-triggered", {
      trapId: trap.definition.id,
      lethal: trap.definition.lethal,
      now,
    });

    if (trap.definition.lethal) {
      this.eventBus.emit("death-requested", {
        stageId: this.stageId,
        cause: "trap",
        checkpointId: this.getCheckpointId(),
        now,
      });
    } else {
      const direction = this.player.flipX ? 1 : -1;
      this.player.setVelocityX(direction * 260);
      this.player.setVelocityY(-120);
    }

    return true;
  }

  public resetForAttempt(attemptSeed: number): void {
    this.spawn(this.definitions, attemptSeed);
    this.lastTriggeredAt.clear();
  }

  public getActiveTraps(): readonly Trap[] {
    return this.traps.filter((trap) => trap.active);
  }

  public clear(): void {
    for (const trap of this.traps) {
      trap.destroy();
    }
    this.traps = [];
  }

  public destroy(): void {
    this.clear();
  }

  private resolvePosition(
    definition: TrapDefinition,
    index: number,
  ): { x: number; y: number } {
    if (!definition.randomized) {
      return { x: definition.x, y: definition.y };
    }

    const value = Math.abs(
      this.hash(definition.id + "-" + this.attemptSeed + "-" + index),
    );
    const offset = (value % 3 - 1) * 64;
    return {
      x: definition.x + offset,
      y: definition.y,
    };
  }

  private hash(value: string): number {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(index);
      hash |= 0;
    }

    return hash;
  }
}
