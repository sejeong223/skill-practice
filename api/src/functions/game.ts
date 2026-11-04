import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import type { Identity } from "../../../src/game/cloud/contracts";
import { withIdentity, readJsonBody, ApiError, json } from "../http";
import type { AccessTokenVerifier } from "../auth";
import { dispatchGameService } from "../services/router";
export const GAME_ROUTES = [
  ["bootstrap", "GET", "game/bootstrap"], ["acquire", "POST", "game/session/acquire"],
  ["heartbeat", "POST", "game/session/heartbeat"], ["release", "POST", "game/session/release"],
  ["save", "POST", "game/save"], ["reset", "POST", "game/reset"], ["leaderboard", "GET", "game/leaderboard"],
] as const;
export type GameRoute = typeof GAME_ROUTES[number][0];
export type GameServiceHandler = (route: GameRoute, identity: Identity, body: unknown) => Promise<HttpResponseInit>;
const unavailable: GameServiceHandler = async () => { throw new ApiError(503, "UNAVAILABLE", "게임 저장 서비스를 준비하고 있습니다."); };
export function createGameHandlers(verify?: AccessTokenVerifier, service: GameServiceHandler = unavailable) {
  return Object.fromEntries(GAME_ROUTES.map(([name, method]) => [name, withIdentity(async (req: HttpRequest, id: Identity) => {
    if (req.method !== method) return { ...json({ error: { code: "INVALID_REQUEST", message: "지원하지 않는 요청 방식입니다.", retryAfterMs: null } }, 405), headers: { Allow: method } };
    const body = method === "POST" ? await readJsonBody(req) : null;
    return service(name, id, body);
  }, verify)]));
}
const handlers = createGameHandlers(undefined, dispatchGameService);
for (const [name, method, route] of GAME_ROUTES) {
  app.http("game-" + name, { methods: [method], route, authLevel: "anonymous", handler: handlers[name] });
}

