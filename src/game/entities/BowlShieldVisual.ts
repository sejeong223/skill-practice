import type * as Phaser from "phaser";
import type { GameplayEventBus } from "../core/events";
import type { DefenseToolSystem } from "../systems/DefenseToolSystem";
import type { Player } from "./Player";

interface BowlHeadAnchor { readonly x: number; readonly y: number; }
const HEAD_ANCHORS: readonly BowlHeadAnchor[] = [
  { x: 22, y: -75 }, { x: 22, y: -75 }, { x: 22, y: -76 }, { x: 22, y: -76 },
];

export class BowlShieldVisual {
  private readonly image: Phaser.GameObjects.Image;
  private elapsedMs = 0;
  private flashUntil = 0;
  private readonly unsubscribeClang: () => void;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly defense: DefenseToolSystem,
    eventBus: GameplayEventBus,
  ) {
    // The generated 64x40 canvas includes transparent margins; the bowl itself is 43x20.
    this.image = scene.add.image(0, 0, "corgi-bowl-shield")
      .setDisplaySize(64, 40).setOrigin(0.5).setDepth(player.depth + 2).setVisible(false);
    this.unsubscribeClang = eventBus.on("clang", ({ toolId }) => {
      if (toolId === "upside-down-bowl") this.flashUntil = this.elapsedMs + 140;
    });
    scene.events.on("postupdate", this.syncPosition, this);
  }

  public update(delta: number, combatActive: boolean): void {
    if (!combatActive) {
      this.image.setVisible(false);
      return;
    }
    this.elapsedMs += Math.min(delta, 50);
    const flashing = this.elapsedMs < this.flashUntil;
    const visible = this.defense.getRemainingCharges() > 0 || flashing;
    this.image.setVisible(visible);
    if (!visible) return;
    this.syncPosition();
  }

  private syncPosition(): void {
    if (!this.image.visible) return;
    const flashing = this.elapsedMs < this.flashUntil;
    const frame = this.player.getAnimationState() === "run" ? Number(this.player.frame.name) : 0;
    const anchor = HEAD_ANCHORS[frame] ?? HEAD_ANCHORS[0];
    this.image.setPosition(
      this.player.x + anchor.x * (this.player.flipX ? -1 : 1),
      this.player.y + anchor.y - (flashing ? 2 : 0),
    ).setFlipX(this.player.flipX);
    if (flashing) this.image.setTintFill(0xe5f4ff);
    else this.image.clearTint();
  }

  public reset(): void {
    this.elapsedMs = 0;
    this.flashUntil = 0;
    this.image.clearTint().setVisible(false);
  }

  public destroy(): void {
    this.scene.events.off("postupdate", this.syncPosition, this);
    this.unsubscribeClang();
    this.image.destroy();
  }
}
