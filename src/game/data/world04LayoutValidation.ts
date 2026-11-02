import type { World04Layout, World04Object, World04Rect } from "./world04Types";
import { overlapRect, validRect } from "../systems/world04Geometry";

export function world04ObjectBounds(o: World04Object): World04Rect[] {
  switch (o.kind) {
    case "plate-gate": return [o.plate, o.door];
    case "crane": return [{ x: Math.min(o.payload.x, o.destinationX), y: o.liftTopY,
      width: Math.abs(o.destinationX - o.payload.x) + o.payload.width, height: o.payload.y + o.payload.height - o.liftTopY }];
    case "saw": return [{ x: o.fromX - o.radius, y: o.centerY - o.radius, width: o.toX - o.fromX + 2 * o.radius, height: 2 * o.radius }];
    case "swing": { const dx = Math.sin(o.amplitudeRad) * o.length + o.radius;
      return [{ x: o.pivot.x - dx, y: o.pivot.y, width: dx * 2, height: o.length + o.radius }]; }
    default: return [o.rect];
  }
}

export function validateWorld04Layout(l: World04Layout): readonly string[] {
  const errors: string[] = [], ids = new Set<string>();
  const fail = (s: string) => errors.push(s);
  const checkId = (id: string) => { if (!id || ids.has(id)) fail(`duplicate/missing id: ${id}`); ids.add(id); };
  const walk = (v: unknown, path = "layout"): void => {
    if (typeof v === "number" && !Number.isFinite(v)) fail(`nonfinite: ${path}`);
    if (v && typeof v === "object") for (const [k, value] of Object.entries(v)) {
      if (["width", "height", "radius", "length"].includes(k) && (typeof value !== "number" || value <= 0)) fail(`nonpositive: ${path}.${k}`);
      walk(value, `${path}.${k}`);
    }
  };
  walk(l);
  if (l.width !== 3840 || l.height !== 720 || l.floorY !== 504 || !/^world-04-stage-[1-4]$/.test(l.stageId)) fail("map contract");
  if (l.spawn.x !== 96 || l.spawn.y !== 504 || l.checkpoint.x !== 2496 || l.checkpoint.y !== 504) fail("spawn/checkpoint contract");
  const protectedRects = [
    { x: 0, y: 0, width: 192, height: 720 }, { x: 2368, y: 0, width: 288, height: 720 },
    { x: 3648, y: 0, width: 192, height: 720 },
  ];
  const bounds = (r: World04Rect, id: string) => {
    if (!validRect(r) || r.x < 0 || r.y < 0 || r.x + r.width > l.width || r.y + r.height > l.height) fail(`out of bounds: ${id}`);
  };
  const hazards: { id: string; rect: World04Rect }[] = [];
  for (const o of l.objects) {
    checkId(o.id);
    if (o.triggerX < 192 || o.triggerX > 3648) fail(`trigger: ${o.id}`);
    for (const rect of world04ObjectBounds(o)) hazards.push({ id: o.id, rect });
  }
  for (const t of l.terrain) {
    checkId(t.id); hazards.push({ id: t.id, rect: t.rect });
    if (t.rect.y !== 504) fail(`terrain alignment: ${t.id}`);
    if (t.kind === "rise" && (t.rearWidth + t.frontWidth !== t.rect.width || t.triggerInset >= t.rearWidth || t.reactMs <= 0)) fail(`rise dimensions: ${t.id}`);
  }
  for (const h of hazards) { bounds(h.rect, h.id); if (protectedRects.some(r => overlapRect(r, h.rect))) fail(`safe zone: ${h.id}`); }
  const holes = [...l.gaps, ...l.terrain.filter(t => t.kind === "collapse").map(t => t.rect)].sort((a, b) => a.x - b.x);
  holes.forEach((r, i) => {
    bounds(r, "gap");
    if (r.y !== 504 || protectedRects.some(s => overlapRect(r, s)) || (i > 0 && holes[i - 1].x + holes[i - 1].width > r.x)) fail("gap alignment/overlap/safety");
    if (l.solids.some(s => s.role === "ground" && overlapRect(s, r))) fail("floor covers hole");
  });
  for (const s of l.solids) { checkId(s.id); bounds(s, s.id); if (s.role !== "ground") hazards.push({ id: s.id, rect: s }); }
  for (const t of l.terrain.filter(t => t.kind === "rise")) {
    const retreat = { x: t.rect.x - 160, y: 184, width: 160, height: 352 };
    if (hazards.some(h => h.id !== t.id && overlapRect(h.rect, retreat)) || holes.some(h => overlapRect(h, retreat))) fail(`blocked retreat: ${t.id}`);
  }
  l.coins.forEach(c => { checkId(c.id); if (c.x < 0 || c.x >= l.width || c.y < 0 || c.y >= 504) fail(`coin: ${c.id}`); });
  if (l.coins.length !== 15) fail("coin economy");
  if (l.objects.length + l.terrain.length < 20) fail("insufficient mechanism density");
  if (l.stageId === "world-04-stage-4" && new Set(l.objects.map(o => o.kind)).size !== 10) fail("stage 4 missing kind");
  return errors;
}
