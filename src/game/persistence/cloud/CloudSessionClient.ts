import type { ApiErrorCode, Bootstrap, Lease } from "../../cloud/contracts";
import { ApiClientError, GameApiClient } from "./GameApiClient";
export class CloudSessionClient {
  private lease: Lease | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: Promise<Lease>;
  private acquisition?: { sessionId: string; takeover: boolean; requestId: string };
  private lifetime = new AbortController();
  private disposed = false;
  private visibility = () => {
    if (this.document?.visibilityState === "visible") {
      this.onLost("UNAVAILABLE");
      void this.ensureValid().catch(() => {});
    }
  };
  constructor(private readonly api: GameApiClient, private readonly onLost: (code: ApiErrorCode) => void,
    private readonly onValid: (lease: Lease) => void = () => {},
    private readonly document: Pick<Document, "addEventListener" | "removeEventListener" | "visibilityState"> | null = typeof globalThis.document === "undefined" ? null : globalThis.document) {}
  async acquire(sessionId: string, takeover: boolean): Promise<Bootstrap> {
    if (this.disposed) throw new DOMException("연결이 종료되었습니다.", "AbortError");
    if (!this.acquisition || this.acquisition.sessionId !== sessionId || this.acquisition.takeover !== takeover) this.acquisition = { sessionId, takeover, requestId: crypto.randomUUID() };
    const response = await this.api.acquire(this.acquisition, AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(10000)]));
    this.lifetime.signal.throwIfAborted();
    this.acquisition = undefined;
    return response;
  }
  start(lease: Lease): void {
    if (this.disposed || !lease.sessionId) return;
    this.lease = structuredClone(lease);
    this.document?.removeEventListener("visibilitychange", this.visibility);
    this.document?.addEventListener("visibilitychange", this.visibility);
    this.schedule();
  }
  private schedule(): void {
    clearTimeout(this.timer);
    if (!this.disposed && this.lease?.sessionId) this.timer = setTimeout(() => { void this.ensureValid().catch(() => {}).finally(() => this.schedule()); }, 15000);
  }
  ensureValid = (): Promise<Lease> => {
    if (this.pending) return this.pending;
    if (this.disposed || !this.lease?.sessionId) return Promise.reject(new ApiClientError(409, "SESSION_LOST", "플레이 연결을 확인해 주세요."));
    const input = { sessionId: this.lease.sessionId, generation: this.lease.generation };
    this.pending = (async () => {
      try {
        const lease = await this.api.heartbeat(input, AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(10000)]));
        this.lifetime.signal.throwIfAborted();
        if (lease.sessionId !== input.sessionId || lease.generation !== input.generation) throw new ApiClientError(409, "SESSION_LOST", "플레이 연결이 변경되었습니다.");
        this.lease = lease; this.onValid(lease); return lease;
      } catch (error) {
        if (!this.disposed) {
          const code = error instanceof ApiClientError ? error.code : "UNAVAILABLE";
          this.onLost(code);
          if (code === "SESSION_LOST") { this.lease = null; clearTimeout(this.timer); }
        }
        throw error;
      } finally { this.pending = undefined; }
    })();
    return this.pending;
  };
  async release(): Promise<void> {
    const lease = this.lease; this.dispose();
    if (lease?.sessionId) await this.api.release({ sessionId: lease.sessionId, generation: lease.generation }, AbortSignal.timeout(10000));
  }
  dispose(): void {
    this.disposed = true; clearTimeout(this.timer); this.lifetime.abort();
    this.document?.removeEventListener("visibilitychange", this.visibility);
  }
}
