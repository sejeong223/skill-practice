export interface BossBarkStunState {
  readonly remainingMs: number;
  readonly nextAllowedAt: number;
}

export const BARK_BOSS_RANGE_PX = 320;
export const BARK_BOSS_STUN_MS = 1200;
export const BARK_BOSS_RESTUN_MS = 3000;

export function beginBossBarkStun(
  state: BossBarkStunState,
  now: number,
  distancePx: number,
  active: boolean,
): BossBarkStunState | null {
  if (
    !active ||
    !Number.isFinite(now) ||
    !Number.isFinite(distancePx) ||
    distancePx < 0 ||
    distancePx > BARK_BOSS_RANGE_PX ||
    state.remainingMs > 0 ||
    now < state.nextAllowedAt
  ) return null;

  return {
    remainingMs: BARK_BOSS_STUN_MS,
    nextAllowedAt: now + BARK_BOSS_RESTUN_MS,
  };
}

export function tickBossBarkStun(
  state: BossBarkStunState,
  deltaMs: number,
): BossBarkStunState {
  const elapsed = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
  return {
    remainingMs: Math.max(0, state.remainingMs - elapsed),
    nextAllowedAt: state.nextAllowedAt,
  };
}
