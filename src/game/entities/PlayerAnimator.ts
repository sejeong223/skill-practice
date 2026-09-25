import { Player } from "./Player";

const RUN_ANIMATION_KEY = "corgi-run";
const RUN_FRAME_RATE = 10;
// Opaque paw rows in corgi-run.png, measured per animation frame.
const RUN_FRAME_FOOT_ANCHORS = [99, 99, 100, 104] as const;

export class PlayerAnimator {
  private readonly player: Player;
  private activeAnimationKey: string | null = null;

  public constructor(player: Player) {
    this.player = player;
  }

  public update(): void {
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
