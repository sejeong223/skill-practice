import type { Identity, ResetRequest, SaveAck, SaveRequest } from "../../../src/game/cloud/contracts";
import { isBetterRecord, milestoneFor } from "../../../src/game/cloud/progression";
import { parseResetRequest, parseSaveRequest } from "../../../src/game/cloud/validation";
import { docBase, type CurrentDoc, type ReceiptDoc } from "../documents";
import { ApiError, RepositoryConflict } from "../errors";
import type { GameRepository } from "../repository";
import { hashRequest } from "../requestHash";
import { initialCurrent, requireAccount } from "./account";
import { assertOwner, LEASE_MS } from "./session";
import { applySaveEvent } from "./transitions";

async function mutate(id: Identity, input: SaveRequest | ResetRequest, repo: GameRepository, now: () => Date): Promise<SaveAck> {
  const hash = hashRequest(id, input);
  for (let attempt = 0; attempt < 3; attempt++) {
    const a = await requireAccount(id, repo), time = now(), stamp = time.toISOString();
    assertOwner(a.session.value, input, time);
    const receipt = await repo.readReceipt(id.playerId, input.requestId);
    if (receipt) {
      if (receipt.requestHash !== hash || "schemaVersion" in receipt.ack) throw new ApiError(409, "REQUEST_REUSED", "이미 사용된 요청입니다.");
      return receipt.ack;
    }
    const old = a.current.value;
    if (old.runId !== input.runId) throw new ApiError(409, "RUN_CONFLICT", "새 게임 회차를 불러와 주세요.");
    if (old.version !== input.expectedVersion) throw new ApiError(409, "VERSION_CONFLICT", "저장 버전이 변경되었습니다.");
    if (input.sequence !== old.lastSequence + 1) throw new ApiError(409, "SEQUENCE_CONFLICT", "저장 순서를 확인해 주세요.");
    let current: CurrentDoc;
    let bestRecord = a.best.value.record;
    if ("event" in input) {
      current = { ...applySaveEvent(old, input.event, input.progress) as CurrentDoc, version: old.version + 1,
        lastSequence: input.sequence, updatedAt: stamp };
      const milestone = milestoneFor(input.event);
      if (milestone) {
        const candidate = { milestoneId: milestone.id, progressRank: milestone.rank, deaths: current.progress.deathsTotal, runId: old.runId };
        if (isBetterRecord(candidate, bestRecord)) bestRecord = candidate;
      }
    } else current = initialCurrent(id, stamp, old.version + 1, a.profile.value.displayName);
    const name = current.progress.playerName;
    const profile = { ...a.profile.value, displayName: name, updatedAt: stamp };
    const best = { ...a.best.value, record: bestRecord, displayName: name, eligible: id.namespace === "prod" && bestRecord !== null, updatedAt: stamp };
    const session = { ...a.session.value, expiresAt: new Date(time.getTime() + LEASE_MS).toISOString(), updatedAt: stamp };
    const ack: SaveAck = { requestId: input.requestId, runId: current.runId, version: current.version,
      sequence: current.lastSequence, best: bestRecord, committedAt: stamp };
    const saved: ReceiptDoc = { ...docBase(id, "receipt:" + input.requestId, stamp), kind: "receipt",
      requestHash: hash, sessionId: input.sessionId, generation: input.generation, ack, ttl: 604800 };
    try {
      await repo.commit(id.playerId, [
        { type: "replace", doc: current, etag: a.current.etag }, { type: "replace", doc: profile, etag: a.profile.etag },
        { type: "replace", doc: best, etag: a.best.etag }, { type: "replace", doc: session, etag: a.session.etag },
        { type: "create", doc: saved },
      ]);
      return ack;
    } catch (error) { if (!(error instanceof RepositoryConflict)) throw error; }
  }
  throw new ApiError(409, "VERSION_CONFLICT", "동시에 다른 요청이 처리되었습니다. 다시 확인해 주세요.");
}
export async function saveProgress(id: Identity, input: SaveRequest, repo: GameRepository, now: () => Date): Promise<SaveAck> {
  return mutate(id, parseSaveRequest(input), repo, now);
}
export async function resetProgress(id: Identity, input: ResetRequest, repo: GameRepository, now: () => Date): Promise<SaveAck> {
  return mutate(id, parseResetRequest(input), repo, now);
}
