import * as Phaser from "phaser";
import type { Player } from "../entities/Player";
import type { BossHazardHit, BossPattern } from "./BossPattern";
import {
  advanceTuxedoScrap, chooseTuxedoDrag, clampTuxedoTarget,
  sweptTuxedoScrapBounds, type TuxedoScrapMotion,
} from "./tuxedoMagnetPhysics";

interface Scrap {
  readonly id: string;
  readonly image: Phaser.GameObjects.Image;
  motion: TuxedoScrapMotion;
  arrow?: Phaser.GameObjects.Text;
}

export class TuxedoMagnetPattern implements BossPattern {
  public readonly warningText = "고철이 떨어진다!";
  private readonly scraps: Scrap[] = [];
  private marker?: Phaser.GameObjects.Ellipse;
  private warnedX?: number;
  private throwPoseMs = 0;
  private destroyed = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly bossSprite: Phaser.GameObjects.Sprite,
    private readonly onMagnetSignal: () => void,
  ) {}

  public telegraph(targetX: number): void {
    if (this.destroyed) return;
    this.clearMarker();
    this.warnedX = clampTuxedoTarget(targetX);
    this.marker = this.scene.add.ellipse(this.warnedX, 499, 42, 8, 0xffca78, 0.75).setDepth(2);
    this.bossSprite.setFrame(1);
  }

  public launch(targetX: number, serial: number): void {
    if (this.destroyed) return;
    const x = this.warnedX ?? clampTuxedoTarget(targetX);
    this.warnedX = undefined;
    this.clearMarker();
    const image = this.scene.add.image(x, 140, "world-04-boss-magnet-scrap")
      .setDisplaySize(40, 40).setDepth(11);
    this.scraps.push({
      id: `tuxedo-scrap-${serial}`, image,
      motion: { x, y: 140, targetX: x, dragToX: chooseTuxedoDrag(x, serial), phase: "falling", phaseMs: 0 },
    });
    if (this.scraps.length > 2) this.remove(this.scraps[0]);
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
    for (const scrap of [...this.scraps]) {
      const previous = scrap.motion;
      const motion = advanceTuxedoScrap(previous, delta);
      scrap.motion = motion;
      scrap.image.setPosition(motion.x, motion.y);
      if (motion.phase === "done") { this.remove(scrap); continue; }
      if (motion.phase === "drag-warning" && previous.phase === "falling") {
        const arrow = motion.dragToX > motion.targetX ? "→" : "←";
        scrap.arrow = this.scene.add.text(motion.x, motion.y - 48, `자석 ${arrow}`, {
          color: "#ffdf84", fontFamily: "Galmuri11Pixel, monospace", fontSize: "21px",
          stroke: "#241d2c", strokeThickness: 4,
        }).setOrigin(0.5).setDepth(12);
        this.onMagnetSignal();
      }
      if (motion.phase === "dragging" && previous.phase === "drag-warning") {
        scrap.arrow?.destroy();
        scrap.arrow = undefined;
      }
      if (motion.phase !== "falling" && motion.phase !== "dragging") continue;
      const bounds = sweptTuxedoScrapBounds(previous, motion);
      hits.push({ id: scrap.id, kind: "weak", sourceX: this.bossSprite.x,
        bounds: new Phaser.Geom.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height) });
    }
    return hits;
  }

  public clear(): void {
    this.clearMarker();
    this.warnedX = undefined;
    for (const scrap of [...this.scraps]) this.remove(scrap);
    this.throwPoseMs = 0;
    if (!this.destroyed) this.bossSprite.setFrame(0);
  }

  public destroy(): void { this.clear(); this.destroyed = true; }

  private remove(scrap: Scrap): void {
    const index = this.scraps.indexOf(scrap);
    if (index >= 0) this.scraps.splice(index, 1);
    scrap.arrow?.destroy();
    scrap.image.destroy();
  }

  private clearMarker(): void {
    this.marker?.destroy();
    this.marker = undefined;
  }
}
