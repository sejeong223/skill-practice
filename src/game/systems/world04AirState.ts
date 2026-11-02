import type { World04Object, World04Point, World04Rect } from "../data/world04Types";
export type World04AirDefinition = Extract<World04Object, { kind: "crane" | "swing" | "saw" }>;
export interface World04AirClock { readonly id: string; readonly started: boolean; readonly elapsedMs: number; }
export interface World04AirPose {
  readonly rect: World04Rect | null; readonly circle: { readonly center: World04Point; readonly radius: number } | null;
  readonly magnet: World04Point | null; readonly warning: boolean; readonly phase: string;
}
export function advanceWorld04AirClock(d: World04AirDefinition, s: World04AirClock, previousRight: number, currentRight: number, deltaMs: number): World04AirClock {
  if (s.id !== d.id) throw new Error(`Air clock mismatch: ${d.id}`);
  const dt = Number.isFinite(deltaMs) ? Math.min(50, Math.max(0, deltaMs)) : 0;
  return { id: d.id, started: s.started || (previousRight < d.triggerX && currentRight >= d.triggerX), elapsedMs: s.started ? s.elapsedMs + dt : 0 };
}
export function evaluateWorld04Air(d: World04AirDefinition, elapsedMs: number): World04AirPose {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  if (d.kind === "swing") {
    const a = d.amplitudeRad * Math.sin(2 * Math.PI * (elapsed % d.periodMs) / d.periodMs);
    return { rect: null, magnet: null, warning: false, phase: "swing", circle: { center: { x: d.pivot.x + d.length * Math.sin(a), y: d.pivot.y + d.length * Math.cos(a) }, radius: d.radius } };
  }
  if (d.kind === "saw") {
    const u = (elapsed % d.periodMs) / d.periodMs, p = u < .5 ? 2 * u : 2 - 2 * u;
    return { rect: null, magnet: null, warning: false, phase: "travel", circle: { center: { x: d.fromX + (d.toX - d.fromX) * p, y: d.centerY }, radius: d.radius } };
  }
  const a = { x: d.payload.x, y: d.payload.y }, ah = { x: a.x, y: d.liftTopY }, b = { x: d.destinationX, y: a.y }, bh = { x: b.x, y: d.liftTopY };
  const legs = [
    { from: a, to: a, duration: d.dwellMs, phase: "dwell-a" }, { from: a, to: ah, duration: d.legMs, phase: "lift-a" },
    { from: ah, to: bh, duration: d.legMs, phase: "cross-b" }, { from: bh, to: b, duration: d.legMs, phase: "lower-b" },
    { from: b, to: b, duration: d.dwellMs, phase: "dwell-b" }, { from: b, to: bh, duration: d.legMs, phase: "lift-b" },
    { from: bh, to: ah, duration: d.legMs, phase: "cross-a" }, { from: ah, to: a, duration: d.legMs, phase: "lower-a" },
  ];
  let t = elapsed % (2 * d.dwellMs + 6 * d.legMs), leg = legs[0];
  for (const candidate of legs) { leg = candidate; if (t < leg.duration) break; t -= leg.duration; }
  const p = t / leg.duration, x = leg.from.x + (leg.to.x - leg.from.x) * p, y = leg.from.y + (leg.to.y - leg.from.y) * p;
  return { rect: { ...d.payload, x, y }, circle: null, magnet: { x: x + d.payload.width / 2, y: y - 16 },
    warning: leg.phase.startsWith("dwell") && t >= d.dwellMs - 250, phase: leg.phase };
}
