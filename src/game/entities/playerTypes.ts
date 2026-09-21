export interface PlayerTuning {
  runSpeed: number;
  acceleration: number;
  deceleration: number;
  gravityY: number;
  jumpVelocity: number;
  maxFallSpeed: number;
  coyoteTimeMs: number;
  jumpBufferMs: number;
}

export type PlayerAnimationState =
  | "idle"
  | "run"
  | "jump"
  | "fall"
  | "hurt"
  | "death"
  | "attack-slipper"
  | "attack-bite"
  | "dash"
  | "bark"
  | "double-jump"
  | "tail-rotor";

export const DEFAULT_PLAYER_TUNING: PlayerTuning = {
  runSpeed: 220,
  acceleration: 1800,
  deceleration: 2200,
  gravityY: 1200,
  jumpVelocity: -460,
  maxFallSpeed: 900,
  coyoteTimeMs: 80,
  jumpBufferMs: 100,
};
