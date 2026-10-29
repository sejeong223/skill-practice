export interface CementMotion {
  readonly x: number;
  readonly y: number;
  readonly startX: number;
  readonly startY: number;
  readonly targetX: number;
  readonly elapsedMs: number;
  readonly durationMs: number;
}

export const CEMENT_WAVE_SPEED = 360;
export const CEMENT_TRAIL_WIDTH = 160;
export const CEMENT_PUDDLE_MS = 1500;
export const CEMENT_SLOW_MS = 1000;
export const CEMENT_SLOW_SPEED = 120;

export function advanceCementWave(x: number, direction: -1 | 1, deltaMs: number): number {
  return x + direction * CEMENT_WAVE_SPEED * Math.max(0, Math.min(50, deltaMs)) / 1000;
}

export function cementTrailBounds(x: number, direction: -1 | 1) {
  return { x: direction < 0 ? x : x - CEMENT_TRAIL_WIDTH, y: 493,
    width: CEMENT_TRAIL_WIDTH, height: 16 };
}

export function advanceCementLump(state: CementMotion, deltaMs: number): { motion: CementMotion; landed: boolean } {
  const elapsedMs = Math.min(state.durationMs, state.elapsedMs + Math.max(0, Math.min(50, deltaMs)));
  const t = elapsedMs / state.durationMs;
  const x = state.startX + (state.targetX - state.startX) * t;
  const y = state.startY + (492 - state.startY) * t - 96 * Math.sin(Math.PI * t);
  return { motion: { ...state, x, y, elapsedMs }, landed: t >= 1 };
}

export function sweptCementBounds(previous: { x: number; y: number }, current: { x: number; y: number },
  halfWidth: number, halfHeight: number) {
  return { x: Math.min(previous.x, current.x) - halfWidth,
    y: Math.min(previous.y, current.y) - halfHeight,
    width: Math.abs(current.x - previous.x) + halfWidth * 2,
    height: Math.abs(current.y - previous.y) + halfHeight * 2 };
}

export function feetTouchCement(player: { left: number; right: number; bottom: number },
  puddle: { x: number; width: number }): boolean {
  return player.right > puddle.x && player.left < puddle.x + puddle.width &&
    player.bottom >= 490 && player.bottom <= 518;
}
