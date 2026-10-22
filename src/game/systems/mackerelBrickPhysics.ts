export interface MackerelBrickMotion {
  readonly x: number;
  readonly y: number;
  readonly startX: number;
  readonly startY: number;
  readonly targetX: number;
  readonly elapsedMs: number;
  readonly durationMs: number;
}

export function clampMackerelLanding(targetX: number, bossX: number, arenaWidth: number): number {
  return targetX < bossX
    ? Math.max(120, Math.min(bossX - 160, targetX))
    : Math.max(bossX + 160, Math.min(arenaWidth - 120, targetX));
}

export function clearPlayerFromBrick(landingX: number, playerX: number, bossX: number, arenaWidth: number): number {
  if (Math.abs(landingX - playerX) >= 70) return landingX;
  const direction = landingX < bossX ? 1 : -1;
  return clampMackerelLanding(landingX + direction * 84, bossX, arenaWidth);
}

export function advanceMackerelBrick(
  state: MackerelBrickMotion,
  deltaMs: number,
): { motion: MackerelBrickMotion; landed: boolean } {
  const elapsedMs = Math.min(state.durationMs, state.elapsedMs + Math.max(0, Math.min(50, deltaMs)));
  const t = Math.min(1, elapsedMs / state.durationMs);
  const x = state.startX + (state.targetX - state.startX) * t;
  const y = state.startY + (492 - state.startY) * t - 48 * Math.sin(Math.PI * t);
  return { motion: { ...state, x, y, elapsedMs }, landed: t >= 1 };
}

export function sweptMackerelBrickBounds(previous: MackerelBrickMotion, current: MackerelBrickMotion) {
  return {
    x: Math.min(previous.x, current.x) - 14,
    y: Math.min(previous.y, current.y) - 12,
    width: Math.abs(current.x - previous.x) + 28,
    height: Math.abs(current.y - previous.y) + 24,
  };
}
