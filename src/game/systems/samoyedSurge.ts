export type SurgePhase = "entering" | "covering" | "leaving" | "done";
export interface SamoyedPath {
  readonly id: string;
  readonly fromX: number;
  readonly targetX: number;
  readonly exitX: number;
  readonly floorY: number;
  readonly delayMs: number;
  readonly index: number;
}
export interface SamoyedSurge {
  readonly startedAtMs: number;
  readonly dogs: readonly SamoyedPath[];
}
export const SAMOYED_RELEASE_MS = 2200;
export const SAMOYED_DONE_MS = 2500;
export const SAMOYED_SIZE = { width: 140, height: 120 } as const;

export function createSamoyedSurge(
  origin: { x: number; floorY: number },
  viewport: { left: number; right: number },
  startedAtMs: number,
  count = 5,
): SamoyedSurge {
  const size = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1;
  return {
    startedAtMs,
    dogs: Array.from({ length: size }, (_, index) => ({
      id: `samoyed-${startedAtMs}-${index}`, index,
      fromX: viewport.left - SAMOYED_SIZE.width / 2 - 8 - index * 76,
      targetX: origin.x + (index - (size - 1) / 2) * 32,
      exitX: viewport.right + SAMOYED_SIZE.width / 2 + 8 + index * 76,
      floorY: origin.floorY, delayMs: index * 70,
    })),
  };
}

export function sampleSamoyedDog(path: SamoyedPath, elapsedMs: number): {
  x: number; y: number; phase: SurgePhase;
} {
  if (elapsedMs >= SAMOYED_DONE_MS) return { x: path.exitX, y: path.floorY, phase: "done" };
  const leaving = elapsedMs >= SAMOYED_RELEASE_MS;
  const progress = leaving
    ? Math.min(1, (elapsedMs - SAMOYED_RELEASE_MS) / (SAMOYED_DONE_MS - SAMOYED_RELEASE_MS))
    : Math.min(1, Math.max(0, elapsedMs - path.delayMs) / 650);
  const phase: SurgePhase = leaving ? "leaving" : progress < 1 ? "entering" : "covering";
  const from = leaving ? path.targetX : path.fromX;
  const to = leaving ? path.exitX : path.targetX;
  // Envelope returns the paws to the floor at both ends, without boundary jumps.
  const bob = phase === "covering" ? 0 : 2 * Math.sin(progress * Math.PI) * Math.abs(Math.sin(progress * Math.PI * 8));
  return { x: from + (to - from) * progress, y: path.floorY - bob, phase };
}
