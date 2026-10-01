export type FishbonePattern = "low" | "mid" | "high";

export interface FishboneTrajectory {
  readonly pattern: FishbonePattern;
  readonly startX: number;
  readonly startY: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly gravityY: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly durationSeconds: number;
}

const PATTERNS = [
  { pattern: "low", startY: 498, arcHeight: 0 },
  { pattern: "mid", startY: 472, arcHeight: 50 },
  { pattern: "high", startY: 444, arcHeight: 95 },
] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function createFishboneTrajectory(
  startX: number,
  playerX: number,
  playerCenterY: number,
  throwIndex: number,
): FishboneTrajectory {
  const selected = PATTERNS[(throwIndex - 1) % PATTERNS.length];
  const targetY = selected.pattern === "low"
    ? 498
    : selected.pattern === "mid"
      ? clamp(playerCenterY - 8, 450, 505)
      : clamp(playerCenterY - 18, 435, 495);
  const durationSeconds = clamp(Math.abs(playerX - startX) / 220, 0.85, 4.5);

  return {
    pattern: selected.pattern,
    startX,
    startY: selected.startY,
    velocityX: (playerX - startX) / durationSeconds,
    velocityY: (targetY - selected.startY - 4 * selected.arcHeight) / durationSeconds,
    gravityY: 8 * selected.arcHeight / (durationSeconds * durationSeconds),
    targetX: playerX,
    targetY,
    durationSeconds,
  };
}

export function fishbonePositionAt(
  trajectory: FishboneTrajectory,
  elapsedSeconds: number,
): { x: number; y: number } {
  return {
    x: trajectory.startX + trajectory.velocityX * elapsedSeconds,
    y: trajectory.startY + trajectory.velocityY * elapsedSeconds
      + 0.5 * trajectory.gravityY * elapsedSeconds * elapsedSeconds,
  };
}
