import { uuid } from "../../src/game/cloud/validation";
import { ApiError } from "./errors";
export interface ServerConfig {
  tenantId: string; apiClientId: string; webClientId: string; scope: "access_as_user";
  cosmosEndpoint: string; cosmosTenantId: string; cosmosClientId: string; cosmosClientSecret: string;
  database: "legendary-rib-corgi"; container: "game-data"; testObjectIds: ReadonlySet<string>;
}
export function loadServerConfig(env: NodeJS.ProcessEnv): ServerConfig {
  try {
    const tenantId = uuid(env.GAME_TENANT_ID, "tenant");
    const endpoint = new URL(env.GAME_COSMOS_ENDPOINT ?? "");
    if (endpoint.protocol !== "https:" || endpoint.hostname !== "maze-rescue-ms-b7af62a9.documents.azure.com" ||
        endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== "/") throw new Error();
    if (!env.GAME_COSMOS_CLIENT_SECRET?.trim()) throw new Error();
    const ids: unknown = JSON.parse(env.GAME_TEST_OBJECT_IDS ?? "[]");
    if (!Array.isArray(ids) || ids.length > 100) throw new Error();
    return { tenantId, apiClientId: uuid(env.GAME_API_CLIENT_ID, "api"), webClientId: uuid(env.GAME_WEB_CLIENT_ID, "web"),
      scope: "access_as_user", cosmosEndpoint: endpoint.origin + "/", cosmosTenantId: tenantId,
      cosmosClientId: uuid(env.GAME_COSMOS_CLIENT_ID, "cosmosClient"), cosmosClientSecret: env.GAME_COSMOS_CLIENT_SECRET,
      database: "legendary-rib-corgi", container: "game-data",
      testObjectIds: new Set(ids.map(id => uuid(id, "testOid"))) };
  } catch { throw new ApiError(503, "UNAVAILABLE", "서버 연결 설정을 확인해 주세요."); }
}

