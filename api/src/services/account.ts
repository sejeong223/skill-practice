import { randomUUID } from "node:crypto";
import { createDefaultProgressState } from "../../../src/game/core/constants";
import type { Bootstrap, Identity } from "../../../src/game/cloud/contracts";
import { accountFromDocuments, docBase, toBootstrap, type AccountDoc, type AccountSnapshot, type CurrentDoc } from "../documents";
import { ApiError, RepositoryConflict } from "../errors";
import type { GameRepository } from "../repository";
export function initialCurrent(identity: Identity, now: string, version = 0, name = "코기"): CurrentDoc {
  return { ...docBase(identity, "current", now), kind: "current", runId: randomUUID(), version, lastSequence: 0,
    activeStageId: "world-01-stage-1", pendingCheckpointId: null, progress: createDefaultProgressState(name),
    resume: { worldId: "world-01", stageId: "world-01-stage-1", checkpoint: null, worldSeed: 1, world02Travel: {}, completed: false } };
}
export async function requireAccount(identity: Identity, repo: GameRepository): Promise<AccountSnapshot> {
  const account = await repo.readAccount(identity);
  if (!account) throw new ApiError(503, "UNAVAILABLE", "계정 저장을 먼저 불러와 주세요.");
  return account;
}
export async function bootstrapAccount(identity: Identity, repo: GameRepository, now: () => Date): Promise<Bootstrap> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const account = await repo.readAccount(identity), stamp = now().toISOString();
    if (account) return toBootstrap(account, stamp);
    const documents: AccountDoc[] = [
      { ...docBase(identity, "profile", stamp), kind: "profile", displayName: "코기", createdAt: stamp },
      initialCurrent(identity, stamp),
      { ...docBase(identity, "best", stamp), kind: "best", displayName: "코기", eligible: false, record: null },
      { ...docBase(identity, "session", stamp), kind: "session", sessionId: null, generation: 0, expiresAt: new Date(0).toISOString() },
    ];
    try {
      await repo.commit(identity.playerId, documents.map(doc => ({ type: "create", doc })));
      return toBootstrap(accountFromDocuments(documents.map(value => ({ value, etag: "created" }))), stamp);
    } catch (error) { if (!(error instanceof RepositoryConflict)) throw error; }
  }
  throw new ApiError(503, "UNAVAILABLE", "계정 저장을 다시 불러와 주세요.", 1000);
}

