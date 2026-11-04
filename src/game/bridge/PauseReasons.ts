export type PauseReason = "manual" | "shop" | "catalog" | "paint" | "world-select" | "reset" | "leaderboard" |
  "bootstrap" | "save-error" | "auth" | "session-lost" | "conflict" | "hidden";
const forced: readonly PauseReason[] = ["bootstrap", "save-error", "auth", "session-lost", "conflict", "hidden", "reset"];
export function hasForcedPause(reasons: ReadonlySet<PauseReason>): boolean { return forced.some(reason => reasons.has(reason)); }
export class PauseReasons {
  private reasons = new Set<PauseReason>();
  private listeners = new Set<(reasons: ReadonlySet<PauseReason>) => void>();
  set(reason: PauseReason, active: boolean): void {
    if (this.reasons.has(reason) === active) return;
    this.reasons = new Set(this.reasons);
    if (active) this.reasons.add(reason); else this.reasons.delete(reason);
    this.listeners.forEach(listener => listener(this.snapshot()));
  }
  has(reason: PauseReason): boolean { return this.reasons.has(reason); }
  snapshot = (): ReadonlySet<PauseReason> => this.reasons;
  isPaused(): boolean { return this.reasons.size > 0; }
  subscribe = (listener: (reasons: ReadonlySet<PauseReason>) => void): (() => void) => {
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  };
}
