import type { AcquireRequest, ApiErrorCode, Bootstrap, LeaderboardResponse, Lease, LeaseRequest, ResetRequest, SaveAck, SaveRequest } from "../../cloud/contracts";
import { parseBootstrap, parseLeaderboardResponse, parseSaveAck, validateLease } from "../../cloud/validation";
export class ApiClientError extends Error {
  constructor(readonly status: number, readonly code: ApiErrorCode, message: string, readonly retryAfterMs: number | null = null) { super(message); }
}
const codes: readonly ApiErrorCode[] = ["INVALID_REQUEST", "UNAUTHENTICATED", "FORBIDDEN", "SESSION_CONFLICT", "SESSION_LOST", "VERSION_CONFLICT",
  "RUN_CONFLICT", "SEQUENCE_CONFLICT", "REQUEST_REUSED", "THROTTLED", "UNAVAILABLE", "UNSUPPORTED_SAVE"];
function aborted(signal?: AbortSignal): void { signal?.throwIfAborted(); }
export class GameApiClient {
  constructor(private readonly getToken: (forceRefresh?: boolean) => Promise<string>, private readonly fetchImpl: typeof fetch = fetch,
    private readonly onUnauthorized: () => void = () => {}) {}
  private async request<T>(path: string, input: unknown | undefined, parse: (value: unknown) => T, signal?: AbortSignal): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt++) {
      aborted(signal);
      const token = await this.getToken(attempt === 1);
      aborted(signal);
      let response: Response;
      try {
        // Browser fetch requires the global receiver; calling it as a client
        // method throws before dispatch even though Node's fetch accepts it.
        response = await this.fetchImpl.call(globalThis, "/api/game/" + path, {
          method: input === undefined ? "GET" : "POST", cache: "no-store", credentials: "same-origin", signal,
          headers: { Authorization: "Bearer " + token, ...(input === undefined ? {} : { "Content-Type": "application/json" }) },
          ...(input === undefined ? {} : { body: JSON.stringify(input) }),
        });
      } catch (error) {
        aborted(signal);
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        throw new ApiClientError(503, "UNAVAILABLE", "서버에 연결하지 못했습니다.", 1000);
      }
      aborted(signal);
      if (response.status === 401 && attempt === 0) { await response.body?.cancel(); continue; }
      let value: unknown;
      try { value = response.status === 204 ? null : await response.json(); }
      catch {
        if (response.ok) throw new ApiClientError(503, "UNSUPPORTED_SAVE", "서버 응답을 확인할 수 없습니다.");
        value = null;
      }
      aborted(signal);
      if (!response.ok) {
        if (response.status === 401) this.onUnauthorized();
        const error = (value as { error?: { code?: ApiErrorCode; message?: string; retryAfterMs?: number | null } } | null)?.error;
        const code = error?.code && codes.includes(error.code) ? error.code :
          response.status === 401 ? "UNAUTHENTICATED" : response.status === 403 ? "FORBIDDEN" : response.status === 429 ? "THROTTLED" : "UNAVAILABLE";
        const header = Number(response.headers.get("Retry-After"));
        const retryAfter = typeof error?.retryAfterMs === "number" && Number.isFinite(error.retryAfterMs) && error.retryAfterMs >= 0 ? error.retryAfterMs :
          response.headers.has("Retry-After") && Number.isFinite(header) && header >= 0 ? header * 1000 : null;
        throw new ApiClientError(response.status, code, response.status === 403 ? "이 게임에 접근할 권한이 없습니다." :
          typeof error?.message === "string" ? error.message : "서버 요청을 완료하지 못했습니다.", retryAfter);
      }
      try { return parse(value); }
      catch { throw new ApiClientError(503, "UNSUPPORTED_SAVE", "저장 데이터 형식을 확인해 주세요."); }
    }
    throw new ApiClientError(401, "UNAUTHENTICATED", "다시 로그인해 주세요.");
  }
  bootstrap(signal?: AbortSignal): Promise<Bootstrap> { return this.request("bootstrap", undefined, parseBootstrap, signal); }
  acquire(input: AcquireRequest, signal?: AbortSignal): Promise<Bootstrap> { return this.request("session/acquire", input, parseBootstrap, signal); }
  heartbeat(input: LeaseRequest, signal?: AbortSignal): Promise<Lease> { return this.request("session/heartbeat", input, validateLease, signal); }
  release(input: LeaseRequest, signal?: AbortSignal): Promise<void> { return this.request("session/release", input, value => { if (value !== null) throw new Error(); }, signal); }
  save(input: SaveRequest, signal?: AbortSignal): Promise<SaveAck> { return this.request("save", input, parseSaveAck, signal); }
  reset(input: ResetRequest, signal?: AbortSignal): Promise<SaveAck> { return this.request("reset", input, parseSaveAck, signal); }
  leaderboard(signal?: AbortSignal): Promise<LeaderboardResponse> { return this.request("leaderboard", undefined, parseLeaderboardResponse, signal); }
}
