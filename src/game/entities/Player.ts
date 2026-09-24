import * as Phaser from "phaser";
import type { PlayerAnimationState } from "./playerTypes";

export type PlayerControlOverrideKind = "run-left" | "drift-backward" | "launch-up";

export interface PlayerControlOverride {
  readonly kind: PlayerControlOverrideKind;
  readonly sourceId: string;
  readonly expiresAt: number | null;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  public declare readonly body: Phaser.Physics.Arcade.Body;

  private animationState: PlayerAnimationState = "idle";
  private readonly controlLocks = new Set<string>();
  private controlOverride?: PlayerControlOverride;
  private readonly escapePresses = new Map<string, number>();

  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textureKey = "corgi-reference",
  ) {
    super(scene, x, y, textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, 1);
    this.setCrop(32, 32, 430, 940);
    this.setDisplaySize(82, 178);
    this.body.setAllowGravity(true);
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(520, 900);
    this.body.setSize(40, 122);
    this.body.setOffset(21, 46);
  }

  public setAnimationState(state: PlayerAnimationState): void {
    this.animationState = state;
  }

  public getAnimationState(): PlayerAnimationState {
    return this.animationState;
  }

  public lockControl(reason: string): void {
    this.controlLocks.add(reason);
  }

  public unlockControl(reason: string): void {
    this.controlLocks.delete(reason);
  }

  public isControlLocked(): boolean {
    return this.controlLocks.size > 0;
  }

  public startControlOverride(
    kind: PlayerControlOverrideKind,
    durationMs: number,
    sourceId: string,
  ): void {
    this.controlOverride = {
      kind,
      sourceId,
      expiresAt: durationMs > 0 ? this.scene.time.now + durationMs : null,
    };
    this.escapePresses.set(sourceId, 0);
    if (kind === "launch-up") {
      this.setVelocityY(-820);
    }
  }

  public getControlOverride(now = this.scene.time.now): PlayerControlOverride | undefined {
    if (
      this.controlOverride?.expiresAt !== null &&
      this.controlOverride?.expiresAt !== undefined &&
      now >= this.controlOverride.expiresAt
    ) {
      this.clearControlOverride(this.controlOverride.sourceId);
    }
    return this.controlOverride;
  }

  public registerEscapePress(sourceId: string): number {
    const current = this.escapePresses.get(sourceId) ?? 0;
    const next = current + 1;
    this.escapePresses.set(sourceId, next);
    return next;
  }

  public clearControlOverride(sourceId: string): void {
    if (this.controlOverride?.sourceId === sourceId) {
      this.controlOverride = undefined;
      this.escapePresses.delete(sourceId);
    }
  }

  public clearAllControlOverrides(): void {
    this.controlOverride = undefined;
    this.escapePresses.clear();
    this.setGimmickTint(null);
  }

  public setGimmickTint(color: string | number | null): void {
    if (color === null) {
      this.clearTint();
      return;
    }

    const tint = typeof color === "number"
      ? color
      : Number.parseInt(color.replace(/^#/, ""), 16);
    if (!Number.isFinite(tint)) {
      return;
    }
    this.setTint(tint);
  }

  public resetTo(position: Phaser.Math.Vector2): void {
    this.clearAllControlOverrides();
    this.setPosition(position.x, position.y);
    this.setVelocity(0, 0);
    this.setAngularVelocity(0);
    this.setAnimationState("idle");
  }
}
