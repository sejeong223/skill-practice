import { CosmosClient, type Container, type OperationInput, type OperationResponse } from "@azure/cosmos";
import { ClientSecretCredential } from "@azure/identity";
import type { Identity, Namespace } from "../../src/game/cloud/contracts";
import type { ServerConfig } from "./config";
import { ACCOUNT_IDS, accountFromDocuments, parseDocument, type AccountSnapshot, type BestDoc, type ReceiptDoc, type WriteOperation } from "./documents";
import { ApiError, RepositoryConflict } from "./errors";
export interface GameRepository {
  readAccount(identity: Identity): Promise<AccountSnapshot | null>;
  readReceipt(playerId: string, requestId: string): Promise<ReceiptDoc | null>;
  commit(playerId: string, operations: WriteOperation[]): Promise<void>;
  scanBest(namespace: Namespace, deadlineMs: number): AsyncIterable<BestDoc>;
}
function failureDetail(error: unknown): { code?: number | string; statusCode?: number; retryAfterInMs?: number; headers?: Record<string, unknown> } {
  let current = error;
  for (let depth = 0; depth < 8; depth++) {
    if (!current || typeof current !== "object") break;
    const r = current as { code?: number | string; statusCode?: number; cause?: unknown };
    if (Number(r.code ?? r.statusCode ?? 0)) return r;
    current = r.cause;
  }
  return {};
}
function statusOf(error: unknown): number { const r = failureDetail(error); return Number(r.code ?? r.statusCode ?? 0); }
export function databaseError(error: unknown): Error {
  if (error instanceof ApiError || error instanceof RepositoryConflict) return error;
  const code = statusOf(error);
  if (code === 409 || code === 412) return new RepositoryConflict();
  if (code === 429) {
    const r = failureDetail(error);
    const delay = Number(r.retryAfterInMs ?? r.headers?.["x-ms-retry-after-ms"] ?? 1000);
    return new ApiError(429, "THROTTLED", "저장 요청이 많습니다. 잠시 후 다시 시도합니다.", Number.isFinite(delay) ? Math.max(0, delay) : 1000);
  }
  return new ApiError(503, "UNAVAILABLE", "저장 서버에 연결할 수 없습니다.", 1000);
}
export class CosmosGameRepository implements GameRepository {
  constructor(private readonly container: Container) {}
  async readAccount(identity: Identity): Promise<AccountSnapshot | null> {
    // A read batch observes all four documents together, rather than mixing separate point reads.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.container.items.batch(
          ACCOUNT_IDS.map(id => ({ operationType: "Read", id })), identity.playerId, { abortSignal: AbortSignal.timeout(10000) })
          .catch(error => {
            if (statusOf(error) === 404) return { code: 404, headers: {}, result: [{ statusCode: 404, requestCharge: 0 }] as OperationResponse[] };
            throw error;
          });
        const rows = response.result ?? [];
        if (response.code && response.code >= 400 && !rows.some(r => r.statusCode === 404)) throw { code: response.code, headers: response.headers };
        if (rows.length === 4 && rows.every(r => r.statusCode >= 200 && r.statusCode < 300)) {
          return accountFromDocuments(rows.map(r => ({ value: parseDocument(r.resourceBody, identity.playerId),
            etag: r.eTag ?? String(r.resourceBody?._etag ?? "") })));
        }
        if (!rows.some(r => r.statusCode === 404)) {
          throw { code: rows.find(r => r.statusCode >= 400 && r.statusCode !== 424)?.statusCode ?? 503, headers: response.headers };
        }
        const existing = await this.container.items.query<{ id: string }>({
          query: "SELECT c.id FROM c WHERE c.id IN ('profile','current','best','session')",
        }, { partitionKey: identity.playerId, maxItemCount: 4, abortSignal: AbortSignal.timeout(10000) }).fetchAll();
        if (existing.resources.length === 0) return null;
        if (existing.resources.length !== 4) throw new ApiError(503, "UNSUPPORTED_SAVE", "저장 데이터 일부를 확인할 수 없습니다.");
        // Another request created the whole account after the failed read; read a new atomic snapshot.
      } catch (error) { throw databaseError(error); }
    }
    throw new ApiError(503, "UNAVAILABLE", "저장 데이터를 다시 불러와 주세요.", 1000);
  }
  async readReceipt(playerId: string, requestId: string): Promise<ReceiptDoc | null> {
    try {
      const response = await this.container.item("receipt:" + requestId, playerId).read();
      if (!response.resource) throw new ApiError(503, "UNSUPPORTED_SAVE", "저장 확인 데이터를 읽을 수 없습니다.");
      const doc = parseDocument(response.resource, playerId);
      if (doc.kind !== "receipt") throw new ApiError(503, "UNSUPPORTED_SAVE", "저장 확인 데이터가 올바르지 않습니다.");
      return doc;
    } catch (error) { if (statusOf(error) === 404) return null; throw databaseError(error); }
  }
  async commit(playerId: string, operations: WriteOperation[]): Promise<void> {
    if (!operations.length || operations.some(o => o.doc.playerId !== playerId)) throw new ApiError(403, "FORBIDDEN", "잘못된 저장 소유자입니다.");
    const batch: OperationInput[] = operations.map(op => {
      const body = JSON.parse(JSON.stringify(op.doc));
      return op.type === "create" ? { operationType: "Create", resourceBody: body }
        : { operationType: "Replace", id: op.doc.id, resourceBody: body, ifMatch: op.etag };
    });
    try {
      const response = await this.container.items.batch(batch, playerId, {
        abortSignal: AbortSignal.timeout(10000), contentResponseOnWriteEnabled: false,
      });
      const rows = response.result ?? [];
      const failure = rows.find(r => r.statusCode >= 400 && r.statusCode !== 424);
      if (failure || (response.code ?? 200) >= 400 || rows.length !== batch.length || rows.some(r => r.statusCode >= 400)) {
        throw { code: failure?.statusCode ?? response.code ?? 503, headers: response.headers };
      }
    } catch (error) { throw databaseError(error); }
  }
  async *scanBest(namespace: Namespace, deadlineMs: number): AsyncIterable<BestDoc> {
    if (deadlineMs <= Date.now()) throw new ApiError(503, "UNAVAILABLE", "랭킹 조회 시간이 초과되었습니다.", 1000);
    const iterator = this.container.items.query({
      query: "SELECT c.id,c.playerId,c.schemaVersion,c.namespace,c.updatedAt,c.kind,c.displayName,c.eligible,c.record FROM c WHERE c.kind=@kind AND c.namespace=@namespace AND c.eligible=true",
      parameters: [{ name: "@kind", value: "best" }, { name: "@namespace", value: namespace }],
    }, { maxItemCount: 100, abortSignal: AbortSignal.timeout(Math.max(1, deadlineMs - Date.now())) });
    try {
      while (iterator.hasMoreResults()) {
        if (Date.now() >= deadlineMs) throw new ApiError(503, "UNAVAILABLE", "랭킹 조회 시간이 초과되었습니다.", 1000);
        const page = await iterator.fetchNext();
        for (const value of page.resources) {
          const doc = parseDocument(value);
          if (doc.kind !== "best" || doc.namespace !== namespace || !doc.eligible) throw new ApiError(503, "UNSUPPORTED_SAVE", "랭킹 데이터를 확인할 수 없습니다.");
          yield doc;
        }
      }
    } catch (error) { throw databaseError(error); }
  }
}
export function createCosmosRepository(config: ServerConfig): GameRepository {
  const client = new CosmosClient({ endpoint: config.cosmosEndpoint,
    aadCredentials: new ClientSecretCredential(config.cosmosTenantId, config.cosmosClientId, config.cosmosClientSecret),
    connectionPolicy: { retryOptions: { maxRetryAttemptCount: 0 } } });
  return new CosmosGameRepository(client.database(config.database).container(config.container));
}

