import { createHash } from "node:crypto";
import type { Identity } from "../../src/game/cloud/contracts";
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, canonical(v)]));
  return value;
}
export function hashRequest(identity: Identity, input: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical({ playerId: identity.playerId, input }))).digest("hex");
}

