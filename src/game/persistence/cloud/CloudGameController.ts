import type { ApiErrorCode, Bootstrap, SaveEvent } from "../../cloud/contracts";
import type { ProgressState } from "../../core/types";
import { GameEventBus } from "../../bridge/GameEventBus";
import { AccountCache } from "./AccountCache";
import { ApiClientError, GameApiClient } from "./GameApiClient";
import { CloudSaveCoordinator, type SaveStatus } from "./CloudSaveCoordinator";
import { CloudSessionClient } from "./CloudSessionClient";
import { claimTabSession, type TabSession } from "./tabSession";

export interface CloudGameSession {
  bootstrap: Bootstrap; sessionId: string; api: GameApiClient; saves: CloudSaveCoordinator;
  sessions: CloudSessionClient; bus: GameEventBus;
}
export interface CloudGameState {
  phase: "loading" | "ready" | "takeover" | "error" | "closed";
  cloud: CloudGameSession | null; status: SaveStatus; message: string | null; saved: boolean;
}
export class CloudGameController {
  private state: CloudGameState = { phase: "loading", cloud: null, status: "idle", message: null, saved: false };
  private listeners = new Set<() => void>();
  private bus = new GameEventBus();
  private tab?: TabSession;
  private sessions: CloudSessionClient;
  private saves?: CloudSaveCoordinator;
  private lifetime = new AbortController();
  private starting?: Promise<void>;
  private saveStatus: SaveStatus = "idle";
  private sessionStatus: SaveStatus = "idle";
  private leaseConfirmed = false;
  private stopped = false;
  constructor(private readonly api: GameApiClient, private readonly cache: AccountCache,
    private readonly claim = claimTabSession, private readonly now = Date.now,
    private readonly document: Document | null = typeof globalThis.document === "undefined" ? null : globalThis.document) {
    this.bus.pauseReasons.set("bootstrap", true);
    this.bus.on("cloud-resume-error", () => { this.sessionStatus = "conflict"; this.syncStatus(); });
    this.sessions = new CloudSessionClient(api, code => this.connectionLost(code), () => {
      this.leaseConfirmed = true;
      if (this.sessionStatus === "reconnecting" && !this.saves?.hasPending() && (!this.saves || this.saves.getStatus() === "idle")) this.sessionStatus = "idle";
      this.syncStatus();
      if (this.sessionStatus === "reconnecting" && this.saves?.hasPending()) void this.saves.retry().catch(() => {});
    }, document);
    document?.addEventListener("visibilitychange", this.visibility);
  }
  getSnapshot = (): CloudGameState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(update: Partial<CloudGameState>): void {
    if (this.stopped) return;
    this.state = { ...this.state, ...update }; this.listeners.forEach(listener => listener());
  }
  private syncStatus(): void {
    if (this.stopped) return;
    const all = [this.saveStatus, this.sessionStatus];
    const status = (["session-lost", "conflict", "reauth-required", "storage-error", "reconnecting", "saving"] as const).find(s => all.includes(s)) ?? "idle";
    this.bus.pauseReasons.set("save-error", all.includes("reconnecting") || all.includes("storage-error"));
    this.bus.pauseReasons.set("auth", all.includes("reauth-required"));
    this.bus.pauseReasons.set("session-lost", all.includes("session-lost"));
    this.bus.pauseReasons.set("conflict", all.includes("conflict"));
    this.publish({ status });
  }
  private connectionLost(code: ApiErrorCode): void {
    if (["session-lost", "conflict", "reauth-required"].includes(this.sessionStatus)) return;
    this.leaseConfirmed = false;
    this.sessionStatus = code === "SESSION_LOST" || code === "SESSION_CONFLICT" ? "session-lost" :
      code === "UNAUTHENTICATED" ? "reauth-required" : code === "FORBIDDEN" ? "conflict" : "reconnecting";
    this.syncStatus();
  }
  private visibility = (): void => {
    const hidden = this.document?.visibilityState === "hidden";
    if (!hidden) this.connectionLost("UNAVAILABLE");
    this.bus.pauseReasons.set("hidden", Boolean(hidden));
    if (!hidden && this.state.cloud) void this.retry().catch(() => {});
  };
  private signal(): AbortSignal { return AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(10000)]); }
  private check(): void { this.lifetime.signal.throwIfAborted(); }
  start = (takeover = false): Promise<void> => this.starting ??= this.open(takeover).finally(() => { this.starting = undefined; });
  private coordinator(bootstrap: Bootstrap): CloudSaveCoordinator {
    return new CloudSaveCoordinator({ api: this.api, cache: this.cache, bootstrap, sessionId: this.tab!.sessionId, now: this.now,
      ensureValid: this.sessions.ensureValid,
      onStatus: status => {
        this.saveStatus = status;
        if (status === "idle" && this.leaseConfirmed && this.sessionStatus === "reconnecting") this.sessionStatus = "idle";
        this.syncStatus();
      },
      onAck: () => {
        const next = this.saves?.getBootstrap();
        if (next && this.state.cloud && next.current.runId !== this.state.cloud.bootstrap.current.runId) {
          this.bus.pauseReasons.set("reset", false);
          this.publish({ cloud: { ...this.state.cloud, bootstrap: next } });
        }
        this.publish({ saved: true });
      },
    });
  }
  private async open(takeover: boolean): Promise<void> {
    // StrictMode's first setup is disposed before making any external request.
    await Promise.resolve();
    if (this.stopped) return;
    this.publish({ phase: "loading", message: null });
    try {
      let bootstrap = await this.api.bootstrap(this.signal()); this.check();
      if (!this.tab) {
        const tab = await this.claim(bootstrap.playerId);
        if (this.stopped) { tab.release(); return; }
        this.tab = tab;
      }
      const cached = this.cache.read(bootstrap.playerId, this.tab.sessionId);
      if (cached && (cached.inFlight || cached.queued.length || cached.pendingReset)) {
        if (bootstrap.lease.sessionId === cached.sessionId && bootstrap.lease.generation === cached.generation &&
            (bootstrap.current.runId === cached.runId || cached.pendingReset)) {
          this.sessions.start(bootstrap.lease); await this.sessions.ensureValid(); this.check();
          this.saves?.dispose(); this.saves = this.coordinator(bootstrap);
          await this.saves.retry(); this.check();
          bootstrap = await this.api.bootstrap(this.signal()); this.check();
        } else this.cache.quarantine(cached);
      }
      // Recover first: acquire changes current.version and would invalidate pending writes.
      const acquired = await this.sessions.acquire(this.tab.sessionId, takeover);
      if (this.stopped) {
        if (acquired.lease.sessionId) await this.api.release({ sessionId: acquired.lease.sessionId, generation: acquired.lease.generation }, AbortSignal.timeout(10000)).catch(() => {});
        return;
      }
      this.sessions.start(acquired.lease); await this.sessions.ensureValid(); this.check();
      this.saves?.dispose(); this.saveStatus = "idle"; this.saves = this.coordinator(acquired);
      this.bus.pauseReasons.set("bootstrap", false);
      this.bus.pauseReasons.set("hidden", this.document?.visibilityState === "hidden");
      this.syncStatus();
      this.publish({ phase: "ready", cloud: { bootstrap: acquired, sessionId: this.tab.sessionId, api: this.api, saves: this.saves, sessions: this.sessions, bus: this.bus } });
    } catch (error) {
      if (this.stopped) return;
      this.publish({ phase: error instanceof ApiClientError && error.code === "SESSION_CONFLICT" ? "takeover" : "error",
        message: error instanceof ApiClientError ? error.message : "저장 데이터를 불러오지 못했습니다. 연결과 기기 저장 공간을 확인해 주세요." });
    }
  }
  observe = (event: SaveEvent, progress: ProgressState): void => {
    try { this.saves?.observe(event, progress); }
    catch { if (!this.stopped && !["session-lost", "conflict", "storage-error"].includes(this.saveStatus)) { this.saveStatus = "conflict"; this.syncStatus(); } }
  };
  retry = async (): Promise<void> => {
    await this.sessions.ensureValid(); this.check(); await this.saves?.retry(); this.check();
  };
  reset = async (): Promise<void> => {
    this.bus.pauseReasons.set("reset", true);
    await this.sessions.ensureValid(); this.check();
    const bootstrap = await this.saves!.reset(); this.check();
    this.publish({ cloud: { ...this.state.cloud!, bootstrap } }); this.bus.pauseReasons.set("reset", false);
  };
  async logout(): Promise<void> {
    this.bus.pauseReasons.set("bootstrap", true);
    await Promise.resolve(); // Let a final domain-event microtask enter the queue.
    await this.saves?.flush(); this.check(); await this.sessions.release(); this.check();
    this.saves?.dispose(); this.publish({ cloud: null, phase: "closed" });
  }
  dispose(): void {
    if (this.stopped) return;
    this.bus.pauseReasons.set("auth", true); this.stopped = true; this.lifetime.abort();
    this.document?.removeEventListener("visibilitychange", this.visibility);
    this.saves?.dispose(); this.sessions.dispose(); this.listeners.clear();
    // Do not release a lease during account changes/unload: its pending receipt may
    // still need same-owner recovery. It expires naturally or explicit takeover fences it.
    const release = () => this.tab?.release();
    if (this.starting) void this.starting.finally(release); else release();
  }
}
