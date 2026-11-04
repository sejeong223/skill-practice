import type { GameServiceHandler } from "../functions/game";
import { loadServerConfig } from "../config";
import { createCosmosRepository, type GameRepository } from "../repository";
import { parseAcquireRequest, parseLeaseRequest, parseResetRequest, parseSaveRequest } from "../../../src/game/cloud/validation";
import { ApiError, json } from "../http";
import { bootstrapAccount } from "./account";
import { acquireSession, heartbeatSession, releaseSession } from "./session";
import { resetProgress, saveProgress } from "./save";
export function createGameService(repo: GameRepository, now: () => Date = () => new Date()): GameServiceHandler {
  return async (route, id, body) => {
    switch (route) {
      case "bootstrap": return json(await bootstrapAccount(id, repo, now));
      case "acquire": return json(await acquireSession(id, parseAcquireRequest(body), repo, now));
      case "heartbeat": return json(await heartbeatSession(id, parseLeaseRequest(body), repo, now));
      case "release": await releaseSession(id, parseLeaseRequest(body), repo, now); return { status: 204 };
      case "save": return json(await saveProgress(id, parseSaveRequest(body), repo, now));
      case "reset": return json(await resetProgress(id, parseResetRequest(body), repo, now));
      default: throw new ApiError(503, "UNAVAILABLE", "게임 저장 서비스를 준비하고 있습니다.");
    }
  };
}
let service: GameServiceHandler | undefined;
export const dispatchGameService: GameServiceHandler = (...args) => {
  service ??= createGameService(createCosmosRepository(loadServerConfig(process.env)));
  return service(...args);
};

