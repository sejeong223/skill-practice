import type * as Phaser from "phaser";
import { Player } from "./Player";
import { DEFAULT_PLAYER_TUNING } from "./playerTypes";

const RUN_FRAME_RATE = 10;
export const BARK_PRESENTATION_MS = 450;
export const BITE_PRESENTATION_MS = 320;
const BARK_FOOT_ANCHOR = 99;
const SLIPPER_SWING_MS = 220;
// Opaque paw rows in corgi-run.png, measured per animation frame.
const RUN_FRAME_FOOT_ANCHORS = [99, 99, 100, 104] as const;

export class PlayerAnimator {
  private readonly player: Player;
  private activeAnimationKey: string | null = null;
  private barkRemainingMs = 0;
  private biteStartedAt = 0;
  private biteUntil = 0;
  private slipperImage?: Phaser.GameObjects.Image;
  private slipperSwingStartedAt = 0;
  private slipperSwingUntil = 0;
  private slipperFacing: -1 | 1 = 1;

  public constructor(player: Player) {
    this.player = player;
    this.player.on("animationupdate", this.syncRunFootAnchor, this);
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

  public triggerBark(): void {
    const barkTextureKey = this.player.getAppearanceTextures().bark;
    if (!this.player.scene.textures.exists(barkTextureKey)) return;
    this.stopBite();
    this.barkRemainingMs = BARK_PRESENTATION_MS;
    this.player.anims.stop();
    this.player.anims.timeScale = 1;
    this.activeAnimationKey = null;
    this.player.setTexture(barkTextureKey);
    this.player.alignFeetToFrame(BARK_FOOT_ANCHOR);
  }

  public stopBark(): void {
    this.barkRemainingMs = 0;
    if (!this.player.scene || this.player.texture?.key !== this.player.getAppearanceTextures().bark) return;
    this.player.setTexture(this.player.getAppearanceTextures().run, 0);
    this.player.alignFeetToFrame(RUN_FRAME_FOOT_ANCHORS[0]);
    this.player.anims.timeScale = 1;
    this.activeAnimationKey = null;
  }

  public triggerBite(now: number): void {
    const biteKey = this.player.getAppearanceTextures().bite;
    if (!biteKey || !this.player.scene.textures.exists(biteKey)) return;
    this.stopBark();
    this.player.anims.stop();
    this.player.anims.timeScale = 1;
    this.activeAnimationKey = null;
    this.biteStartedAt = now;
    this.biteUntil = now + BITE_PRESENTATION_MS;
    this.player.setTexture(biteKey, 0);
    this.player.alignFeetToFrame(RUN_FRAME_FOOT_ANCHORS[0]);
    this.updateBite(now);
  }

  public stopBite(): void {
    if (this.biteUntil <= 0) return;
    this.biteUntil = 0;
    if (!this.player.scene) return;
    const { run, bite } = this.player.getAppearanceTextures();
    if (this.player.texture?.key === bite) {
      this.player.setTexture(run, 0);
      this.player.alignFeetToFrame(RUN_FRAME_FOOT_ANCHORS[0]);
    }
    this.player.anims.timeScale = 1;
    this.activeAnimationKey = null;
  }

  public update(now = this.player.scene.time.now, deltaMs = 0): void {
    this.updateSlipperSwing(now);
    if (this.updateBite(now)) return;
    if (this.barkRemainingMs > 0) {
      this.barkRemainingMs = Math.max(0, this.barkRemainingMs - (Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0));
      if (this.barkRemainingMs > 0) return;
      this.stopBark();
    }
    if (this.player.getAnimationState() === "run") {
      this.playRunAnimation();
      this.player.anims.timeScale = Math.min(1.25, Math.max(
        0.15, Math.abs(this.player.body.velocity.x) / DEFAULT_PLAYER_TUNING.runSpeed,
      ));
      this.syncRunFootAnchor();
      return;
    }

    if (this.activeAnimationKey !== null) {
      this.player.anims.stop();
      this.player.anims.timeScale = 1;
      this.activeAnimationKey = null;
      this.player.setTexture(this.player.getAppearanceTextures().run, 0);
    }

    this.player.alignFeetToFrame(RUN_FRAME_FOOT_ANCHORS[0]);
  }

  public destroy(): void {
    this.stopBark();
    this.stopBite();
    this.player.off("animationupdate", this.syncRunFootAnchor, this);
    this.slipperImage?.destroy();
    this.slipperImage = undefined;
  }

  public stopSlipperSwing(): void {
    this.slipperImage?.setVisible(false);
  }

  private syncRunFootAnchor(): void {
    if (this.player.texture.key !== this.player.getAppearanceTextures().run) return;
    const frameIndex = Number(this.player.frame.name);
    this.player.alignFeetToFrame(RUN_FRAME_FOOT_ANCHORS[frameIndex] ?? RUN_FRAME_FOOT_ANCHORS[0]);
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

  private updateBite(now: number): boolean {
    if (this.biteUntil <= 0) return false;
    if (now >= this.biteUntil) {
      this.stopBite();
      return false;
    }
    const biteKey = this.player.getAppearanceTextures().bite;
    if (!biteKey || !this.player.scene.textures.exists(biteKey)) {
      this.stopBite();
      return false;
    }
    const frame = Math.min(3, Math.floor(Math.max(0, now - this.biteStartedAt) / 80));
    if (this.player.texture.key !== biteKey) this.player.setTexture(biteKey, frame);
    else if (Number(this.player.frame.name) !== frame) this.player.setFrame(frame);
    this.player.alignFeetToFrame(RUN_FRAME_FOOT_ANCHORS[frame]);
    return true;
  }

  private playRunAnimation(): void {
    const scene = this.player.scene;
    const runAnimationKey = this.player.getAppearanceTextures().run;
    if (!scene.anims.exists(runAnimationKey)) {
      scene.anims.create({
        key: runAnimationKey,
        frames: scene.anims.generateFrameNumbers(runAnimationKey, {
          start: 0,
          end: -1,
        }),
        frameRate: RUN_FRAME_RATE,
        repeat: -1,
      });
    }

    if (this.activeAnimationKey !== runAnimationKey) {
      this.player.setTexture(runAnimationKey, 0);
      this.player.anims.play(runAnimationKey, true);
      this.activeAnimationKey = runAnimationKey;
    }
  }
}
