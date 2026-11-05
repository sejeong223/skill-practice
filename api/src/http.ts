import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import type { Identity } from "../../src/game/cloud/contracts";
import { GAME_AUTH_HEADER } from "../../src/game/cloud/contracts";
import { ContractError } from "../../src/game/cloud/validation";
import { authenticate, type AccessTokenVerifier } from "./auth";
import { ApiError } from "./errors";
export { ApiError } from "./errors";
export function json(body: unknown, status = 200): HttpResponseInit {
  return { status, jsonBody: body, headers: { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" } };
}
export function errorResponse(error: unknown): HttpResponseInit {
  const safe = error instanceof ApiError ? error : error instanceof ContractError
    ? new ApiError(400, "INVALID_REQUEST", "저장 요청 형식이 올바르지 않습니다.")
    : new ApiError(503, "UNAVAILABLE", "서버 연결을 잠시 후 다시 시도해 주세요.", 1000);
  const result = json({ error: { code: safe.code, message: safe.message, retryAfterMs: safe.retryAfterMs } }, safe.status);
  if (safe.retryAfterMs !== null) result.headers = { ...result.headers, "Retry-After": String(Math.ceil(safe.retryAfterMs / 1000)) };
  if (safe.status === 401) result.headers = { ...result.headers, "WWW-Authenticate": "Bearer" };
  return result;
}
export function withIdentity(
  handler: (req: HttpRequest, identity: Identity) => Promise<HttpResponseInit>,
  verify: AccessTokenVerifier = authenticate,
): (req: HttpRequest, ctx: InvocationContext) => Promise<HttpResponseInit> {
  return async (req, ctx) => {
    try {
      // Never fall back to the platform's Authorization or principal headers.
      const identity = await verify(req.headers.get(GAME_AUTH_HEADER) ?? undefined);
      const response = await handler(req, identity);
      return { ...response, headers: { ...response.headers, "Cache-Control": "no-store" } };
    } catch (error) {
      const response = errorResponse(error);
      ctx?.warn?.({ invocationId: ctx.invocationId, status: response.status,
        code: error instanceof ApiError ? error.code : error instanceof ContractError ? error.code : "UNAVAILABLE" });
      return response;
    }
  };
}
export async function readJsonBody(req: HttpRequest, maxBytes = 256 * 1024): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") ?? "")) {
    throw new ApiError(400, "INVALID_REQUEST", "JSON 요청이 필요합니다.");
  }
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declared) || declared < 0 || declared > maxBytes) throw new ContractError("body");
  const reader = req.body?.getReader();
  if (!reader) throw new ContractError("body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) { await reader.cancel(); throw new ContractError("body"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new ContractError("body");
    return parsed;
  } catch { throw new ContractError("body"); }
  finally { reader.releaseLock(); }
}

