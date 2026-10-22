import * as Phaser from "phaser";
import type { StageId } from "../core/types";
import { GameplayEventBus } from "../core/events";
import { getWorld03Obstacles } from "../data/world03Construction";
import { Player } from "../entities/Player";

export class World03ConstructionObstacles {
  private readonly sprites: Phaser.GameObjects.Image[] = [];
  private readonly zones: Phaser.GameObjects.Zone[] = [];
  private readonly colliders: Phaser.Physics.Arcade.Collider[] = [];
  private destroyed = false;
  private contactPending = false;

  public constructor(
    scene: Phaser.Scene,
    player: Player,
    stageId: StageId,
    eventBus: GameplayEventBus,
    getCheckpointId: () => string | null,
    canHandleContact: () => boolean,
  ) {
    for (const obstacle of getWorld03Obstacles(stageId)) {
      const image = scene.add.image(obstacle.x, 504, `world-03-${obstacle.kind}`)
        .setOrigin(0.5, 1)
        .setDepth(2);
      const zone = scene.add.zone(
        obstacle.x,
        504 - obstacle.height / 2,
        obstacle.width,
        obstacle.height,
      );
      scene.physics.add.existing(zone, true);
      (zone.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
      this.sprites.push(image);
      this.zones.push(zone);
      this.colliders.push(scene.physics.add.overlap(player, zone, () => {
        if (this.destroyed || this.contactPending || !canHandleContact()) return;
        this.contactPending = true;
        eventBus.emit("death-requested", {
          stageId,
          cause: "trap",
          checkpointId: getCheckpointId(),
          now: scene.time.now,
        });
      }));
    }
  }

  public resetForAttempt(): void {
    this.contactPending = false;
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const collider of this.colliders) collider.destroy();
    for (const zone of this.zones) zone.destroy();
    for (const image of this.sprites) image.destroy();
    this.colliders.length = 0;
    this.zones.length = 0;
    this.sprites.length = 0;
  }
}
