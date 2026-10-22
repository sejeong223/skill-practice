export type ScrapPhase = "falling" | "drag-warning" | "dragging" | "done";

export interface TuxedoScrapMotion {
  readonly x: number;
  readonly y: number;
  readonly targetX: number;
  readonly dragToX: number;
  readonly phase: ScrapPhase;
  readonly phaseMs: number;
}

export const SCRAP_FALL_MS = 700;
export const SCRAP_DRAG_WARNING_MS = 250;
export const SCRAP_DRAG_MS = 450;

export function clampTuxedoTarget(x: number): number {
  return Math.max(160, Math.min(1120, x));
}

export function chooseTuxedoDrag(targetX: number, serial: number): number {
  let direction = serial % 2 === 0 ? -1 : 1;
  if (targetX + direction * 110 < 160 || targetX + direction * 110 > 1120) direction *= -1;
  return clampTuxedoTarget(targetX + direction * 110);
}

export function advanceTuxedoScrap(motion: TuxedoScrapMotion, deltaMs: number): TuxedoScrapMotion {
  const delta = Math.max(0, Math.min(50, deltaMs));
  const elapsed = motion.phaseMs + delta;
  switch (motion.phase) {
    case "falling": {
      if (elapsed >= SCRAP_FALL_MS) return { ...motion, y: 488, phase: "drag-warning", phaseMs: 0 };
      return { ...motion, y: 140 + 348 * elapsed / SCRAP_FALL_MS, phaseMs: elapsed };
    }
    case "drag-warning":
      return elapsed >= SCRAP_DRAG_WARNING_MS
        ? { ...motion, phase: "dragging", phaseMs: 0 }
        : { ...motion, phaseMs: elapsed };
    case "dragging": {
      if (elapsed >= SCRAP_DRAG_MS) return { ...motion, x: motion.dragToX, phase: "done", phaseMs: 0 };
      return { ...motion, x: motion.targetX + (motion.dragToX - motion.targetX) * elapsed / SCRAP_DRAG_MS, phaseMs: elapsed };
    }
    case "done": return motion;
  }
}

export function sweptTuxedoScrapBounds(previous: TuxedoScrapMotion, current: TuxedoScrapMotion) {
  return {
    x: Math.min(previous.x, current.x) - 12,
    y: Math.min(previous.y, current.y) - 15,
    width: Math.abs(current.x - previous.x) + 24,
    height: Math.abs(current.y - previous.y) + 30,
  };
}
