import type { Bootstrap, ResetRequest, SaveEvent, SaveRequest } from "../../cloud/contracts";
import type { ProgressState } from "../../core/types";
import { integer, iso, parseBootstrap, parseResetRequest, parseSaveEvent, parseSaveRequest, record, uuid, validateProgress } from "../../cloud/validation";
export interface Observation { requestId: string; event: SaveEvent; progress: ProgressState }
export interface CacheEnvelope {
  schemaVersion: 1; playerId: string; sessionId: string; generation: number; runId: string;
  confirmed: Bootstrap; inFlight: SaveRequest | null; queued: Observation[]; pendingReset: ResetRequest | null; savedAt: string;
}
export const MAX_CACHE_BYTES = 4 * 1024 * 1024;
const prefix = "legendary-rib-corgi:cloud:v1:";
export const accountCacheKey = (playerId: string, sessionId: string) => prefix + playerId + ":session:" + sessionId;
export function validateEnvelope(value: unknown): CacheEnvelope {
  const r = record(value, "cache", ["schemaVersion", "playerId", "sessionId", "generation", "runId", "confirmed", "inFlight", "queued", "pendingReset", "savedAt"]);
  const confirmed = parseBootstrap(r.confirmed), sessionId = uuid(r.sessionId, "sessionId"), generation = integer(r.generation, "generation"), runId = uuid(r.runId, "runId");
  if (r.schemaVersion !== 1 || r.playerId !== confirmed.playerId || confirmed.lease.sessionId !== sessionId || confirmed.lease.generation !== generation || confirmed.current.runId !== runId ||
      !Array.isArray(r.queued) || r.queued.length > 128) throw new Error("손상된 계정 캐시입니다.");
  const inFlight = r.inFlight === null ? null : parseSaveRequest(r.inFlight), pendingReset = r.pendingReset === null ? null : parseResetRequest(r.pendingReset);
  for (const input of [inFlight, pendingReset]) if (input && (input.sessionId !== sessionId || input.generation !== generation || input.runId !== runId)) throw new Error("캐시 소유자가 다릅니다.");
  if (pendingReset && (inFlight || r.queued.length)) throw new Error("초기화와 저장 요청이 섞였습니다.");
  const queued = r.queued.map(value => {
    const o = record(value, "observation", ["requestId", "event", "progress"]);
    return { requestId: uuid(o.requestId, "requestId"), event: parseSaveEvent(o.event), progress: validateProgress(o.progress) };
  });
  if (new Set([...queued.map(o => o.requestId), ...(inFlight ? [inFlight.requestId] : [])]).size !== queued.length + (inFlight ? 1 : 0)) throw new Error("중복된 대기 요청입니다.");
  return { schemaVersion: 1, playerId: confirmed.playerId, sessionId, generation, runId, confirmed, inFlight, pendingReset, queued, savedAt: iso(r.savedAt, "savedAt") };
}
export class AccountCache {
  constructor(private readonly storage: Storage | null) {}
  read(playerId: string, sessionId: string): CacheEnvelope | null {
    if (!this.storage) throw new Error("기기 저장소를 사용할 수 없습니다.");
    const text = this.storage.getItem(accountCacheKey(playerId, sessionId));
    if (!text) return null;
    try {
      if (new TextEncoder().encode(text).length > MAX_CACHE_BYTES) return null;
      const envelope = validateEnvelope(JSON.parse(text));
      return envelope.playerId === playerId && envelope.sessionId === sessionId ? envelope : null;
    } catch { return null; }
  }
  write(value: CacheEnvelope): void {
    const valid = validateEnvelope(value), text = JSON.stringify(valid);
    if (!this.storage || new TextEncoder().encode(text).length > MAX_CACHE_BYTES) throw new Error("기기 저장 공간을 확인해 주세요.");
    this.storage.setItem(accountCacheKey(valid.playerId, valid.sessionId), text);
    // Display-only cache: never use this as permission to start or upload a game.
    this.storage.setItem(prefix + valid.playerId + ":confirmed", JSON.stringify(valid.confirmed));
  }
  removePending(playerId: string, sessionId: string): void {
    const envelope = this.read(playerId, sessionId);
    if (envelope) this.write({ ...envelope, inFlight: null, pendingReset: null, queued: [] });
  }
  quarantine(value: CacheEnvelope): void {
    if (!this.storage) throw new Error("기기 저장소를 사용할 수 없습니다.");
    const key = accountCacheKey(value.playerId, value.sessionId);
    this.storage.setItem(key + ":quarantine:" + value.generation + ":" + value.runId, JSON.stringify(validateEnvelope(value)));
    this.storage.removeItem(key);
  }
}
