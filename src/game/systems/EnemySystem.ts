import * as Phaser from "phaser";
import type { EnemyDefinition } from "../core/contentTypes";
import { GameplayEventBus } from "../core/events";
import type { StageId } from "../core/types";
import { Enemy } from "../entities/Enemy";
import { Player } from "../entities/Player";

export class EnemySystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly eventBus: GameplayEventBus;
  private readonly stageId: StageId;
  private readonly getCheckpointId: () => string | null;
  private definitions: readonly EnemyDefinition[] = [];
  private enemies: Enemy[] = [];
  private lastContactAt = new Map<string, number>();
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

  public spawn(definitions: readonly EnemyDefinition[]): void {
    this.clear();
    this.definitions = definitions;
    this.enemies = definitions.map((definition) => {
      const enemy = new Enemy(this.scene, definition);
      this.scene.physics.add.overlap(this.player, enemy, () => {
        this.handleContact(enemy);
      });
      return enemy;
    });
  }

  public update(time: number): void {
    this.currentTime = time;

    for (const enemy of this.enemies) {
      enemy.updateMovement(time);
    }
  }

  public damageEnemy(enemyId: string, amount: number, now: number): boolean {
    const enemy = this.enemies.find((candidate) => candidate.definition.id === enemyId);

    if (!enemy || !enemy.takeDamage(amount, now)) {
      return false;
    }

    if (!enemy.active) {
      this.eventBus.emit("enemy-defeated", {
        enemyId,
        loot: enemy.definition.loot,
        now,
      });
    }

    return true;
  }

  public getActiveEnemies(): readonly Enemy[] {
    return this.enemies.filter((enemy) => enemy.active);
  }

  public damageInFront(amount: number, now: number): boolean {
    const direction = this.player.flipX ? -1 : 1;
    const target = this.getActiveEnemies().find((enemy) => {
      const distance = enemy.x - this.player.x;
      return Math.abs(distance) <= 92 && Math.sign(distance || direction) === direction;
    });

    return target ? this.damageEnemy(target.definition.id, amount, now) : false;
  }

 public resetForAttempt(): void {
    this.spawn(this.definitions);
    this.lastContactAt.clear();
  }

  public clear(): void {
    for (const enemy of this.enemies) {
      enemy.destroy();
    }
    this.enemies = [];
  }

  public destroy(): void {
    this.clear();
  }

  private handleContact(enemy: Enemy): void {
    if (!enemy.active) {
      return;
    }

    const lastContact = this.lastContactAt.get(enemy.definition.id) ?? -Infinity;
    if (this.currentTime - lastContact < 300) {
      return;
    }

    this.lastContactAt.set(enemy.definition.id, this.currentTime);
    this.eventBus.emit("enemy-contact", {
      enemyId: enemy.definition.id,
      damage: enemy.contactDamage,
      now: this.currentTime,
    });
    this.eventBus.emit("death-requested", {
      stageId: this.stageId,
      cause: "enemy",
      checkpointId: this.getCheckpointId(),
      now: this.currentTime,
    });
  }
}
