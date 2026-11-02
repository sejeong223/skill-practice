import type { World04Point, World04Rect } from "../data/world04Types";

const finitePoint = (p: World04Point) => Number.isFinite(p.x) && Number.isFinite(p.y);
export const validRect = (r: World04Rect): boolean => finitePoint(r) &&
  Number.isFinite(r.width) && Number.isFinite(r.height) && r.width > 0 && r.height > 0;

export function overlapRect(a: World04Rect, b: World04Rect): boolean {
  return validRect(a) && validRect(b) && a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

export function overlapCircleRect(p: World04Point, radius: number, r: World04Rect): boolean {
  if (!finitePoint(p) || !validRect(r) || !Number.isFinite(radius) || radius <= 0) return false;
  const dx = p.x - Math.max(r.x, Math.min(r.x + r.width, p.x));
  const dy = p.y - Math.max(r.y, Math.min(r.y + r.height, p.y));
  return dx * dx + dy * dy < radius * radius;
}

// Open slabs: merely grazing an edge is not a lethal contact.
function segmentInRect(p: World04Point, d: World04Point, r: World04Rect): boolean {
  let enter = 0, leave = 1;
  for (const [v, delta, low, high] of [[p.x, d.x, r.x, r.x + r.width], [p.y, d.y, r.y, r.y + r.height]]) {
    if (delta === 0) { if (v <= low || v >= high) return false; }
    else {
      const a = (low - v) / delta, b = (high - v) / delta;
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
      if (enter >= leave) return false;
    }
  }
  return leave > 0 && enter < 1;
}

export function sweepRect(a: World04Rect, b: World04Rect, h: World04Rect, j: World04Rect): boolean {
  if (![a, b, h, j].every(validRect)) return false;
  if (overlapRect(a, h) || overlapRect(b, j)) return true;
  return segmentInRect(a, { x: b.x - a.x - (j.x - h.x), y: b.y - a.y - (j.y - h.y) },
    { x: h.x - a.width, y: h.y - a.height, width: h.width + a.width, height: h.height + a.height });
}

function pointSegmentDistance2(p: World04Point, a: World04Point, b: World04Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return (p.x - a.x - dx * t) ** 2 + (p.y - a.y - dy * t) ** 2;
}

export function sweepCircleRect(a: World04Rect, b: World04Rect, p: World04Point, q: World04Point, radius: number): boolean {
  if (![a, b].every(validRect) || !finitePoint(p) || !finitePoint(q) || !Number.isFinite(radius) || radius <= 0) return false;
  const end = { x: q.x - b.x + a.x, y: q.y - b.y + a.y };
  if (overlapCircleRect(p, radius, a) || overlapCircleRect(end, radius, a) ||
    segmentInRect(p, { x: end.x - p.x, y: end.y - p.y }, a)) return true;
  const corners = [{ x: a.x, y: a.y }, { x: a.x + a.width, y: a.y },
    { x: a.x + a.width, y: a.y + a.height }, { x: a.x, y: a.y + a.height }];
  // Segment pairs that do not intersect attain minimum distance at an endpoint.
  return corners.some((corner, i) => {
    const next = corners[(i + 1) % 4];
    return Math.min(pointSegmentDistance2(corner, p, end), pointSegmentDistance2(p, corner, next),
      pointSegmentDistance2(end, corner, next)) < radius * radius;
  });
}
