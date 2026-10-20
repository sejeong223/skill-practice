import * as Phaser from "phaser";
import { GameplayEventBus } from "../core/events";
import type { StageId } from "../core/types";
import type { World02ObstacleDefinition } from "../data/world02Obstacles";
import { Player } from "../entities/Player";

interface ObstacleSprite {
  readonly definition: World02ObstacleDefinition;
  readonly image: Phaser.GameObjects.Image;
  readonly zone: Phaser.GameObjects.Zone;
}

export class World02ObstacleSystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly eventBus: GameplayEventBus;
  private readonly stageId: StageId;
  private readonly getCheckpointId: () => string | null;
  private readonly canHandleContact: () => boolean;
  private readonly sprites: ObstacleSprite[] = [];
  private readonly colliders: Phaser.Physics.Arcade.Collider[] = [];
  private destroyed = false;

  public constructor(
    scene: Phaser.Scene,
    player: Player,
    eventBus: GameplayEventBus,
    stageId: StageId,
    definitions: readonly World02ObstacleDefinition[],
    getCheckpointId: () => string | null,
    canHandleContact: () => boolean,
  ) {
    this.scene = scene;
    this.player = player;
    this.eventBus = eventBus;
    this.stageId = stageId;
    this.getCheckpointId = getCheckpointId;
    this.canHandleContact = canHandleContact;

    for (const definition of definitions) {
      const image = scene.add.image(definition.x, definition.groundY, definition.textureKey)
        .setOrigin(0.5, 1)
        .setDepth(2);
      const zone = scene.add.zone(
        definition.x,
        definition.groundY - definition.hitbox.height / 2,
        definition.hitbox.width,
        definition.hitbox.height,
      );
      scene.physics.add.existing(zone, true);
      (zone.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
      this.sprites.push({ definition, image, zone });

      if (definition.contact === "instant-death") {
        this.colliders.push(scene.physics.add.overlap(player, zone, () => {
          if (this.destroyed || !this.canHandleContact()) return;
          this.eventBus.emit("death-requested", {
            stageId: this.stageId,
            cause: "trap",
            checkpointId: this.getCheckpointId(),
            now: this.scene.time.now,
          });
        }));
      }
    }
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const collider of this.colliders) collider.destroy();
    for (const { image, zone } of this.sprites) {
      zone.destroy();
      image.destroy();
    }
    this.colliders.length = 0;
    this.sprites.length = 0;
  }
}
