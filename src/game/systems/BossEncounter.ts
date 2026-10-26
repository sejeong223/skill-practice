import type * as Phaser from "phaser";
import type { GameplayEventBus } from "../core/events";
import type { StageId } from "../core/types";
import type { BossCombatConfig } from "../data/bossCombat";
import { getBossDamage } from "../data/bossCombat";
import type { Player } from "../entities/Player";
import type { SlipperAttackResult } from "./SlipperAttack";
import type { AttackContact } from "./WeaponAttack";
import type { BossPattern, BossHazardHit } from "./BossPattern";
import type { DefenseToolSystem } from "./DefenseToolSystem";
import { beginBossBarkStun, tickBossBarkStun, type BossBarkStunState } from "./bossBarkStun";
import { isCalicoInSlipperReach } from "./calicoMeleeHitbox";
import { WeaponHitTracker } from "./weaponHitbox";

export type BossPhase = "intro" | "ready" | "telegraph" | "active" | "defeated";

export interface BossEncounterState {
  readonly health: number;
  readonly maxHealth: number;
  readonly hearts: 0 | 1 | 2 | 3;
  readonly phase: BossPhase;
  readonly elapsedMs: number;
  readonly nextTelegraphAtMs: number;
  readonly damageLockedUntilMs: number;
  readonly attackSerial: number;
}

export class BossEncounter {
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly name: Phaser.GameObjects.Text;
  private readonly warning: Phaser.GameObjects.Text;
  private readonly weaponHits = new WeaponHitTracker();
  private readonly usedHazards = new Set<string>();
  private state: BossEncounterState;
  private barkStun: BossBarkStunState = { remainingMs: 0, nextAllowedAt: 0 };
  private telegraphUntilMs = 0;
  private playerFlashUntilMs = 0;
  private deathPending = false;
  private destroyed = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly sprite: Phaser.GameObjects.Sprite,
    private readonly stageId: StageId,
    private readonly config: BossCombatConfig,
    private readonly defense: DefenseToolSystem,
    private readonly eventBus: GameplayEventBus,
    private readonly pattern: BossPattern,
    private readonly onHeartsChanged: (hearts: 0 | 1 | 2 | 3) => void,
    private readonly onDefeated: () => void,
  ) {
    if (!pattern || !scene.textures.exists(sprite.texture.key)) {
      throw new Error(`보스 패턴 또는 이미지가 없습니다: ${stageId}`);
    }
    this.state = this.initialState();
    this.bar = scene.add.graphics().setDepth(12);
    const cheeseTabby = stageId === "world-02-stage-boss";
    this.name = scene.add.text(sprite.x, sprite.y - (cheeseTabby ? 90 : 112), "", {
      color: "#fff5d8", fontFamily: "Galmuri11Pixel, monospace", fontSize: "17px",
      stroke: "#423039", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(12);
    this.warning = scene.add.text(sprite.x, sprite.y - (cheeseTabby ? 119 : 143), "공격 예고!", {
      color: "#ffde70", fontFamily: "Galmuri11Pixel, monospace", fontSize: "20px",
      stroke: "#423039", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(12).setVisible(false);
    this.drawHealth();
  }

  public getState(): BossEncounterState { return { ...this.state }; }

  public start(): void {
    if (this.destroyed || this.state.phase !== "intro") return;
    this.state = { ...this.state, phase: "ready" };
    this.onHeartsChanged(this.state.hearts);
  }

  public update(deltaMs: number): void {
    if (this.destroyed || this.state.phase === "intro" || this.state.phase === "defeated" || this.deathPending) return;
    const delta = Number.isFinite(deltaMs) ? Math.max(0, Math.min(deltaMs, 50)) : 0;
    if (this.barkStun.remainingMs > 0) {
      this.barkStun = tickBossBarkStun(this.barkStun, delta);
      return;
    }

    const elapsedMs = this.state.elapsedMs + delta;
    this.state = { ...this.state, elapsedMs };
    this.facePlayer();
    if (this.playerFlashUntilMs > 0 && elapsedMs >= this.playerFlashUntilMs) {
      this.player.clearTint();
      this.playerFlashUntilMs = 0;
    }
    if (this.state.phase === "telegraph" && elapsedMs >= this.telegraphUntilMs) {
      this.pattern.launch(this.player.body.center.x, this.state.attackSerial);
      this.state = { ...this.state, phase: "active" };
      this.warning.setVisible(false);
    }
    if (this.state.phase !== "telegraph" && elapsedMs >= this.state.nextTelegraphAtMs) {
      const serial = this.state.attackSerial + 1;
      this.pattern.telegraph(this.player.body.center.x, serial);
      this.telegraphUntilMs = elapsedMs + this.config.telegraphMs;
      this.state = {
        ...this.state, phase: "telegraph", attackSerial: serial,
        nextTelegraphAtMs: Math.max(this.state.nextTelegraphAtMs + this.config.attackIntervalMs, elapsedMs + 500),
      };
      this.warning.setText(this.pattern.warningText ?? "공격 예고!").setVisible(true);
    }
    for (const hit of this.pattern.update(delta)) this.resolveHazard(hit);
  }

  public acceptSlipperHit(result: SlipperAttackResult, player: Player): boolean {
    if (result.kind !== "slipper-hit" || !result.accepted || !this.canFight()) return false;
    if (!isCalicoInSlipperReach(
      player.body.center.x, player.body.center.y, player.flipX ? -1 : 1,
      this.getHitBounds(),
    )) return false;
    this.damageBoss(1);
    return true;
  }

  public acceptToolHit(contact: AttackContact): boolean {
    if (!this.canFight() || !this.weaponHits.accept(contact, this.getHitBounds())) return false;
    this.damageBoss(getBossDamage(contact.toolId));
    this.eventBus.emit("weapon-hit", {
      attackId: contact.attackId, toolId: contact.toolId,
      remainingHealth: this.state.health, now: contact.now,
    });
    return true;
  }

  public tryBarkStun(nowMs: number): boolean {
    if (!this.canFight()) return false;
    const boss = this.getHitBounds();
    const distance = Math.hypot(
      this.player.body.center.x - boss.centerX,
      this.player.body.center.y - boss.centerY,
    );
    const next = beginBossBarkStun(this.barkStun, nowMs, distance, true);
    if (!next) return false;
    this.barkStun = next;
    this.pattern.clear();
    this.usedHazards.clear();
    this.warning.setVisible(false);
    this.state = {
      ...this.state, phase: "ready",
      nextTelegraphAtMs: Math.max(this.state.nextTelegraphAtMs, this.state.elapsedMs + 700),
    };
    return true;
  }

  public resetAttempt(): void {
    if (this.destroyed) return;
    this.pattern.clear();
    this.usedHazards.clear();
    this.weaponHits.reset();
    this.defense.resetForStage(this.defense.getToolId());
    this.barkStun = { remainingMs: 0, nextAllowedAt: 0 };
    this.telegraphUntilMs = 0;
    this.playerFlashUntilMs = 0;
    this.deathPending = false;
    this.player.clearTint();
    this.sprite.clearTint();
    this.warning.setVisible(false);
    this.state = this.initialState();
    this.drawHealth();
    this.onHeartsChanged(3);
  }

  public isDefeated(): boolean {
    return this.state.phase === "defeated" && this.state.health === 0;
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.pattern.destroy();
    this.usedHazards.clear();
    this.bar.destroy();
    this.name.destroy();
    this.warning.destroy();
  }

  private canFight(): boolean {
    return !this.destroyed && !this.deathPending && this.state.phase !== "intro" && this.state.phase !== "defeated";
  }

  private initialState(): BossEncounterState {
    return {
      health: this.config.maxHealth, maxHealth: this.config.maxHealth, hearts: 3,
      phase: "intro", elapsedMs: 0, nextTelegraphAtMs: 1500,
      damageLockedUntilMs: 0, attackSerial: 0,
    };
  }

  private damageBoss(damage: 1 | 2 | 3): void {
    const health = Math.max(0, this.state.health - damage);
    this.state = { ...this.state, health };
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(140, () => {
      if (!this.destroyed && !this.isDefeated()) this.sprite.clearTint();
    });
    this.drawHealth();
    if (health !== 0) return;
    this.state = { ...this.state, phase: "defeated" };
    this.warning.setVisible(false);
    this.pattern.clear();
    this.onDefeated();
  }

  private resolveHazard(hit: BossHazardHit): void {
    if (this.usedHazards.has(hit.id)) return;
    const body = this.player.body;
    if (hit.bounds.x >= body.right || hit.bounds.right <= body.left ||
        hit.bounds.y >= body.bottom || hit.bounds.bottom <= body.top) return;
    this.usedHazards.add(hit.id);
    if (this.state.elapsedMs < this.state.damageLockedUntilMs) return;
    const result = this.defense.tryBlock({
      id: hit.id, kind: hit.kind, damage: 1, sourceX: hit.sourceX,
      defenderX: body.center.x, facing: this.player.flipX ? -1 : 1,
      projectile: true,
    }, this.scene.time.now);
    if (result.blocked) return;
    const hearts = (this.state.hearts - 1) as 0 | 1 | 2;
    this.state = { ...this.state, hearts, damageLockedUntilMs: this.state.elapsedMs + 900 };
    this.onHeartsChanged(hearts);
    this.player.setTintFill(0xff5d5d);
    this.playerFlashUntilMs = this.state.elapsedMs + 180;
    if (hearts > 0) return;
    this.deathPending = true;
    this.pattern.clear();
    this.warning.setVisible(false);
    this.eventBus.emit("death-requested", {
      stageId: this.stageId, cause: "enemy", checkpointId: null, now: this.scene.time.now,
    });
  }

  private facePlayer(): void {
    if (this.player.x < this.sprite.x) this.sprite.setFlipX(true);
    else if (this.player.x > this.sprite.x) this.sprite.setFlipX(false);
  }

  private getHitBounds(): Pick<Phaser.Geom.Rectangle, "x" | "y" | "width" | "height" | "centerX" | "centerY"> {
    if (this.stageId !== "world-02-stage-boss") return this.sprite.getBounds();
    // The 96px cat is visible from about y=18 to y=80 in each standing frame.
    return {
      x: this.sprite.x - 44,
      y: this.sprite.y - 30,
      width: 88,
      height: 62,
      centerX: this.sprite.x,
      centerY: this.sprite.y + 1,
    };
  }

  private drawHealth(): void {
    this.bar.clear();
    const width = Math.min(16, 240 / this.config.maxHealth);
    const left = this.sprite.x - width * this.config.maxHealth / 2;
    for (let index = 0; index < this.config.maxHealth; index++) {
      this.bar.fillStyle(index < this.state.health ? 0xf0b95f : 0x4a3b42, 1);
      this.bar.fillRect(left + index * width, this.sprite.y - (this.stageId === "world-02-stage-boss" ? 68 : 89), width - 2, 12);
    }
    this.name.setText(`${this.config.bossName}  ${this.state.health} / ${this.config.maxHealth}`);
  }
}
