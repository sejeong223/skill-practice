import type { World04Object, World04Rect } from "../data/world04Types";
export type World04GroundDefinition = Extract<World04Object, { kind: "scrap" | "tire" | "oil" | "belt" | "cable" | "press" | "plate-gate" }>;
export type World04GroundState =
  | { readonly kind: "scrap" | "oil"; readonly id: string }
  | { readonly kind: "tire"; readonly id: string; readonly armed: boolean; readonly animationMs: number; readonly wasInside: boolean }
  | { readonly kind: "belt" | "cable" | "press"; readonly id: string; readonly started: boolean; readonly elapsedMs: number }
  | { readonly kind: "plate-gate"; readonly id: string; readonly phase: "closed" | "open" | "rearming"; readonly elapsedMs: number; readonly wasDown: boolean; readonly released: boolean };
export interface World04GroundSample {
  readonly before: World04Rect; readonly after: World04Rect; readonly grounded: boolean; readonly velocityY: number; readonly canLaunch: boolean;
}
export interface World04GroundStep {
  readonly state: World04GroundState; readonly dangerRects: readonly World04Rect[];
  readonly risk: "none" | "attack" | "physical"; readonly blockingRect: World04Rect | null;
  readonly launchVelocityY: number | null; readonly warning: boolean; readonly frame: number; readonly conveyorVelocityX: number;
}
export function footOnRect(body: World04Rect, pad: World04Rect): boolean {
  const footX = body.x + body.width / 2;
  return footX >= pad.x && footX <= pad.x + pad.width && Math.abs(body.y + body.height - pad.y - pad.height) <= 8;
}
export function createGroundState(d: World04GroundDefinition): World04GroundState {
  const base = { id: d.id, kind: d.kind };
  switch (d.kind) {
    case "scrap": case "oil": return { ...base, kind: d.kind };
    case "tire": return { ...base, kind: d.kind, armed: true, animationMs: 0, wasInside: false };
    case "plate-gate": return { ...base, kind: d.kind, phase: "closed", elapsedMs: 0, wasDown: false, released: true };
    default: return { ...base, kind: d.kind, started: false, elapsedMs: 0 };
  }
}
export function advanceGroundState(d: World04GroundDefinition, s: World04GroundState, b: World04GroundSample, deltaMs: number): World04GroundStep {
  if (s.id !== d.id || s.kind !== d.kind) throw new Error(`Ground state mismatch: ${d.id}`);
  const dt = Number.isFinite(deltaMs) ? Math.max(0, Math.min(50, deltaMs)) : 0;
  const result: World04GroundStep = { state: s, dangerRects: [], risk: "none", blockingRect: null, launchVelocityY: null, warning: false, frame: 0, conveyorVelocityX: 0 };
  if (d.kind === "scrap") return { ...result, dangerRects: [d.rect], risk: "physical" };
  if (d.kind === "oil") return result;
  if (d.kind === "tire" && s.kind === "tire") {
    const inside = footOnRect(b.after, d.rect), center = b.after.x + b.after.width / 2;
    const leftPad = center < d.rect.x - 12 || center > d.rect.x + d.rect.width + 12;
    const wasInside = leftPad ? false : s.wasInside;
    const armed = s.armed || (!wasInside && b.grounded && leftPad);
    const launch = armed && inside && b.grounded && b.velocityY >= 0 && b.canLaunch;
    const animationMs = launch ? 180 : Math.max(0, s.animationMs - dt);
    return { ...result, state: { ...s, armed: launch ? false : armed, animationMs, wasInside: launch || wasInside },
      launchVelocityY: launch ? d.launchVelocityY : null, frame: animationMs > 120 ? 1 : animationMs > 0 ? 2 : 0 };
  }
  if (d.kind === "plate-gate" && s.kind === "plate-gate") {
    const down = b.grounded && b.velocityY >= 0 && footOnRect(b.after, d.plate);
    let phase = s.phase, elapsedMs = s.elapsedMs + dt, released = s.released || !down;
    let crushing = false;
    if (phase === "rearming" && elapsedMs >= d.rearmMs && released) { phase = "closed"; elapsedMs = 0; }
    if (phase === "closed" && down && !s.wasDown && released) { phase = "open"; elapsedMs = 0; released = false; }
    else if (phase === "open" && elapsedMs >= d.openMs) { phase = "rearming"; elapsedMs = 0; crushing = true; }
    return { ...result, state: { ...s, phase, elapsedMs, wasDown: down, released }, frame: down ? 1 : 0,
      blockingRect: phase === "open" ? null : d.door, dangerRects: crushing ? [d.door] : [], risk: crushing ? "physical" : "none" };
  }
  if (!("started" in s) || !(d.kind === "belt" || d.kind === "cable" || d.kind === "press")) return result;
  const crossing = b.before.x + b.before.width < d.triggerX && b.after.x + b.after.width >= d.triggerX;
  const started = s.started || crossing, elapsedMs = s.started ? s.elapsedMs + dt : 0;
  const state = { ...s, started, elapsedMs };
  if (d.kind === "belt") {
    const direction = d.initialDirection * (Math.floor(elapsedMs / d.periodMs) % 2 ? -1 : 1);
    return { ...result, state, frame: Math.floor(elapsedMs / 100) % 4, conveyorVelocityX: direction * d.speed,
      warning: started && elapsedMs % d.periodMs >= d.periodMs - d.warningMs };
  }
  if (d.kind === "cable") {
    const t = elapsedMs % d.periodMs, on = started && t >= d.offMs, warning = on && t >= d.periodMs - d.warningMs;
    return { ...result, state, dangerRects: on ? [d.rect] : [], risk: on ? "attack" : "none", frame: on ? warning ? 1 : 2 : 0, warning };
  }
  const t = elapsedMs % (d.openMs + d.warningMs + d.closeMs + d.holdMs + d.reopenMs), closeStart = d.openMs + d.warningMs;
  const p = t < closeStart ? 0 : t < closeStart + d.closeMs ? (t - closeStart) / d.closeMs :
    t < closeStart + d.closeMs + d.holdMs ? 1 : 1 - (t - closeStart - d.closeMs - d.holdMs) / d.reopenMs;
  const w = d.rect.width / 2 * p;
  return { ...result, state, warning: t >= d.openMs && t < closeStart,
    risk: w > 0 ? "physical" : "none", dangerRects: w > 0 ? [{ ...d.rect, width: w }, { ...d.rect, x: d.rect.x + d.rect.width - w, width: w }] : [] };
}
