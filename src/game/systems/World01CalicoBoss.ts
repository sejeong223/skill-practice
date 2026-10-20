import * as Phaser from "phaser";
import { Player } from "../entities/Player";
import type { GameplayEventBus } from "../core/events";
import type { SlipperAttackResult } from "./SlipperAttack";
import type { AttackContact } from "./WeaponAttack";
import { WeaponHitTracker } from "./weaponHitbox";
import { DefenseToolSystem } from "./DefenseToolSystem";
import { StrayDogEvent } from "./StrayDogEvent";
import { isCalicoInSlipperReach } from "./calicoMeleeHitbox";
import { beginBossBarkStun, tickBossBarkStun, type BossBarkStunState } from "./bossBarkStun";
import { createSamoyedSurge, sampleSamoyedDog, SAMOYED_RELEASE_MS, SAMOYED_DONE_MS, SAMOYED_SIZE, type SamoyedSurge, type SamoyedPath } from "./samoyedSurge";
import {
  createFishboneTrajectory,
  fishbonePositionAt,
  type FishboneTrajectory,
} from "./fishboneTrajectory";

export interface CalicoBossState {
  health: number;
  phase: "intro" | "ready" | "telegraph" | "projectile" | "defeated";
  nextThrowAt: number;
  projectileId: string | null;
  corgiHearts: 0 | 1 | 2 | 3;
  damageLockedUntil: number;
}

interface Fishbone {
  readonly id: string;
  readonly image: Phaser.GameObjects.Image;
  readonly trajectory: FishboneTrajectory;
  elapsedSeconds: number;
}

export const CALICO_MAX_HEALTH = 10;
const FISHBONE_DISPLAY = { width: 72, height: 36 } as const;
const FISHBONE_HITBOX = { width: 54, height: 24 } as const;

export class World01CalicoBoss {
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly name: Phaser.GameObjects.Text;
  private readonly warning: Phaser.GameObjects.Text;
  private readonly stunNotice: Phaser.GameObjects.Text;
  private readonly dogSprites: Array<{ image: Phaser.GameObjects.Image; path: SamoyedPath }> = [];
  private surge?: SamoyedSurge;
  private readonly unsubscribeDogs: () => void;
  private state: CalicoBossState = {
    health: CALICO_MAX_HEALTH, phase: "intro", nextThrowAt: 1500,
    projectileId: null, corgiHearts: 3, damageLockedUntil: 0,
  };
  private elapsed = 0;
  private telegraphUntil = 0;
  private dogUntil = 0;
  private serial = 0;
  private fishbone?: Fishbone;
  private flashUntil = 0;
  private playerFlashUntil = 0;
  private barkStun: BossBarkStunState = { remainingMs: 0, nextAllowedAt: 0 };
  private readonly weaponHits = new WeaponHitTracker();

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly sprite: Phaser.GameObjects.Sprite,
    private readonly defense: DefenseToolSystem,
    private readonly dogs: StrayDogEvent,
    private readonly eventBus: GameplayEventBus,
    private readonly onHeartsChanged: (remaining: 0 | 1 | 2 | 3) => void,
    private readonly onDefeated: () => void,
    private readonly onThirdHit: (now: number) => void,
  ) {
    this.bar = scene.add.graphics().setDepth(12);
    this.name = scene.add.text(sprite.x, sprite.y - 112, "", {
      color: "#fff5d8", fontFamily: "Galmuri11Pixel, monospace", fontSize: "17px",
      stroke: "#423039", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(12);
    this.warning = scene.add.text(sprite.x, sprite.y - 142, "생선 가시 투척!", {
      color: "#ffde70", fontFamily: "Galmuri11Pixel, monospace", fontSize: "20px",
      stroke: "#423039", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(12).setVisible(false);
    this.stunNotice = scene.add.text(sprite.x, sprite.y - 176, "당황!", {
      color: "#a8e9ff", fontFamily: "Galmuri11Pixel, monospace", fontSize: "24px",
      stroke: "#423039", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(12).setVisible(false);
    this.unsubscribeDogs = eventBus.on("stray-dog-surge", () => this.spawnDogSurround());
    this.facePlayer();
    this.drawHealth();
  }

  public start(now: number): void {
    void now;
    if (this.state.phase !== "intro") return;
    this.state = { ...this.state, phase: "ready", nextThrowAt: this.elapsed + 1500 };
    this.onHeartsChanged(this.state.corgiHearts);
  }

  public update(now: number, delta: number): void {
    if (this.state.phase === "intro" || this.state.phase === "defeated") return;
    if (this.barkStun.remainingMs > 0) {
      this.barkStun = tickBossBarkStun(this.barkStun, Math.min(delta, 50));
      if (this.barkStun.remainingMs === 0) this.stunNotice.setVisible(false);
      return;
    }
    this.facePlayer();
    this.elapsed += Math.min(delta, 50);
    if (this.flashUntil && this.elapsed >= this.flashUntil) {
      this.sprite.clearTint();
      this.flashUntil = 0;
    }
    if (this.playerFlashUntil && this.elapsed >= this.playerFlashUntil) {
      this.player.clearTint();
      this.playerFlashUntil = 0;
    }
    this.updateDogs();

    if (this.state.phase === "ready" && this.elapsed >= this.state.nextThrowAt) {
      this.state = { ...this.state, phase: "telegraph" };
      this.telegraphUntil = this.elapsed + 700;
      const throwHeight = ["낮게", "중간 높이로", "높게"][this.serial % 3];
      this.warning.setText(`생선 가시 ${throwHeight} 투척!`).setVisible(true);
      this.sprite.setFrame(1);
    }
    if (this.state.phase === "telegraph" && this.elapsed >= this.telegraphUntil) {
      this.releaseFishbone();
    }
    if (this.fishbone) this.updateFishbone(now, delta);
  }

  public tryBarkStun(now: number): boolean {
    const bossBounds = this.sprite.getBounds();
    const distance = Math.hypot(
      this.player.body.center.x - bossBounds.centerX,
      this.player.body.center.y - bossBounds.centerY,
    );
    const nextStun = beginBossBarkStun(
      this.barkStun,
      now,
      distance,
      this.state.phase !== "intro" && this.state.phase !== "defeated",
    );
    if (!nextStun) return false;

    this.barkStun = nextStun;
    this.clearFishbone();
    this.clearDogs();
    this.telegraphUntil = 0;
    this.warning.setVisible(false);
    this.state = {
      ...this.state,
      phase: "ready",
      projectileId: null,
      nextThrowAt: this.elapsed + 700,
    };
    this.sprite.setFrame(0);
    this.stunNotice.setVisible(true);
    return true;
  }

  public acceptMeleeHit(result: SlipperAttackResult, player: Player): boolean {
    if (result.kind !== "slipper-hit" || !result.accepted || this.state.phase === "intro" || this.state.phase === "defeated") return false;
    if (!isCalicoInSlipperReach(
      player.body.center.x,
      player.body.center.y,
      player.flipX ? -1 : 1,
      this.sprite.getBounds(),
    )) return false;
    return this.applyDamage();
  }

  public acceptToolHit(contact: AttackContact): boolean {
    if (this.state.phase === "intro" || this.state.phase === "defeated") return false;
    const boss = this.sprite.getBounds();
    if (!this.weaponHits.accept(contact, boss)) return false;
    this.applyDamage();
    this.eventBus.emit("weapon-hit", {
      attackId: contact.attackId, toolId: contact.toolId, remainingHealth: this.state.health, now: contact.now,
    });
    return true;
  }

  private applyDamage(): boolean {
    this.facePlayer();
    const health = this.state.health - 1;
    this.state = { ...this.state, health };
    this.sprite.setTintFill(0xffffff);
    this.flashUntil = this.elapsed + 140;
    this.drawHealth();
    if (health === 0) {
      this.state = { ...this.state, phase: "defeated" };
      this.stopAttacks();
      this.onDefeated();
    }
    return true;
  }

  public resetAttempt(now: number): void {
    void now;
    this.clearFishbone();
    this.clearDogs();
    this.elapsed = 0;
    this.flashUntil = 0;
    this.playerFlashUntil = 0;
    this.barkStun = { remainingMs: 0, nextAllowedAt: 0 };
    this.weaponHits.reset();
    this.player.clearTint();
    this.state = {
      health: CALICO_MAX_HEALTH, phase: "intro", nextThrowAt: 1500,
      projectileId: null, corgiHearts: 3, damageLockedUntil: 0,
    };
    this.defense.resetForStage(this.defense.getToolId());
    this.sprite.setFrame(0).clearTint();
    this.facePlayer();
    this.warning.setVisible(false);
    this.stunNotice.setVisible(false);
    this.drawHealth();
    this.onHeartsChanged(3);
  }

  public isDefeated(): boolean {
    return this.state.phase === "defeated" && this.state.health === 0;
  }

  public stopAttacks(): void {
    this.state = { ...this.state, phase: "defeated" };
    this.barkStun = { remainingMs: 0, nextAllowedAt: 0 };
    this.clearFishbone();
    this.clearDogs();
    this.warning.setVisible(false);
    this.stunNotice.setVisible(false);
    this.sprite.setFrame(this.isDefeated() ? 2 : 0).clearTint();
  }

  public showCollapseFrame(): void {
    if (this.isDefeated()) this.sprite.setFrame(2).clearTint();
  }

  public destroy(): void {
    this.unsubscribeDogs();
    this.clearFishbone();
    this.clearDogs();
    this.bar.destroy();
    this.name.destroy();
    this.warning.destroy();
    this.stunNotice.destroy();
  }

  private facePlayer(): void {
    if (this.isDefeated()) return;
    if (this.player.x < this.sprite.x) this.sprite.setFlipX(true);
    else if (this.player.x > this.sprite.x) this.sprite.setFlipX(false);
  }

  private releaseFishbone(): void {
    this.facePlayer();
    this.warning.setVisible(false);
    this.sprite.setFrame(0);
    const direction = this.player.x < this.sprite.x ? -1 : 1;
    const id = `fishbone-${++this.serial}`;
    const startX = this.sprite.x + direction * 56;
    const targetX = direction < 0
      ? Math.min(this.player.x, startX - 40)
      : Math.max(this.player.x, startX + 40);
    const trajectory = createFishboneTrajectory(
      startX, targetX, this.player.body.center.y, this.serial,
    );
    const image = this.scene.add.image(startX, trajectory.startY, "world-01-fishbone")
      .setDisplaySize(FISHBONE_DISPLAY.width, FISHBONE_DISPLAY.height).setDepth(11).setFlipX(direction > 0);
    this.fishbone = { id, image, trajectory, elapsedSeconds: 0 };
    this.state = {
      ...this.state, phase: "projectile", projectileId: id,
      nextThrowAt: this.elapsed + 2600,
    };
  }

  private updateFishbone(now: number, delta: number): void {
    const bone = this.fishbone;
    if (!bone) return;
    const previous = fishbonePositionAt(bone.trajectory, bone.elapsedSeconds);
    bone.elapsedSeconds += Math.min(delta, 50) / 1000;
    const current = fishbonePositionAt(bone.trajectory, bone.elapsedSeconds);
    bone.image.setPosition(current.x, current.y);
    const bounds = this.scene.physics.world.bounds;
    if (current.x + FISHBONE_DISPLAY.width / 2 < bounds.left ||
      current.x - FISHBONE_DISPLAY.width / 2 > bounds.right ||
      current.y + FISHBONE_DISPLAY.height / 2 < bounds.top - 40 || current.y > 560) {
      this.clearFishbone();
      return;
    }
    const hitbox = new Phaser.Geom.Rectangle(
      Math.min(previous.x, current.x) - FISHBONE_HITBOX.width / 2,
      Math.min(previous.y, current.y) - FISHBONE_HITBOX.height / 2,
      Math.abs(current.x - previous.x) + FISHBONE_HITBOX.width,
      Math.abs(current.y - previous.y) + FISHBONE_HITBOX.height,
    );
    const body = new Phaser.Geom.Rectangle(this.player.body.x, this.player.body.y, this.player.body.width, this.player.body.height);
    if (!Phaser.Geom.Rectangle.Overlaps(hitbox, body)) return;
    this.clearFishbone();
    if (this.elapsed < this.state.damageLockedUntil) return;
    const block = this.defense.tryBlock({ id: bone.id, kind: "weak", damage: 1 }, now);
    if (block.blocked) return;
    const remaining = (this.state.corgiHearts - 1) as 0 | 1 | 2;
    this.state = {
      ...this.state, corgiHearts: remaining,
      damageLockedUntil: this.elapsed + 900,
    };
    this.onHeartsChanged(remaining);
    this.player.setTintFill(0xff5d5d);
    this.playerFlashUntil = this.elapsed + 180;
    if (remaining === 0) {
      this.state = { ...this.state, phase: "defeated" };
      this.clearDogs();
      this.onThirdHit(now);
    }
  }

  private clearFishbone(): void {
    this.fishbone?.image.destroy();
    this.fishbone = undefined;
    this.state = {
      ...this.state,
      projectileId: null,
      phase: this.state.phase === "projectile" ? "ready" : this.state.phase,
    };
  }

  private spawnDogSurround(): void {
    if (this.surge || this.state.phase === "defeated" || this.barkStun.remainingMs > 0) return;
    this.player.lockControl("bowl-stray-dog-blockade");
    this.player.setVelocityX(0);
    this.dogUntil = this.elapsed + SAMOYED_RELEASE_MS;
    this.state = {
      ...this.state,
      nextThrowAt: Math.min(this.state.nextThrowAt, this.elapsed + 350),
    };
    this.surge = createSamoyedSurge(
      { x: this.player.x, floorY: 512 }, this.scene.cameras.main.worldView,
      this.elapsed, this.dogs.getActiveDogs().length,
    );
    this.surge.dogs.forEach((path) => {
      const image = this.scene.add.image(path.fromX, path.floorY, "world-01-stray-dog")
        .setOrigin(0.5, 1).setDisplaySize(SAMOYED_SIZE.width, SAMOYED_SIZE.height).setDepth(this.player.depth + 4);
      this.dogSprites.push({ image, path });
    });
  }

  private updateDogs(): void {
    if (!this.surge) return;
    const elapsed = this.elapsed - this.surge.startedAtMs;
    if (this.dogUntil && this.elapsed >= this.dogUntil) {
      this.player.unlockControl("bowl-stray-dog-blockade");
      this.dogUntil = 0;
    }
    if (elapsed >= SAMOYED_DONE_MS) {
      this.clearDogs();
      return;
    }
    for (const { image, path } of this.dogSprites) {
      const position = sampleSamoyedDog(path, elapsed);
      image.setPosition(position.x, position.y);
    }
  }

  private clearDogs(): void {
    this.dogUntil = 0;
    this.surge = undefined;
    this.player.unlockControl("bowl-stray-dog-blockade");
    this.dogSprites.splice(0).forEach(({ image }) => image.destroy());
    this.dogs.clear();
  }

  private drawHealth(): void {
    this.bar.clear();
    const left = this.sprite.x - CALICO_MAX_HEALTH * 20 / 2;
    const top = this.sprite.y - 88;
    for (let index = 0; index < CALICO_MAX_HEALTH; index += 1) {
      this.bar.fillStyle(index < this.state.health ? 0xf0b95f : 0x4a3b42, 1);
      this.bar.fillRect(left + index * 20, top, 17, 14);
      this.bar.lineStyle(2, 0x2d2630, 1);
      this.bar.strokeRect(left + index * 20, top, 17, 14);
    }
    this.name.setText(`삼색이  ${this.state.health} / ${CALICO_MAX_HEALTH}`);
  }
}
