import * as Phaser from "phaser";
import type { PlayerAnimationState } from "./playerTypes";

const PLAYER_FRAME_HEIGHT = 128;
const DEFAULT_PLAYER_BODY_WIDTH = 72;
const PLAYER_BODY_HEIGHT = 40;

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
  private readonly bodyOffsetX: number;
  private footAnchorY = 99;

  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textureKey = "corgi-run",
    bodyWidth = DEFAULT_PLAYER_BODY_WIDTH,
  ) {
    super(scene, x, y, textureKey);
    this.bodyOffsetX = (this.width - bodyWidth) / 2;
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(0.5, this.footAnchorY / PLAYER_FRAME_HEIGHT);
    this.setScale(1);
    this.setAngle(0);
    this.body.setAllowGravity(true);
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(520, 900);
    this.body.setSize(bodyWidth, PLAYER_BODY_HEIGHT, false);
    this.body.setOffset(
      this.bodyOffsetX,
      this.footAnchorY - PLAYER_BODY_HEIGHT,
    );
  }

  public setAnimationState(state: PlayerAnimationState): void {
    this.animationState = state;
  }

  public getAnimationState(): PlayerAnimationState {
    return this.animationState;
  }

  // Keep the sprite's visible paws and the unchanged bottom of its body in line.
  public alignFeetToFrame(footAnchorY: number): void {
    if (this.footAnchorY === footAnchorY) {
      return;
    }

    this.footAnchorY = footAnchorY;
    this.setOrigin(0.5, footAnchorY / PLAYER_FRAME_HEIGHT);
    this.body.setOffset(
      this.bodyOffsetX,
      footAnchorY - PLAYER_BODY_HEIGHT,
    );
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
    this.body.reset(position.x, position.y);
    // Arcade reset starts at the sprite's top-left; our small body has a foot offset.
    // Sync both coordinates and history so this frame cannot collide at the old spot
    // or apply the teleport a second time during the physics post-update.
    this.body.updateFromGameObject();
    this.body.prev.copy(this.body.position);
    this.body.prevFrame.copy(this.body.position);
    this.setAngularVelocity(0);
    this.setAnimationState("idle");
  }
}
