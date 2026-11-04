import type { BestRecord, Bootstrap, CurrentState, Identity, Lease, Namespace, SaveAck } from "../../src/game/cloud/contracts";
import { integer, iso, normalizeNickname, parseBootstrap, parseSaveAck, record, textField, uuid, validateBest, validateCurrentState, validateLease } from "../../src/game/cloud/validation";
import { ApiError } from "./errors";
export interface DocBase { id: string; playerId: string; schemaVersion: 1; namespace: Namespace; updatedAt: string }
export interface ProfileDoc extends DocBase { kind: "profile"; displayName: string; createdAt: string }
export interface CurrentDoc extends DocBase, CurrentState { kind: "current" }
export interface BestDoc extends DocBase { kind: "best"; displayName: string; eligible: boolean; record: BestRecord | null }
export interface SessionDoc extends DocBase, Lease { kind: "session" }
export interface ReceiptDoc extends DocBase {
  kind: "receipt"; requestHash: string; sessionId: string; generation: number; ack: SaveAck | Bootstrap; ttl: 604800;
}
export type AccountDoc = ProfileDoc | CurrentDoc | BestDoc | SessionDoc | ReceiptDoc;
export interface Versioned<T> { value: T; etag: string }
export interface AccountSnapshot {
  profile: Versioned<ProfileDoc>; current: Versioned<CurrentDoc>; best: Versioned<BestDoc>; session: Versioned<SessionDoc>;
}
export type WriteOperation = { type: "create"; doc: AccountDoc } | { type: "replace"; doc: AccountDoc; etag: string };
export const ACCOUNT_IDS = ["profile", "current", "best", "session"] as const;
const metaKeys = ["id", "playerId", "schemaVersion", "namespace", "updatedAt", "kind"];
export function docBase(id: Identity, documentId: string, now: string): DocBase {
  return { id: documentId, playerId: id.playerId, namespace: id.namespace, schemaVersion: 1, updatedAt: now };
}
export function parseDocument(value: unknown, playerId?: string): AccountDoc {
  try {
    const raw = record(value, "document");
    const r = Object.fromEntries(Object.entries(raw).filter(([key]) => !["_etag", "_rid", "_self", "_attachments", "_ts"].includes(key)));
    if (r.schemaVersion !== 1 || typeof r.playerId !== "string" || playerId && r.playerId !== playerId ||
        !["prod", "test"].includes(String(r.namespace)) || !r.playerId.startsWith(r.namespace + ":")) throw new Error();
    const parts = r.playerId.split(":");
    if (parts.length !== 3 || uuid(parts[1], "tenant") !== parts[1] || uuid(parts[2], "owner") !== parts[2]) throw new Error();
    iso(r.updatedAt, "updatedAt"); textField(r.id, "id");
    const data = Object.fromEntries(Object.entries(r).filter(([key]) => !metaKeys.includes(key)));
    const base = { id: r.id, playerId: r.playerId, schemaVersion: 1, namespace: r.namespace, updatedAt: r.updatedAt } as DocBase;
    switch (r.kind) {
      case "profile": {
        if (r.id !== "profile") throw new Error();
        record(data, "profile", ["displayName", "createdAt"]);
        const name = textField(data.displayName, "displayName", 20);
        if (normalizeNickname(name) !== name) throw new Error();
        return { ...base, kind: "profile", displayName: name, createdAt: iso(data.createdAt, "createdAt") };
      }
      case "current":
        if (r.id !== "current") throw new Error();
        return { ...base, kind: "current", ...validateCurrentState(data) };
      case "best": {
        if (r.id !== "best") throw new Error();
        record(data, "best", ["displayName", "eligible", "record"]);
        const best = validateBest(data.record);
        if (data.eligible !== (base.namespace === "prod" && best !== null)) throw new Error();
        return { ...base, kind: "best", displayName: textField(data.displayName, "displayName", 20), eligible: data.eligible as boolean, record: best };
      }
      case "session":
        if (r.id !== "session") throw new Error();
        return { ...base, kind: "session", ...validateLease(data) };
      case "receipt": {
        record(data, "receipt", ["requestHash", "sessionId", "generation", "ack", "ttl"]);
        if (!base.id.startsWith("receipt:") || !/^[0-9a-f]{64}$/.test(String(data.requestHash)) || data.ttl !== 604800) throw new Error();
        uuid(base.id.slice(8), "receipt.requestId");
        const ack = record(data.ack, "receipt.ack");
        return { ...base, kind: "receipt", requestHash: String(data.requestHash), sessionId: uuid(data.sessionId, "sessionId"),
          generation: integer(data.generation, "generation"), ttl: 604800,
          ack: "schemaVersion" in ack ? parseBootstrap(ack) : parseSaveAck(ack) };
      }
      default: throw new Error();
    }
  } catch { throw new ApiError(503, "UNSUPPORTED_SAVE", "저장 데이터 확인이 필요합니다."); }
}
export function accountFromDocuments(values: Versioned<AccountDoc>[]): AccountSnapshot {
  const get = <K extends typeof ACCOUNT_IDS[number]>(kind: K): Versioned<Extract<AccountDoc, { kind: K }>> => {
    const found = values.find(v => v.value.kind === kind);
    if (!found || !found.etag) throw new ApiError(503, "UNSUPPORTED_SAVE", "저장 데이터 확인이 필요합니다.");
    return found as Versioned<Extract<AccountDoc, { kind: K }>>;
  };
  const account = { profile: get("profile"), current: get("current"), best: get("best"), session: get("session") };
  if (account.profile.value.displayName !== account.current.value.progress.playerName ||
      account.profile.value.displayName !== account.best.value.displayName) {
    throw new ApiError(503, "UNSUPPORTED_SAVE", "저장 데이터 확인이 필요합니다.");
  }
  return account;
}
export function toBootstrap(account: AccountSnapshot, now: string): Bootstrap {
  const c = account.current.value, s = account.session.value;
  return parseBootstrap({
    schemaVersion: 1, playerId: c.playerId, displayName: account.profile.value.displayName,
    current: { runId: c.runId, version: c.version, lastSequence: c.lastSequence, activeStageId: c.activeStageId,
      pendingCheckpointId: c.pendingCheckpointId, progress: c.progress, resume: c.resume },
    best: account.best.value.record, lease: { sessionId: s.sessionId, generation: s.generation, expiresAt: s.expiresAt }, serverTime: now,
  });
}

