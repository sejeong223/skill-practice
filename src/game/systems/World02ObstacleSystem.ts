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
  private catSprite?: ObstacleSprite;
  private scratchMarks?: Phaser.GameObjects.Graphics;
  private attackPending = false;
  private attackRemainingMs = 0;
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
      const sprite = { definition, image, zone };
      this.sprites.push(sprite);

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
      } else {
        this.catSprite = sprite;
        this.colliders.push(scene.physics.add.overlap(player, zone, () => {
          this.handleCatContact(sprite);
        }));
      }
    }
  }

  public update(delta: number): void {
    if (!this.attackPending || this.destroyed) return;
    this.attackRemainingMs = Math.max(0, this.attackRemainingMs - Math.max(0, delta));
    if (this.attackRemainingMs <= 180) this.clearScratchMarks();
    if (this.attackRemainingMs > 0) return;

    this.attackPending = false;
    this.player.unlockControl("world02-cat-scratch");
    if (!this.canHandleContact()) return;
    this.eventBus.emit("death-requested", {
      stageId: this.stageId,
      cause: "trap",
      checkpointId: this.getCheckpointId(),
      now: this.scene.time.now,
    });
  }

  public resetForAttempt(): void {
    this.attackPending = false;
    this.attackRemainingMs = 0;
    this.catSprite?.image.setTexture("world-02-obstacle-sleeping-fat-cat");
    this.clearScratchMarks();
    this.player.unlockControl("world02-cat-scratch");
  }

  private handleCatContact(sprite: ObstacleSprite): void {
    if (this.destroyed || this.attackPending || !this.canHandleContact()) return;
    this.attackPending = true;
    this.attackRemainingMs = 360;
    this.player.lockControl("world02-cat-scratch");
    this.player.setVelocity(0, 0);
    sprite.image.setTexture("world-02-obstacle-scratching-fat-cat");
    this.drawScratchMarks(sprite);
    this.eventBus.emit("world02-cat-scratch", {
      obstacleId: sprite.definition.id,
      now: this.scene.time.now,
    });
  }

  private drawScratchMarks(sprite: ObstacleSprite): void {
    this.clearScratchMarks();
    const direction = this.player.x < sprite.definition.x ? 1 : -1;
    const marks = this.scene.add.graphics()
      .setPosition(this.player.x + direction * 18, sprite.definition.groundY - 34)
      .setDepth(11);
    marks.fillStyle(0xfff0d8, 1);
    for (let line = 0; line < 3; line++) {
      for (let step = 0; step < 6; step++) {
        marks.fillRect(direction * step * 3, line * 7 - step * 2, 3, 3);
      }
    }
    this.scratchMarks = marks;
  }

  private clearScratchMarks(): void {
    this.scratchMarks?.destroy();
    this.scratchMarks = undefined;
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.attackPending = false;
    this.attackRemainingMs = 0;
    this.clearScratchMarks();
    this.player.unlockControl("world02-cat-scratch");
    for (const collider of this.colliders) collider.destroy();
    for (const { image, zone } of this.sprites) {
      zone.destroy();
      image.destroy();
    }
    this.colliders.length = 0;
    this.sprites.length = 0;
    this.catSprite = undefined;
  }
}
