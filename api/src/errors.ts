import type { ApiErrorCode } from "../../src/game/cloud/contracts";
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: ApiErrorCode, message: string, readonly retryAfterMs: number | null = null) {
    super(message); this.name = "ApiError";
  }
}
export class RepositoryConflict extends Error {
  constructor() { super("Conditional write conflict"); this.name = "RepositoryConflict"; }
}

