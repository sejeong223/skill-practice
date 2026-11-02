import type { World04Rect, World04Terrain } from "../data/world04Types";
export interface World04BodySample {
  readonly before: World04Rect; readonly after: World04Rect;
  readonly velocityX: number; readonly velocityY: number; readonly grounded: boolean;
}
export interface World04TerrainState {
  readonly id: string;
  readonly phase: "armed" | "falling" | "collapsed" | "retreat" | "strike" | "lowering" | "spent";
  readonly elapsedMs: number;
}
export interface World04TerrainStep {
  readonly state: World04TerrainState; readonly bridgeEnabled: boolean;
  readonly frontRect: World04Rect | null; readonly rearRect: World04Rect | null;
  readonly dangerRects: readonly World04Rect[]; readonly fallProgress: number;
}
export function createTerrainState(d: World04Terrain): World04TerrainState { return { id: d.id, phase: "armed", elapsedMs: 0 }; }
export function advanceTerrainState(d: World04Terrain, s: World04TerrainState, b: World04BodySample, deltaMs: number): World04TerrainStep {
  if (d.id !== s.id) throw new Error(`Terrain state mismatch: ${d.id}/${s.id}`);
  const delta = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0;
  let phase = s.phase, elapsedMs = s.elapsedMs;
  const rightBefore = b.before.x + b.before.width, rightAfter = b.after.x + b.after.width;
  if (d.kind === "collapse") {
    const leftCross = rightBefore <= d.rect.x - d.edgeDistance && rightAfter >= d.rect.x - d.edgeDistance && b.after.x < d.rect.x;
    const rightCross = b.before.x >= d.rect.x + d.rect.width + d.edgeDistance && b.after.x <= d.rect.x + d.rect.width + d.edgeDistance && rightAfter > d.rect.x + d.rect.width;
    if (phase === "armed" && b.grounded && b.velocityY >= 0 && (leftCross || rightCross)) phase = "falling";
    else if (phase !== "armed") elapsedMs += delta;
    if (phase === "falling" && elapsedMs >= d.fallMs) phase = "collapsed";
    return { state: { id: d.id, phase, elapsedMs }, bridgeEnabled: phase === "armed", frontRect: null, rearRect: null, dangerRects: [], fallProgress: phase === "armed" ? 0 : Math.min(1, elapsedMs / d.fallMs) };
  }
  if (phase === "armed" && rightBefore <= d.rect.x + d.triggerInset && rightAfter >= d.rect.x + d.triggerInset && rightAfter > rightBefore) phase = "retreat";
  else if (phase !== "armed" && phase !== "spent") elapsedMs += delta;
  if (phase !== "armed") {
    if (elapsedMs >= d.reactMs + d.holdMs + d.lowerMs) phase = "spent";
    else if (elapsedMs >= d.reactMs + d.holdMs) phase = "lowering";
    else if (elapsedMs >= d.reactMs) phase = "strike";
  }
  const active = phase !== "armed" && phase !== "spent";
  const height = phase === "lowering" ? d.riseHeight * (1 - (elapsedMs - d.reactMs - d.holdMs) / d.lowerMs) : d.riseHeight;
  const front = (h: number) => ({ x: d.rect.x + d.rearWidth, y: d.rect.y - h, width: d.frontWidth, height: h });
  const rear = (h: number) => ({ x: d.rect.x, y: d.rect.y - h, width: d.rearWidth, height: h });
  const frontRect = active ? front(height) : null;
  const rearRect = active && phase !== "retreat" ? rear(height) : null;
  // Preserve the crossed strike for callers advancing over multiple boundaries in one step.
  const crossedStrike = s.phase !== "armed" && s.phase !== "spent" && s.elapsedMs < d.reactMs && elapsedMs >= d.reactMs;
  const dangerRects = crossedStrike ? [front(d.riseHeight), rear(d.riseHeight)] : rearRect && frontRect ? [frontRect, rearRect] : [];
  return { state: { id: d.id, phase, elapsedMs }, bridgeEnabled: true, frontRect, rearRect, dangerRects, fallProgress: 0 };
}
