import { Player } from "./Player";
import type { PlayerAnimationState } from "./playerTypes";

const ANIMATION_FRAMERATES: Readonly<Record<PlayerAnimationState, number>> = {
  idle: 4,
  run: 10,
  jump: 6,
  fall: 6,
  hurt: 8,
  death: 8,
  "attack-slipper": 12,
  "attack-bite": 12,
  dash: 14,
  bark: 10,
  "double-jump": 10,
  "tail-rotor": 12,
};

export class PlayerAnimator {
  private readonly player: Player;
  private activeAnimationKey: string | null = null;

  public constructor(player: Player) {
    this.player = player;
  }

  public update(time: number): void {
    const state = this.player.getAnimationState();
    const animationKey = "corgi-" + state;

    if (this.tryPlayAnimation(animationKey, ANIMATION_FRAMERATES[state])) {
      return;
    }

    if (this.activeAnimationKey !== null) {
      this.player.anims.stop();
      this.activeAnimationKey = null;
    }

    this.applyPixelFallback(state, time);
  }

  private tryPlayAnimation(key: string, frameRate: number): boolean {
    const scene = this.player.scene;

    if (!scene.textures.exists(key)) {
      return false;
    }

    if (!scene.anims.exists(key)) {
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(key, {
          start: 0,
          end: -1,
        }),
        frameRate,
        repeat: -1,
      });
    }

    if (this.activeAnimationKey !== key) {
      this.player.anims.play(key, true);
      this.activeAnimationKey = key;
    }

    return true;
  }

  private applyPixelFallback(
    state: PlayerAnimationState,
    time: number,
  ): void {
    const isMoving = state === "run";
    const bob = isMoving
      ? Math.abs(Math.sin(time / 72)) * 2
      : Math.sin(time / 420) * 0.8;
    const tilt = isMoving ? Math.sin(time / 90) * 1.8 : 0;

    this.player.setAngle(tilt);
    this.player.setScale(1, 1 - bob / 160);
  }
}
