import { InputManager } from "../input/InputManager";
import { Player } from "../entities/Player";
import type { PlayerTuning } from "../entities/playerTypes";

export class PlayerController {
  private readonly player: Player;
  private readonly input: InputManager;
  private readonly tuning: PlayerTuning;
  private controlEnabled = true;
  private coyoteRemainingMs = 0;
  private jumpBufferRemainingMs = 0;

  public constructor(
    player: Player,
    input: InputManager,
    tuning: PlayerTuning,
  ) {
    this.player = player;
    this.input = input;
    this.tuning = tuning;
    this.player.body.setGravityY(Math.max(0, tuning.gravityY - 900));
  }

  public update(_time: number, delta: number): void {
    const snapshot = this.input.getSnapshot();
    const grounded = this.isGrounded();
    const controlOverride = this.player.getControlOverride();

    if (grounded) {
      this.coyoteRemainingMs = this.tuning.coyoteTimeMs;
    } else {
      this.coyoteRemainingMs = Math.max(
        0,
        this.coyoteRemainingMs - delta,
      );
    }

    if (snapshot.jumpPressed) {
      this.jumpBufferRemainingMs = this.tuning.jumpBufferMs;
    } else {
      this.jumpBufferRemainingMs = Math.max(
        0,
        this.jumpBufferRemainingMs - delta,
      );
    }

    if (controlOverride) {
      if (controlOverride.kind === "run-left" || controlOverride.kind === "drift-backward") {
        this.player.setVelocityX(-this.tuning.runSpeed);
        this.player.setFlipX(true);
      }
      this.jumpBufferRemainingMs = 0;
      this.updateAirState(grounded);
      return;
    }

    if (!this.controlEnabled || this.player.isControlLocked()) {
      this.moveToward(0, this.tuning.deceleration, delta);
      this.updateAirState(grounded);
      return;
    }

    const direction = Number(snapshot.right) - Number(snapshot.left);
    const targetVelocity = direction * this.tuning.runSpeed;
    const changeRate =
      direction === 0 ? this.tuning.deceleration : this.tuning.acceleration;

    this.moveToward(targetVelocity, changeRate, delta);

    if (direction < 0) {
      this.player.setFlipX(true);
    } else if (direction > 0) {
      this.player.setFlipX(false);
    }

    if (this.jumpBufferRemainingMs > 0 && this.coyoteRemainingMs > 0) {
      this.player.setVelocityY(this.tuning.jumpVelocity);
      this.jumpBufferRemainingMs = 0;
      this.coyoteRemainingMs = 0;
    }

    this.updateAirState(this.isGrounded());
  }

  public setControlEnabled(enabled: boolean): void {
    this.controlEnabled = enabled;
  }

  private moveToward(target: number, rate: number, delta: number): void {
    const current = this.player.body.velocity.x;
    const step = rate * (delta / 1000);
    const clamped =
      Math.abs(target - current) <= step
        ? target
        : current + Math.sign(target - current) * step;

    this.player.setVelocityX(clamped);
  }

  private updateAirState(grounded: boolean): void {
    const velocityY = this.player.body.velocity.y;

    if (!grounded) {
      this.player.setAnimationState(velocityY < 0 ? "jump" : "fall");
    } else if (Math.abs(this.player.body.velocity.x) > 12) {
      this.player.setAnimationState("run");
    } else {
      this.player.setAnimationState("idle");
    }
  }

  private isGrounded(): boolean {
    return this.player.body.blocked.down || this.player.body.touching.down;
  }
}
