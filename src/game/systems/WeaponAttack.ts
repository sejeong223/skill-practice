import type * as Phaser from "phaser";
import type { GameplayEventBus } from "../core/events";
import type { ToolId } from "../core/types";
import type { Player } from "../entities/Player";

export interface AttackBounds { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export interface AttackContact {
  readonly attackId: string;
  readonly toolId: ToolId;
  readonly kind: "melee" | "projectile";
  readonly bounds: AttackBounds;
  readonly facing: -1 | 1;
  readonly now: number;
}
export interface WeaponFireResult {
  readonly accepted: boolean;
  readonly kind: "melee" | "projectile";
  readonly contacts: readonly AttackContact[];
}

interface Projectile {
  readonly id: string;
  readonly toolId: ToolId;
  readonly image: Phaser.GameObjects.Image;
  readonly facing: -1 | 1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
  bounced: boolean;
  returning: boolean;
  hit: boolean;
}

const PROJECTILES = new Set(["squeaky-ball", "drumstick-boomerang", "plastic-frisbee"]);
const MELEE = new Set(["rolled-newspaper", "pink-backscratcher", "cardboard-tube"]);

export class WeaponAttack {
  private readonly projectiles: Projectile[] = [];
  private readonly shadows: Phaser.GameObjects.Ellipse[] = [];
  private toolId: ToolId = "rabbit-slipper";
  private nextReadyAt = 0;
  private elapsedMs = 0;
  private serial = 0;
  private ballThrows = 0;
  private shadowUntil = 0;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly eventBus: GameplayEventBus,
  ) {}

  public setTool(toolId: ToolId): void {
    if (this.toolId === toolId) return;
    this.reset();
    this.toolId = toolId;
  }

  public tryAttack(now: number): WeaponFireResult {
    const toolId = this.toolId;
    const kind = PROJECTILES.has(toolId) ? "projectile" : "melee";
    const inFlight = this.projectiles.some((projectile) => projectile.toolId === toolId && toolId !== "squeaky-ball");
    if (inFlight && toolId === "drumstick-boomerang") {
      this.triggerDrawback(toolId, "boomerang-return-lock", now);
    }
    if ((!PROJECTILES.has(toolId) && !MELEE.has(toolId)) || this.elapsedMs < this.nextReadyAt || inFlight) {
      return { accepted: false, kind, contacts: [] };
    }
    const facing: -1 | 1 = this.player.flipX ? -1 : 1;
    const id = `${toolId}-${++this.serial}`;
    const contacts: AttackContact[] = [];
    if (kind === "melee") {
      const reach = toolId === "rolled-newspaper" || toolId === "cardboard-tube" ? 136 : 112;
      const top = toolId === "pink-backscratcher" ? -125 : -72;
      const left = facing === 1 ? this.player.body.center.x + 16 : this.player.body.center.x - reach;
      contacts.push({ attackId: id, toolId, kind, facing, now, bounds: {
        x: left, y: this.player.body.center.y + top, width: reach - 16, height: -top + 10,
      } });
      this.nextReadyAt = this.elapsedMs + (toolId === "rolled-newspaper" ? 450 : 320);
      if (toolId === "rolled-newspaper") this.triggerDrawback(toolId, "newspaper-slow-recovery", now);
      if (toolId === "cardboard-tube") this.triggerDrawback(toolId, "tube-blind-spot", now);
    } else {
      const x = this.player.body.center.x + facing * 50;
      const y = this.player.body.center.y - 23;
      const speed = toolId === "plastic-frisbee" ? 780 : toolId === "drumstick-boomerang" ? 560 : 430;
      const image = this.scene.add.image(x, y, `held-${toolId}`)
        .setDisplaySize(toolId === "plastic-frisbee" ? 44 : 38, toolId === "plastic-frisbee" ? 44 : 38)
        .setDepth(this.player.depth + 4).setFlipX(facing < 0);
      this.projectiles.push({ id, toolId, image, facing, x, y, vx: speed * facing,
        vy: toolId === "squeaky-ball" ? -115 : 0, ageMs: 0, bounced: false, returning: false, hit: false });
      this.nextReadyAt = this.elapsedMs + (toolId === "squeaky-ball" ? 330 : 260);
      if (toolId === "squeaky-ball" && ++this.ballThrows % 3 === 0) this.showCatShadows(now);
    }
    this.eventBus.emit("weapon-fired", { attackId: id, toolId, kind, now });
    return { accepted: true, kind, contacts };
  }

  public update(now: number, deltaMs: number): readonly AttackContact[] {
    const delta = Math.min(50, Math.max(0, deltaMs));
    this.elapsedMs += delta;
    if (this.shadowUntil && this.elapsedMs >= this.shadowUntil) this.clearShadows();
    const contacts: AttackContact[] = [];
    for (const projectile of [...this.projectiles]) {
      const previousX = projectile.x;
      const previousY = projectile.y;
      projectile.ageMs += delta;
      if (projectile.toolId === "drumstick-boomerang" && projectile.ageMs >= 530 && !projectile.returning) {
        projectile.returning = true;
        projectile.vx = -projectile.facing * 560;
      }
      projectile.x += projectile.vx * delta / 1000;
      projectile.y += projectile.vy * delta / 1000;
      if (projectile.toolId === "squeaky-ball") {
        projectile.vy += 320 * delta / 1000;
        const floor = this.player.y - 17;
        if (!projectile.bounced && projectile.y >= floor) {
          projectile.y = floor;
          projectile.vy = -220;
          projectile.bounced = true;
        }
      }
      projectile.image.setPosition(projectile.x, projectile.y)
        .setAngle(projectile.ageMs * (projectile.facing < 0 ? -0.4 : 0.4));
      if (!projectile.hit) contacts.push({
        attackId: projectile.id, toolId: projectile.toolId, kind: "projectile", facing: projectile.facing, now,
        bounds: { x: Math.min(previousX, projectile.x) - 18, y: Math.min(previousY, projectile.y) - 18,
          width: Math.abs(projectile.x - previousX) + 36, height: Math.abs(projectile.y - previousY) + 36 },
      });
      const world = this.scene.physics.world.bounds;
      const outside = projectile.x < world.left - 50 || projectile.x > world.right + 50 ||
        projectile.y < world.top - 70 || projectile.y > world.bottom + 70;
      const returned = projectile.returning && Math.abs(projectile.x - this.player.body.center.x) < 36;
      if (outside || returned || projectile.ageMs >= 1900) {
        if (projectile.toolId === "plastic-frisbee" && !projectile.hit) {
          this.nextReadyAt = Math.max(this.nextReadyAt, this.elapsedMs + 900);
          this.triggerDrawback(projectile.toolId, "frisbee-miss-cooldown", now);
        }
        if (projectile.toolId === "drumstick-boomerang" && !projectile.hit) {
          this.triggerDrawback(projectile.toolId, "boomerang-return-lock", now);
        }
        this.removeProjectile(projectile);
      }
    }
    return contacts;
  }

  public registerHit(contact: AttackContact): void {
    if (contact.toolId === "pink-backscratcher") {
      this.player.x -= contact.facing * 18;
      this.triggerDrawback(contact.toolId, "backscratcher-recoil", contact.now);
    }
    const projectile = this.projectiles.find((item) => item.id === contact.attackId);
    if (!projectile) return;
    projectile.hit = true;
    if (projectile.toolId !== "drumstick-boomerang") this.removeProjectile(projectile);
  }

  public reset(): void {
    this.projectiles.splice(0).forEach((projectile) => projectile.image.destroy());
    this.clearShadows();
    this.elapsedMs = 0;
    this.nextReadyAt = 0;
    this.ballThrows = 0;
  }

  public destroy(): void { this.reset(); }

  private removeProjectile(projectile: Projectile): void {
    const index = this.projectiles.indexOf(projectile);
    if (index >= 0) this.projectiles.splice(index, 1);
    projectile.image.destroy();
  }

  private showCatShadows(now: number): void {
    this.clearShadows();
    this.shadowUntil = this.elapsedMs + 450;
    this.player.lockControl("squeaky-cat-shadows");
    for (const offset of [-46, 46]) {
      this.shadows.push(this.scene.add.ellipse(this.player.x + offset, this.player.y - 10, 44, 18, 0x2d2630, 0.32)
        .setDepth(this.player.depth + 4));
    }
    this.triggerDrawback("squeaky-ball", "squeak-summons-cats", now);
  }

  private clearShadows(): void {
    this.shadowUntil = 0;
    this.player.unlockControl("squeaky-cat-shadows");
    this.shadows.splice(0).forEach((shadow) => shadow.destroy());
  }

  private triggerDrawback(toolId: string, drawbackId: string, now: number): void {
    this.eventBus.emit("drawback-triggered", { toolId, drawbackId, now });
  }
}
