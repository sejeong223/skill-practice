import * as Phaser from "phaser";
import type { Player } from "../entities/Player";
import type { BossHazardHit, BossPattern } from "./BossPattern";
import {
  advanceMackerelBrick,
  clampMackerelLanding,
  clearPlayerFromBrick,
  sweptMackerelBrickBounds,
  type MackerelBrickMotion,
} from "./mackerelBrickPhysics";

interface Brick {
  readonly id: string;
  readonly image: Phaser.GameObjects.Image;
  motion: MackerelBrickMotion;
  phase: "flying" | "landed";
  landedMs: number;
  body?: Phaser.GameObjects.Zone;
  collider?: Phaser.Physics.Arcade.Collider;
}

export class MackerelBrickPattern implements BossPattern {
  public readonly warningText = "벽돌 조각!";
  private readonly bricks: Brick[] = [];
  private marker?: Phaser.GameObjects.Ellipse;
  private warnedLandingX?: number;
  private throwPoseMs = 0;
  private destroyed = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly bossSprite: Phaser.GameObjects.Sprite,
  ) {}

  public telegraph(targetX: number): void {
    if (this.destroyed) return;
    this.clearMarker();
    const x = clampMackerelLanding(targetX, this.bossSprite.x, this.scene.physics.world.bounds.right);
    this.warnedLandingX = x;
    this.marker = this.scene.add.ellipse(x, 500, 36, 6, 0xf7cd63, 0.45).setDepth(1);
    this.bossSprite.setFrame(1);
  }

  public launch(targetX: number, serial: number): void {
    if (this.destroyed) return;
    const bossX = this.bossSprite.x;
    const side = targetX < bossX ? -1 : 1;
    const startX = bossX + side * 48;
    const target = this.warnedLandingX ?? clampMackerelLanding(targetX, bossX, this.scene.physics.world.bounds.right);
    this.warnedLandingX = undefined;
    this.clearMarker();
    const distance = Math.abs(target - startX);
    const speed = Math.max(300, Math.min(370, distance / 2.6));
    const motion: MackerelBrickMotion = {
      x: startX, y: this.bossSprite.y - 48,
      startX, startY: this.bossSprite.y - 48,
      targetX: target, elapsedMs: 0, durationMs: Math.max(500, distance / speed * 1000),
    };
    const image = this.scene.add.image(motion.x, motion.y, "world-03-boss-brick")
      .setDisplaySize(32, 32).setDepth(11);
    this.bricks.push({ id: `mackerel-brick-${serial}`, image, motion, phase: "flying", landedMs: 0 });
    this.bossSprite.setFrame(2);
    this.throwPoseMs = 180;
  }

  public update(deltaMs: number): readonly BossHazardHit[] {
    if (this.destroyed) return [];
    const delta = Math.max(0, Math.min(50, deltaMs));
    if (this.throwPoseMs > 0) {
      this.throwPoseMs = Math.max(0, this.throwPoseMs - delta);
      if (this.throwPoseMs === 0) this.bossSprite.setFrame(0);
    }
    const hits: BossHazardHit[] = [];
    for (const brick of [...this.bricks]) {
      if (brick.phase === "landed") {
        brick.landedMs += delta;
        if (brick.landedMs >= 1400) this.remove(brick);
        continue;
      }
      const previous = brick.motion;
      const { motion, landed } = advanceMackerelBrick(previous, delta);
      brick.motion = motion;
      brick.image.setPosition(motion.x, motion.y).setAngle(-motion.elapsedMs * 0.06);
      if (landed) {
        this.land(brick);
        continue;
      }
      const bounds = sweptMackerelBrickBounds(previous, motion);
      hits.push({ id: brick.id, kind: "weak", sourceX: this.bossSprite.x,
        bounds: new Phaser.Geom.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height) });
    }
    return hits;
  }

  public clear(): void {
    this.clearMarker();
    for (const brick of [...this.bricks]) this.remove(brick);
    this.throwPoseMs = 0;
    this.warnedLandingX = undefined;
    if (!this.destroyed) this.bossSprite.setFrame(0);
  }

  public destroy(): void {
    this.clear();
    this.destroyed = true;
  }

  private land(brick: Brick): void {
    const x = clearPlayerFromBrick(brick.motion.targetX, this.player.body.center.x,
      this.bossSprite.x, this.scene.physics.world.bounds.right);
    brick.phase = "landed";
    brick.image.setPosition(x, 492).setAngle(0);
    brick.body = this.scene.add.zone(x, 490, 32, 28);
    this.scene.physics.add.existing(brick.body, true);
    (brick.body.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
    brick.collider = this.scene.physics.add.collider(this.player, brick.body);
    const landed = this.bricks.filter((candidate) => candidate.phase === "landed");
    if (landed.length > 2) this.remove(landed[0]);
  }

  private remove(brick: Brick): void {
    const index = this.bricks.indexOf(brick);
    if (index >= 0) this.bricks.splice(index, 1);
    brick.collider?.destroy();
    brick.body?.destroy();
    brick.image.destroy();
  }

  private clearMarker(): void {
    this.marker?.destroy();
    this.marker = undefined;
  }
}
