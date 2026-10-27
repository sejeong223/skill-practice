import type { WorldId } from "../core/types";
import { SNACK_PRESENTATION } from "../data/snackPresentation";

export function segmentCoinPresentation(worldId: WorldId): { appearance?: "bone"; y: number } {
  return worldId === "world-02" || worldId === "world-03"
    ? { appearance: "bone", y: 504 - SNACK_PRESENTATION.topOffsetFromFloor }
    : { y: 450 };
}
