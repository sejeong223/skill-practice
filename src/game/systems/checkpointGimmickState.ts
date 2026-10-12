import type { WorldGimmickDefinition } from "../core/contentTypes";
import type { GimmickRuntimeState } from "../core/runtimeTypes";

export function toCheckpointGimmickState(
  kind: WorldGimmickDefinition["kind"],
  state: GimmickRuntimeState,
): GimmickRuntimeState {
  const isSnackEffect = kind === "fake-bone-green" || kind === "fake-bone-reverse" || kind === "fake-bone-fire";
  // Keep the consumed snack, but never carry its pending death into a new life.
  // Copy instead of changing the live effect: this attempt must still resolve it.
  if (isSnackEffect && state.status === "triggered") {
    return { ...state, status: "escaped", startedAt: null };
  }
  return { ...state };
}
