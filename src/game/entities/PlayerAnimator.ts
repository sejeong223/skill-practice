import type * as Phaser from "phaser";
import { Player } from "./Player";

const RUN_ANIMATION_KEY = "corgi-run";
const RUN_FRAME_RATE = 10;
const SLIPPER_SWING_MS = 220;
// Opaque paw rows in corgi-run.png, measured per animation frame.
const RUN_FRAME_FOOT_ANCHORS = [99, 99, 100, 104] as const;

export class PlayerAnimator {
  private readonly player: Player;
  private activeAnimationKey: string | null = null;
  private slipperImage?: Phaser.GameObjects.Image;
  private slipperSwingStartedAt = 0;
  private slipperSwingUntil = 0;
  private slipperFacing: -1 | 1 = 1;

  public constructor(player: Player) {
    this.player = player;
  }

  public triggerSlipperSwing(now: number): void {
    this.slipperImage ??= this.player.scene.add.image(0, 0, "intro-slipper")
      .setDepth(this.player.depth + 1);
    this.slipperSwingStartedAt = now;
    this.slipperSwingUntil = now + SLIPPER_SWING_MS;
    this.slipperFacing = this.player.flipX ? -1 : 1;
    this.slipperImage.setFlipX(this.slipperFacing < 0).setVisible(true);
    this.updateSlipperSwing(now);
  }

  public update(now = this.player.scene.time.now): void {
    this.updateSlipperSwing(now);
    if (this.player.getAnimationState() === "run") {
      this.playRunAnimation();
      const frameIndex = Number(this.player.frame.name);
      const footAnchor =
        RUN_FRAME_FOOT_ANCHORS[frameIndex] ?? RUN_FRAME_FOOT_ANCHORS[0];
      this.player.alignFeetToFrame(footAnchor);
      return;
    }

    if (this.activeAnimationKey !== null) {
      this.player.anims.stop();
      this.activeAnimationKey = null;
      this.player.setTexture(RUN_ANIMATION_KEY, 0);
    }

    this.player.alignFeetToFrame(RUN_FRAME_FOOT_ANCHORS[0]);
  }

  public destroy(): void {
    this.slipperImage?.destroy();
    this.slipperImage = undefined;
  }

  public stopSlipperSwing(): void {
    this.slipperImage?.setVisible(false);
  }

  private updateSlipperSwing(now: number): void {
    const image = this.slipperImage;
    if (!image || !image.visible) return;
    if (now >= this.slipperSwingUntil) {
      image.setVisible(false);
      return;
    }

    const progress = Math.max(0, (now - this.slipperSwingStartedAt) / SLIPPER_SWING_MS);
    const reach = 48 + progress * 27;
    const size = 62 + Math.sin(progress * Math.PI) * 10;
    image
      .setPosition(this.player.x + this.slipperFacing * reach, this.player.y - 59 + progress * 16)
      .setDisplaySize(size, size)
      .setAngle(this.slipperFacing * (-40 + progress * 85))
      .setAlpha(1 - Math.max(0, progress - 0.7) / 0.3);
  }

  private playRunAnimation(): void {
    const scene = this.player.scene;
    if (!scene.anims.exists(RUN_ANIMATION_KEY)) {
      scene.anims.create({
        key: RUN_ANIMATION_KEY,
        frames: scene.anims.generateFrameNumbers(RUN_ANIMATION_KEY, {
          start: 0,
          end: -1,
        }),
        frameRate: RUN_FRAME_RATE,
        repeat: -1,
      });
    }

    if (this.activeAnimationKey !== RUN_ANIMATION_KEY) {
      this.player.setTexture(RUN_ANIMATION_KEY, 0);
      this.player.anims.play(RUN_ANIMATION_KEY, true);
      this.activeAnimationKey = RUN_ANIMATION_KEY;
    }
  }
}
