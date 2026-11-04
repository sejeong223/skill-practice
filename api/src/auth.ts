import { createRemoteJWKSet, jwtVerify, errors, type JWTVerifyGetKey } from "jose";
import type { Identity } from "../../src/game/cloud/contracts";
import { uuid, ContractError } from "../../src/game/cloud/validation";
import { loadServerConfig, type ServerConfig } from "./config";
import { ApiError } from "./errors";

export type AccessTokenVerifier = (authorization: string | undefined) => Promise<Identity>;
export function createAccessTokenVerifier(config: ServerConfig, jwks?: JWTVerifyGetKey): AccessTokenVerifier {
  const issuer = "https://login.microsoftonline.com/" + config.tenantId + "/v2.0";
  const keys = jwks ?? createRemoteJWKSet(new URL("https://login.microsoftonline.com/" + config.tenantId + "/discovery/v2.0/keys"),
    { timeoutDuration: 5000, cooldownDuration: 30000, cacheMaxAge: 600000 });
  return async authorization => {
    const match = /^Bearer ([^\s]+)$/i.exec(authorization ?? "");
    if (!match || match[1].length > 16384) throw new ApiError(401, "UNAUTHENTICATED", "로그인이 필요합니다.");
    try {
      const { payload } = await jwtVerify(match[1], keys, {
        algorithms: ["RS256"], issuer, audience: config.apiClientId, clockTolerance: 60,
        requiredClaims: ["exp", "nbf", "iss", "aud", "tid", "oid"],
      });
      const tenantId = uuid(payload.tid, "tid"), objectId = uuid(payload.oid, "oid");
      if (payload.ver !== "2.0" || tenantId !== config.tenantId || payload.azp !== config.webClientId ||
          typeof payload.scp !== "string" || !payload.scp.split(" ").includes(config.scope)) {
        throw new ApiError(403, "FORBIDDEN", "이 게임에 접근할 권한이 없습니다.");
      }
      const namespace = config.testObjectIds.has(objectId) ? "test" : "prod";
      return { tenantId, objectId, namespace, playerId: namespace + ":" + tenantId + ":" + objectId };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof errors.JWTClaimValidationFailed && (error.claim === "iss" || error.claim === "aud")) {
        throw new ApiError(403, "FORBIDDEN", "이 게임용 조직 토큰이 필요합니다.");
      }
      if (error instanceof errors.JWKSTimeout || error instanceof TypeError ||
          error instanceof Error && error.message === "Expected 200 OK from the JSON Web Key Set HTTP response") {
        throw new ApiError(503, "UNAVAILABLE", "로그인 확인을 잠시 후 다시 시도해 주세요.", 1000);
      }
      if (error instanceof errors.JOSEError || error instanceof ContractError) {
        throw new ApiError(401, "UNAUTHENTICATED", "로그인을 다시 확인해 주세요.");
      }
      throw new ApiError(503, "UNAVAILABLE", "로그인 확인을 잠시 후 다시 시도해 주세요.", 1000);
    }
  };
}
let defaultVerifier: AccessTokenVerifier | undefined;
export function authenticate(authorization: string | undefined): Promise<Identity> {
  // Lazy configuration: build/import never needs a credential and a broken deployment fails closed.
  defaultVerifier ??= createAccessTokenVerifier(loadServerConfig(process.env));
  return defaultVerifier(authorization);
}

