import * as Phaser from "phaser";
import type { EnemyDefinition } from "../core/contentTypes";

const ENEMY_TEXTURE_KEY = "__enemy-placeholder";

export class Enemy extends Phaser.Physics.Arcade.Image {
  public declare readonly body: Phaser.Physics.Arcade.Body;
  public readonly definition: EnemyDefinition;
  public health: number;
  public stunnedUntil = 0;
  public patrolState: "left" | "right" = "right";
  public readonly contactDamage: number;

  public constructor(
    scene: Phaser.Scene,
    definition: EnemyDefinition,
  ) {
    Enemy.ensurePlaceholderTexture(scene);
    super(
      scene,
      definition.spawn.x,
      definition.spawn.y,
      ENEMY_TEXTURE_KEY,
    );
    this.definition = definition;
    this.health = definition.health;
    this.contactDamage = definition.contactDamage;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDisplaySize(36, 36);
    this.body.setAllowGravity(false);
    this.body.setSize(30, 30);
  }

  public updateMovement(now: number): void {
    if (!this.active) {
      return;
    }

    if (now < this.stunnedUntil) {
      this.setVelocityX(0);
      return;
    }

    const { minX, maxX, speed } = this.definition.patrol;
    const direction = this.patrolState === "right" ? 1 : -1;
    this.setVelocityX(direction * speed);

    if (this.x >= maxX) {
      this.patrolState = "left";
      this.setFlipX(true);
    } else if (this.x <= minX) {
      this.patrolState = "right";
      this.setFlipX(false);
    }
  }

  public takeDamage(amount: number, now: number, stunMs = 300): boolean {
    if (!this.active || amount <= 0) {
      return false;
    }

    this.health = Math.max(0, this.health - amount);
    this.stunnedUntil = now + stunMs;

    if (this.health === 0) {
      this.setActive(false);
      this.setVisible(false);
      this.body.enable = false;
    }

    return true;
  }

  private static ensurePlaceholderTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(ENEMY_TEXTURE_KEY)) {
      return;
    }

    const graphics = scene.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0x272331, 1);
    graphics.fillRect(3, 4, 26, 23);
    graphics.fillStyle(0xf2d8b0, 1);
    graphics.fillRect(8, 15, 16, 10);
    graphics.fillStyle(0xf18a72, 1);
    graphics.fillRect(7, 2, 6, 6);
    graphics.fillRect(19, 2, 6, 6);
    graphics.generateTexture(ENEMY_TEXTURE_KEY, 32, 32);
    graphics.destroy();
  }
}
