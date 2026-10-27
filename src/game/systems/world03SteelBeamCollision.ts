export interface AxisAlignedBounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function validBounds(bounds: AxisAlignedBounds): boolean {
  return [bounds.left, bounds.right, bounds.top, bounds.bottom].every(Number.isFinite)
    && bounds.left <= bounds.right
    && bounds.top <= bounds.bottom;
}

function axisTimes(
  movingMin: number,
  movingMax: number,
  fixedMin: number,
  fixedMax: number,
  relativeDistance: number,
): readonly [number, number] | null {
  if (relativeDistance === 0) {
    return movingMax < fixedMin || movingMin > fixedMax
      ? null
      : [-Infinity, Infinity];
  }
  const first = (fixedMin - movingMax) / relativeDistance;
  const second = (fixedMax - movingMin) / relativeDistance;
  return [Math.min(first, second), Math.max(first, second)];
}

export function sweptAabbOverlap(
  beamBefore: AxisAlignedBounds,
  beamAfter: AxisAlignedBounds,
  playerBefore: AxisAlignedBounds,
  playerAfter: AxisAlignedBounds,
): boolean {
  if (![beamBefore, beamAfter, playerBefore, playerAfter].every(validBounds)) return false;
  const relativeX = (beamAfter.left - beamBefore.left) - (playerAfter.left - playerBefore.left);
  const relativeY = (beamAfter.top - beamBefore.top) - (playerAfter.top - playerBefore.top);
  const x = axisTimes(beamBefore.left, beamBefore.right, playerBefore.left, playerBefore.right, relativeX);
  const y = axisTimes(beamBefore.top, beamBefore.bottom, playerBefore.top, playerBefore.bottom, relativeY);
  if (!x || !y) return false;
  const entry = Math.max(x[0], y[0], 0);
  const exit = Math.min(x[1], y[1], 1);
  return entry <= exit;
}
