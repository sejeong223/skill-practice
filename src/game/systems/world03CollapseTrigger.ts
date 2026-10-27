import type { World03CollapseZone } from "../data/world03Construction";

export interface World03CollapseApproach {
  readonly left: number;
  readonly right: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly grounded: boolean;
}

const EDGE_TRIGGER_DISTANCE = 12;

export function shouldCollapseWorld03Floor(
  zone: World03CollapseZone,
  approach: World03CollapseApproach,
): boolean {
  if (!approach.grounded || approach.velocityY < 0) return false;
  const end = zone.x + zone.width;
  if (approach.velocityX > 24) {
    return approach.right >= zone.x - EDGE_TRIGGER_DISTANCE && approach.left < zone.x;
  }
  if (approach.velocityX < -24) {
    return approach.left <= end + EDGE_TRIGGER_DISTANCE && approach.right > end;
  }
  return false;
}
