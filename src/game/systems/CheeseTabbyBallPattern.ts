import * as Phaser from "phaser";
import type { Player } from "../entities/Player";
import type { BossHazardHit, BossPattern } from "./BossPattern";
import { advanceCheeseBall, sweptCheeseBallBounds, type CheeseBallMotion } from "./cheeseTabbyBallPhysics";

interface ActiveBall {
  readonly id: string;
  readonly image: Phaser.GameObjects.Image;
  motion: CheeseBallMotion;
}

export class CheeseTabbyBallPattern implements BossPattern {
  public readonly warningText = "고무공이 온다!";
  private readonly balls: ActiveBall[] = [];
  private readonly shadows: Phaser.GameObjects.Ellipse[] = [];
  private throwPoseMs = 0;
  private destroyed = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly bossSprite: Phaser.GameObjects.Sprite,
    private readonly onWhistle: () => void,
  ) {}

  public telegraph(): void {
    if (this.destroyed) return;
    this.bossSprite.setFrame(1);
    this.onWhistle();
  }

  public launch(targetX: number, serial: number): void {
    if (this.destroyed) return;
    const direction = targetX < this.bossSprite.x ? -1 : 1;
    const x = this.bossSprite.x + direction * 42;
    const y = this.bossSprite.y + 12;
    const image = this.scene.add.image(x, y, "world-02-boss-rubber-ball")
      .setDisplaySize(32, 32).setDepth(11);
    const speed = Math.max(330, Math.min(440, Math.abs(targetX - x) / 2.65));
    this.balls.push({
      id: `cheese-ball-${serial}`,
      image,
      motion: { x, y, vx: direction * speed, vy: -420, bounces: 0, ageMs: 0 },
    });
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
    this.shadows.splice(0).forEach((shadow) => shadow.destroy());
    for (const ball of [...this.balls]) {
      const previous = ball.motion;
      const current = advanceCheeseBall(previous, delta);
      if (!current || current.x < -36 || current.x > this.scene.physics.world.bounds.right + 36) {
        this.remove(ball);
        continue;
      }
      ball.motion = current;
      ball.image.setPosition(current.x, current.y);
      if (current.bounces === 1) {
        this.shadows.push(this.scene.add.ellipse(current.x, 502, 28, 5, 0x443847, 0.22).setDepth(1));
      }
      const bounds = sweptCheeseBallBounds(previous, current);
      hits.push({
        id: ball.id,
        bounds: new Phaser.Geom.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height),
        sourceX: this.bossSprite.x,
        kind: "weak",
      });
    }
    return hits;
  }

  public clear(): void {
    this.balls.splice(0).forEach(({ image }) => image.destroy());
    this.shadows.splice(0).forEach((shadow) => shadow.destroy());
    this.throwPoseMs = 0;
    if (!this.destroyed) this.bossSprite.setFrame(0);
  }

  public destroy(): void {
    this.clear();
    this.destroyed = true;
  }

  private remove(ball: ActiveBall): void {
    const index = this.balls.indexOf(ball);
    if (index >= 0) this.balls.splice(index, 1);
    ball.image.destroy();
  }
}
