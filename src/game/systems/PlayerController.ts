import type { InputManager } from "../input/InputManager";
import type { Player } from "../entities/Player";
import type { PlayerJumpStartEvent } from "../entities/Player";
import type { PlayerSurfaceModifier, PlayerTuning } from "../entities/playerTypes";

export class PlayerController {
  private readonly player: Player;
  private readonly input: InputManager;
  private readonly tuning: PlayerTuning;
  private controlEnabled = true;
  private coyoteRemainingMs = 0;
  private jumpBufferRemainingMs = 0;
  private cementSlowRemainingMs = 0;
  private dashRemainingMs = 0;
  private dashDirection: -1 | 1 = 1;
  private dashSpeed = 480;
  private surfaceModifier: PlayerSurfaceModifier | null = null;

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
    this.cementSlowRemainingMs = Math.max(0, this.cementSlowRemainingMs - Math.max(0, delta));
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
      this.cancelDash();
      if (controlOverride.kind === "run-left" || controlOverride.kind === "drift-backward") {
        this.player.setVelocityX(-this.currentRunSpeed());
        this.player.setFlipX(true);
      }
      this.jumpBufferRemainingMs = 0;
      this.updateAirState(grounded);
      return;
    }

    if (!this.controlEnabled || this.player.isControlLocked()) {
      this.cancelDash();
      this.moveToward(0, this.tuning.deceleration, delta);
      this.updateAirState(grounded);
      return;
    }

    if (this.dashRemainingMs > 0) {
      this.dashRemainingMs = Math.max(0, this.dashRemainingMs - Math.max(0, delta));
    }
    if (this.dashRemainingMs > 0) {
      this.player.setVelocityX(this.dashDirection * this.dashSpeed);
    } else {
      const direction = Number(snapshot.right) - Number(snapshot.left);
      const surface = grounded ? this.surfaceModifier : null;
      const targetVelocity = direction * this.currentRunSpeed() + (surface?.conveyorVelocityX ?? 0);
      const changeRate = direction === 0 ? (surface?.deceleration ?? this.tuning.deceleration) : (surface?.acceleration ?? this.tuning.acceleration);
      this.moveToward(targetVelocity, changeRate, delta);
      if (direction < 0) this.player.setFlipX(true);
      else if (direction > 0) this.player.setFlipX(false);
    }

    let jumpedThisUpdate = false;
    if (this.jumpBufferRemainingMs > 0 && this.coyoteRemainingMs > 0) {
      this.player.setVelocityY(this.tuning.jumpVelocity);
      this.jumpBufferRemainingMs = 0;
      this.coyoteRemainingMs = 0;
      jumpedThisUpdate = true;
      this.player.emit("player-jump-started", {
        kind: "normal", facingLeft: this.player.flipX,
      } satisfies PlayerJumpStartEvent);
    }

    // Arcade's grounded flags may still reflect the platform for this launch frame.
    this.updateAirState(jumpedThisUpdate ? false : this.isGrounded());
  }

  public startDash(durationMs = 250, speedPxPerSecond = 480): boolean {
    if (this.isDashing() || !this.controlEnabled || this.player.isControlLocked() ||
        this.player.getControlOverride() || !Number.isFinite(durationMs) || durationMs <= 0 ||
        !Number.isFinite(speedPxPerSecond) || speedPxPerSecond <= 0) return false;
    this.dashRemainingMs = durationMs;
    this.dashSpeed = speedPxPerSecond;
    this.dashDirection = this.player.flipX ? -1 : 1;
    this.player.setVelocityX(this.dashDirection * this.dashSpeed);
    return true;
  }

  public isDashing(): boolean { return this.dashRemainingMs > 0; }

  public setSurfaceModifier(modifier: PlayerSurfaceModifier | null): void {
    if (modifier && (!Number.isFinite(modifier.conveyorVelocityX) ||
      [modifier.acceleration, modifier.deceleration].some(v => v !== null && (!Number.isFinite(v) || v <= 0)))) throw new Error("Invalid surface modifier");
    this.surfaceModifier = modifier ? { ...modifier } : null;
  }

  public clearSurfaceModifier(): void { this.surfaceModifier = null; }

  public launchFromSurface(velocityY: number): boolean {
    if (!Number.isFinite(velocityY) || velocityY >= 0) throw new Error("Surface launch requires negative finite velocity");
    if (!this.controlEnabled || this.player.isControlLocked() || this.player.getControlOverride()) return false;
    this.coyoteRemainingMs = 0; this.jumpBufferRemainingMs = 0;
    this.player.setVelocityY(velocityY);
    this.player.emit("player-jump-started", { kind: "normal", facingLeft: this.player.flipX } satisfies PlayerJumpStartEvent);
    this.updateAirState(false);
    return true;
  }

  public cancelDash(): void {
    if (!this.isDashing()) return;
    this.dashRemainingMs = 0;
    this.player.setVelocityX(0);
  }

  public setControlEnabled(enabled: boolean): void {
    this.controlEnabled = enabled;
    if (!enabled) this.cancelDash();
  }

  public applyCementSlow(durationMs: number): void {
    if (this.isDashing()) return;
    this.cementSlowRemainingMs = Math.max(this.cementSlowRemainingMs, durationMs);
    this.player.setVelocityX(Math.max(-120, Math.min(120, this.player.body.velocity.x)));
  }

  public clearCementSlow(): void { this.cementSlowRemainingMs = 0; }
  public getCementSlowRemainingMs(): number { return this.cementSlowRemainingMs; }

  private currentRunSpeed(): number {
    return this.cementSlowRemainingMs > 0 ? Math.min(120, this.tuning.runSpeed) : this.tuning.runSpeed;
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
