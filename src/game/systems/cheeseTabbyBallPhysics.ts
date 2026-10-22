export interface CheeseBallMotion {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly bounces: 0 | 1;
  readonly ageMs: number;
}

export function advanceCheeseBall(
  state: CheeseBallMotion,
  deltaMs: number,
  floorY = 504,
): CheeseBallMotion | null {
  const delta = Math.max(0, Math.min(50, Number.isFinite(deltaMs) ? deltaMs : 0));
  const seconds = delta / 1000;
  const ageMs = state.ageMs + delta;
  if (ageMs >= 3000) return null;
  const x = state.x + state.vx * seconds;
  const vy = state.vy + 900 * seconds;
  const y = state.y + vy * seconds;
  if (y >= floorY - 12 && vy > 0) {
    if (state.bounces === 1) return null;
    return { x, y: floorY - 12, vx: state.vx, vy: -240, bounces: 1, ageMs };
  }
  return { x, y, vx: state.vx, vy, bounces: state.bounces, ageMs };
}

export function sweptCheeseBallBounds(
  previous: CheeseBallMotion,
  current: CheeseBallMotion,
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.min(previous.x, current.x) - 12,
    y: Math.min(previous.y, current.y) - 12,
    width: Math.abs(current.x - previous.x) + 24,
    height: Math.abs(current.y - previous.y) + 24,
  };
}
