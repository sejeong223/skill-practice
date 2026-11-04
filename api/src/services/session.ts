import type { AcquireRequest, Bootstrap, Identity, Lease, LeaseRequest } from "../../../src/game/cloud/contracts";
import { parseAcquireRequest, parseLeaseRequest } from "../../../src/game/cloud/validation";
import { docBase, toBootstrap, type ReceiptDoc, type SessionDoc } from "../documents";
import { ApiError, RepositoryConflict } from "../errors";
import type { GameRepository } from "../repository";
import { hashRequest } from "../requestHash";
import { requireAccount } from "./account";
export const LEASE_MS = 60000;
export function assertOwner(session: SessionDoc, input: LeaseRequest, now: Date, allowExpired = false): void {
  if (session.sessionId !== input.sessionId || session.generation !== input.generation ||
      !allowExpired && Date.parse(session.expiresAt) <= now.getTime()) {
    throw new ApiError(409, "SESSION_LOST", "다른 화면으로 플레이가 전환되었거나 연결 확인이 필요합니다.");
  }
}
export async function acquireSession(identity: Identity, value: AcquireRequest, repo: GameRepository, now: () => Date): Promise<Bootstrap> {
  const input = parseAcquireRequest(value), hash = hashRequest(identity, input);
  for (let attempt = 0; attempt < 3; attempt++) {
    const a = await requireAccount(identity, repo), receipt = await repo.readReceipt(identity.playerId, input.requestId);
    const time = now(), stamp = time.toISOString(), old = a.session.value;
    if (receipt) {
      if (receipt.requestHash !== hash) throw new ApiError(409, "REQUEST_REUSED", "이미 사용된 요청입니다.");
      assertOwner(old, { sessionId: receipt.sessionId, generation: receipt.generation }, time, true);
      return toBootstrap(a, stamp);
    }
    if (old.sessionId && old.sessionId !== input.sessionId && Date.parse(old.expiresAt) > time.getTime() && !input.takeover) {
      throw new ApiError(409, "SESSION_CONFLICT", "다른 화면에서 플레이 중입니다.");
    }
    const session: SessionDoc = { ...old, sessionId: input.sessionId, generation: old.generation + (old.sessionId === input.sessionId ? 0 : 1),
      expiresAt: new Date(time.getTime() + LEASE_MS).toISOString(), updatedAt: stamp };
    const current = { ...a.current.value, activeStageId: a.current.value.resume.stageId, pendingCheckpointId: null,
      version: a.current.value.version + 1, updatedAt: stamp };
    const response = toBootstrap({ ...a, current: { ...a.current, value: current }, session: { ...a.session, value: session } }, stamp);
    const saved: ReceiptDoc = { ...docBase(identity, "receipt:" + input.requestId, stamp), kind: "receipt",
      requestHash: hash, sessionId: input.sessionId, generation: session.generation, ack: response, ttl: 604800 };
    try {
      await repo.commit(identity.playerId, [
        { type: "replace", doc: current, etag: a.current.etag }, { type: "replace", doc: session, etag: a.session.etag }, { type: "create", doc: saved },
      ]);
      return response;
    } catch (error) { if (!(error instanceof RepositoryConflict)) throw error; }
  }
  throw new ApiError(409, "VERSION_CONFLICT", "동시에 다른 요청이 처리되었습니다. 다시 확인해 주세요.");
}
async function changeLease(identity: Identity, value: LeaseRequest, repo: GameRepository, now: () => Date, release: boolean): Promise<Lease> {
  const input = parseLeaseRequest(value);
  for (let attempt = 0; attempt < 3; attempt++) {
    const a = await requireAccount(identity, repo), time = now();
    assertOwner(a.session.value, input, time, true);
    const session: SessionDoc = { ...a.session.value, sessionId: release ? null : input.sessionId, updatedAt: time.toISOString(),
      expiresAt: new Date(time.getTime() + (release ? 0 : LEASE_MS)).toISOString() };
    try {
      await repo.commit(identity.playerId, [{ type: "replace", doc: session, etag: a.session.etag }]);
      return { sessionId: session.sessionId, generation: session.generation, expiresAt: session.expiresAt };
    } catch (error) { if (!(error instanceof RepositoryConflict)) throw error; }
  }
  throw new ApiError(409, "VERSION_CONFLICT", "연결 상태를 다시 확인해 주세요.");
}
export async function heartbeatSession(id: Identity, input: LeaseRequest, repo: GameRepository, now: () => Date): Promise<Lease> {
  return changeLease(id, input, repo, now, false);
}
export async function releaseSession(id: Identity, input: LeaseRequest, repo: GameRepository, now: () => Date): Promise<void> {
  await changeLease(id, input, repo, now, true);
}

