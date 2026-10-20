import type * as Phaser from "phaser";
import type { ToolId } from "../core/types";
import type { Player } from "./Player";

const WEAPONS = new Set(["squeaky-ball", "rolled-newspaper", "pink-backscratcher", "drumstick-boomerang", "plastic-frisbee"]);
const SHIELDS = new Set(["cushion-pad", "greasy-pizza-box", "umbrella", "yellow-pot-lid"]);
const ATTACK_MS = 240;

export class EquipmentVisual {
  private weapon?: Phaser.GameObjects.Image;
  private shield?: Phaser.GameObjects.Image;
  private attackId: ToolId = "rabbit-slipper";
  private defenseId: ToolId = "upside-down-bowl";
  private attackStartedAt = -Infinity;
  private attackKind: "melee" | "projectile" = "melee";
  private enabled = true;
  private destroyed = false;

  public constructor(private readonly scene: Phaser.Scene, private readonly player: Player) {
    scene.events.on("postupdate", this.sync, this);
  }

  public setTools(attackToolId: ToolId, defenseToolId: ToolId): void {
    if (this.destroyed) return;
    const safeAttack = WEAPONS.has(attackToolId) ? attackToolId : "rabbit-slipper";
    const safeDefense = SHIELDS.has(defenseToolId) ? defenseToolId : "upside-down-bowl";
    if (safeAttack !== this.attackId) {
      this.weapon?.destroy();
      this.attackId = safeAttack;
      this.weapon = this.createImage(safeAttack, 1);
    }
    if (safeDefense !== this.defenseId) {
      this.shield?.destroy();
      this.defenseId = safeDefense;
      this.shield = this.createImage(safeDefense, 3);
    }
    this.sync();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.sync();
  }

  public showAttack(now: number, kind: "melee" | "projectile"): void {
    if (!this.weapon || !this.enabled) return;
    this.attackStartedAt = now;
    this.attackKind = kind;
    this.sync();
  }

  public sync(): void {
    if (this.destroyed || !this.player.scene) return;
    const facing = this.player.flipX ? -1 : 1;
    const visible = this.enabled && this.player.active && this.player.visible;
    const elapsed = this.scene.time.now - this.attackStartedAt;
    const swinging = elapsed >= 0 && elapsed < ATTACK_MS;
    if (this.weapon) {
      const reach = swinging ? 34 + elapsed / ATTACK_MS * (this.attackKind === "projectile" ? 32 : 18) : 31;
      this.weapon.setPosition(this.player.x + facing * reach, this.player.y - (swinging ? 25 + Math.sin(elapsed / ATTACK_MS * Math.PI) * 21 : 25))
        .setAngle(swinging ? facing * (-35 + elapsed / ATTACK_MS * 95) : facing * -18)
        .setFlipX(this.player.flipX)
        .setDisplaySize(40, 40)
        .setDepth(this.player.depth + 1)
        .setVisible(visible);
    }
    this.shield?.setPosition(this.player.x + facing * 53, this.player.y - 60)
      .setFlipX(this.player.flipX)
      .setAngle(0)
      .setDisplaySize(48, 48)
      .setDepth(this.player.depth + 3)
      .setVisible(visible);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off("postupdate", this.sync, this);
    this.weapon?.destroy();
    this.shield?.destroy();
    this.weapon = undefined;
    this.shield = undefined;
  }

  private createImage(id: ToolId, depthOffset: number): Phaser.GameObjects.Image | undefined {
    const key = `held-${id}`;
    if (!this.scene.textures.exists(key)) return undefined;
    return this.scene.add.image(this.player.x, this.player.y, key).setDepth(this.player.depth + depthOffset);
  }
}
