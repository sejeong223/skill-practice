import type { Bootstrap, Lease, ResetRequest, SaveAck, SaveEvent, SaveRequest } from "../../cloud/contracts";
import type { ProgressState } from "../../core/types";
import { parseBootstrap, parseSaveEvent, validateProgress } from "../../cloud/validation";
import { AccountCache, type CacheEnvelope, type Observation } from "./AccountCache";
import { ApiClientError, GameApiClient } from "./GameApiClient";
export type SaveStatus = "idle" | "saving" | "reconnecting" | "reauth-required" | "session-lost" | "conflict" | "storage-error";
export interface CoordinatorOptions {
  api: GameApiClient; cache: AccountCache; bootstrap: Bootstrap; sessionId: string;
  onStatus: (status: SaveStatus) => void; onAck: (ack: SaveAck) => void; now: () => number;
  ensureValid?: () => Promise<Lease>; random?: () => number;
}
const abort = () => new DOMException("저장 연결이 종료되었습니다.", "AbortError");
function immutable<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(immutable); Object.freeze(value); }
  return value;
}
export class CloudSaveCoordinator {
  private envelope: CacheEnvelope;
  private status: SaveStatus = "idle";
  private storageFailed = false;
  private disposed = false;
  private resetting = false;
  private running?: Promise<void>;
  private retrying?: Promise<void>;
  private resettingPromise?: Promise<Bootstrap>;
  private timer?: ReturnType<typeof setTimeout>;
  private backoffTimer?: ReturnType<typeof setTimeout>;
  private failures = 0;
  private retryAt = 0;
  private needsLeaseCheck = false;
  private lifetime = new AbortController();
  private beforeUnload = () => { this.persist(); };
  constructor(private readonly options: CoordinatorOptions) {
    const b = parseBootstrap(options.bootstrap);
    if (b.lease.sessionId !== options.sessionId) throw new ApiClientError(409, "SESSION_LOST", "플레이 연결이 다릅니다.");
    this.envelope = { schemaVersion: 1, playerId: b.playerId, sessionId: options.sessionId, generation: b.lease.generation,
      runId: b.current.runId, confirmed: b, inFlight: null, queued: [], pendingReset: null, savedAt: new Date(options.now()).toISOString() };
    try {
      const saved = options.cache.read(b.playerId, options.sessionId);
      if (saved && saved.generation === b.lease.generation && (saved.runId === b.current.runId || saved.pendingReset) &&
          (saved.inFlight || saved.pendingReset || saved.confirmed.current.version === b.current.version)) {
        this.envelope = saved;
        this.needsLeaseCheck = Boolean(saved.inFlight || saved.queued.length || saved.pendingReset);
        this.resetting = saved.pendingReset !== null;
        if (saved.inFlight) immutable(saved.inFlight);
        if (saved.pendingReset) immutable(saved.pendingReset);
        if (this.needsLeaseCheck) this.setStatus("reconnecting");
      } else if (saved && (saved.inFlight || saved.queued.length || saved.pendingReset)) options.cache.quarantine(saved);
    } catch { this.storageFailed = true; this.setStatus("storage-error"); }
    if (typeof window !== "undefined") window.addEventListener("beforeunload", this.beforeUnload);
  }
  getStatus(): SaveStatus { return this.status; }
  getBootstrap(): Bootstrap { return structuredClone(this.envelope.confirmed); }
  hasPending(): boolean { return Boolean(this.envelope.inFlight || this.envelope.queued.length || this.envelope.pendingReset); }
  private setStatus(status: SaveStatus): void { if (!this.disposed) { this.status = status; this.options.onStatus(status); } }
  private persist(): void {
    if (this.disposed) return;
    this.envelope.savedAt = new Date(this.options.now()).toISOString();
    try { this.options.cache.write(this.envelope); this.storageFailed = false; }
    catch { this.storageFailed = true; this.setStatus("storage-error"); }
  }
  observe(event: SaveEvent, progress: ProgressState): void {
    if (this.disposed) throw abort();
    if (this.resetting || this.status === "session-lost" || this.status === "conflict") throw new ApiClientError(409, "SESSION_LOST", "게임 저장을 다시 확인해 주세요.");
    const observation: Observation = { requestId: crypto.randomUUID(), event: parseSaveEvent(event), progress: validateProgress(progress) };
    const tail = this.envelope.queued.at(-1);
    if (tail?.event.kind === "state" && observation.event.kind === "state" && tail.event.stageId === observation.event.stageId) this.envelope.queued[this.envelope.queued.length - 1] = observation;
    else {
      if (this.envelope.queued.length + Number(Boolean(this.envelope.inFlight)) >= 128) {
        this.setStatus("storage-error"); throw new Error("대기 중인 저장이 많습니다. 저장 완료를 기다려 주세요.");
      }
      this.envelope.queued.push(observation);
    }
    this.persist();
    clearTimeout(this.timer);
    if (["reconnecting", "reauth-required", "session-lost", "conflict"].includes(this.status)) return;
    if (this.envelope.queued.length >= 127) this.setStatus("storage-error");
    this.timer = setTimeout(() => { void this.flush().catch(() => {}); }, event.kind === "state" ? 100 : 0);
  }
  private async verifyLease(): Promise<void> {
    const e = this.envelope;
    const lease = await (this.options.ensureValid?.() ?? this.options.api.heartbeat({ sessionId: e.sessionId, generation: e.generation }, this.signal()));
    this.lifetime.signal.throwIfAborted();
    if (lease.sessionId !== e.sessionId || lease.generation !== e.generation) throw new ApiClientError(409, "SESSION_LOST", "다른 화면으로 플레이가 전환되었습니다.");
    e.confirmed.lease = lease;
    this.needsLeaseCheck = false;
  }
  private signal(): AbortSignal { return AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(10000)]); }
  flush = (): Promise<void> => {
    clearTimeout(this.timer);
    if (this.disposed) return Promise.reject(abort());
    if (this.running) return this.running;
    if (["session-lost", "conflict", "reauth-required"].includes(this.status)) return Promise.reject(new ApiClientError(409, "SESSION_LOST", "저장 연결을 다시 확인해 주세요."));
    if (this.retryAt > this.options.now()) return Promise.reject(new ApiClientError(429, "THROTTLED", "잠시 후 저장을 다시 시도합니다.", this.retryAt - this.options.now()));
    this.running = this.drain().finally(() => { this.running = undefined; });
    return this.running;
  };
  private async drain(): Promise<void> {
    if (!this.storageFailed && (this.status === "idle" || this.status === "saving")) this.setStatus("saving");
    try {
      if (this.needsLeaseCheck) await this.verifyLease();
      while (this.hasPending()) {
        const e = this.envelope;
        if (!e.pendingReset && !e.inFlight) {
          const observation = e.queued.shift()!;
          e.inFlight = immutable({ schemaVersion: 1, ...observation, sessionId: e.sessionId, generation: e.generation, runId: e.runId,
            expectedVersion: e.confirmed.current.version, sequence: e.confirmed.current.lastSequence + 1 });
        }
        this.persist();
        const input = e.pendingReset ?? e.inFlight!, isReset = e.pendingReset !== null;
        const ack = isReset ? await this.options.api.reset(input as ResetRequest, this.signal()) : await this.options.api.save(input as SaveRequest, this.signal());
        this.lifetime.signal.throwIfAborted();
        if (ack.requestId !== input.requestId || ack.version !== input.expectedVersion + 1 ||
            (isReset ? ack.sequence !== 0 || ack.runId === input.runId : ack.sequence !== input.sequence || ack.runId !== input.runId)) {
          throw new ApiClientError(503, "UNSUPPORTED_SAVE", "저장 확인 응답이 요청과 다릅니다.");
        }
        // SaveAck deliberately contains no resume/progress. Fetch the committed server
        // snapshot before claiming a complete confirmed cache; never invent resume state.
        const confirmed = await this.options.api.bootstrap(this.signal());
        this.lifetime.signal.throwIfAborted();
        if (confirmed.playerId !== e.playerId || confirmed.lease.sessionId !== e.sessionId || confirmed.lease.generation !== e.generation) throw new ApiClientError(409, "SESSION_LOST", "다른 화면으로 플레이가 전환되었습니다.");
        if (confirmed.current.runId !== ack.runId || confirmed.current.version !== ack.version || confirmed.current.lastSequence !== ack.sequence) throw new ApiClientError(409, "VERSION_CONFLICT", "서버 진행이 변경되었습니다.");
        e.confirmed = confirmed; e.runId = confirmed.current.runId; e.inFlight = null; e.pendingReset = null;
        if (isReset) this.resetting = false;
        this.persist(); this.options.onAck(ack);
      }
      this.persist(); this.failures = 0; this.retryAt = 0;
      clearTimeout(this.backoffTimer);
      this.setStatus(this.storageFailed ? "storage-error" : "idle");
    } catch (error) {
      if (!this.disposed) this.failed(error);
      throw error;
    }
  }
  private failed(error: unknown): void {
    if (error instanceof ApiClientError) {
      if (error.status === 401) { this.setStatus("reauth-required"); return; }
      if (error.code === "SESSION_LOST" || error.code === "SESSION_CONFLICT") { this.setStatus("session-lost"); return; }
      if ([400, 403, 409].includes(error.status) || error.code === "UNSUPPORTED_SAVE") { this.setStatus("conflict"); return; }
    }
    if (error instanceof Error && (error.name === "InteractionRequiredAuthError" || error.message === "로그인이 필요합니다.")) { this.setStatus("reauth-required"); return; }
    this.needsLeaseCheck = true; this.setStatus("reconnecting");
    const delay = Math.max([1000, 2000, 4000, 8000, 15000][Math.min(this.failures++, 4)] + Math.floor((this.options.random?.() ?? Math.random()) * 251),
      error instanceof ApiClientError ? error.retryAfterMs ?? 0 : 0);
    this.retryAt = this.options.now() + delay;
    clearTimeout(this.backoffTimer);
    this.backoffTimer = setTimeout(() => { void this.retry().catch(() => {}); }, delay);
  }
  retry = (): Promise<void> => {
    if (this.retrying) return this.retrying;
    if (this.disposed) return Promise.reject(abort());
    if (this.status === "session-lost" || this.status === "conflict") return Promise.reject(new ApiClientError(409, "SESSION_LOST", "서버 저장을 다시 불러와 주세요."));
    if (this.options.now() < this.retryAt) return Promise.reject(new ApiClientError(429, "THROTTLED", "잠시 후 저장을 다시 시도합니다.", this.retryAt - this.options.now()));
    this.needsLeaseCheck = true;
    if (this.status === "reauth-required") this.setStatus("reconnecting");
    this.retrying = this.flush().finally(() => { this.retrying = undefined; });
    return this.retrying;
  };
  reset(): Promise<Bootstrap> {
    return this.resettingPromise ??= this.performReset().finally(() => { this.resettingPromise = undefined; });
  }
  private async performReset(): Promise<Bootstrap> {
    if (this.disposed) throw abort();
    if (this.envelope.pendingReset) { await this.flush(); return this.getBootstrap(); }
    this.resetting = true;
    try { await this.flush(); }
    catch (error) { this.resetting = false; throw error; }
    const e = this.envelope;
    if (!e.pendingReset) e.pendingReset = immutable({ schemaVersion: 1, requestId: crypto.randomUUID(), sessionId: e.sessionId, generation: e.generation,
      runId: e.runId, expectedVersion: e.confirmed.current.version, sequence: e.confirmed.current.lastSequence + 1 });
    this.persist(); await this.flush();
    return this.getBootstrap();
  }
  dispose(): void {
    this.persist(); this.disposed = true;
    clearTimeout(this.timer); clearTimeout(this.backoffTimer); this.lifetime.abort();
    if (typeof window !== "undefined") window.removeEventListener("beforeunload", this.beforeUnload);
  }
}
