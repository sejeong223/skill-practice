import * as Phaser from "phaser";
import type { PlayerAnimationState } from "./playerTypes";

export class Player extends Phaser.Physics.Arcade.Sprite {
  public declare readonly body: Phaser.Physics.Arcade.Body;

  private animationState: PlayerAnimationState = "idle";
  private readonly controlLocks = new Set<string>();

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

  public resetTo(position: Phaser.Math.Vector2): void {
    this.setPosition(position.x, position.y);
    this.setVelocity(0, 0);
    this.setAngularVelocity(0);
    this.setAnimationState("idle");
  }
}
