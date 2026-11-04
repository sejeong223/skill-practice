import { setTimeout as delay } from "node:timers/promises";
import type { Identity, LeaderboardResponse } from "../../../src/game/cloud/contracts";
import { MILESTONES } from "../../../src/game/cloud/progression";
import { parseDocument, type BestDoc } from "../documents";
import { ApiError } from "../errors";
import type { GameRepository } from "../repository";

const names = new Intl.Collator("ko", { usage: "sort", sensitivity: "variant", numeric: false });
export function compareBestRows(a: BestDoc, b: BestDoc): number {
  if (!a.record || !b.record) throw new ApiError(503, "UNSUPPORTED_SAVE", "랭킹 기록을 확인할 수 없습니다.");
  return b.record.progressRank - a.record.progressRank || a.record.deaths - b.record.deaths ||
    names.compare(a.displayName.normalize("NFC"), b.displayName.normalize("NFC")) ||
    (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0);
}
export async function getLeaderboard(_id: Identity, repo: GameRepository, now: () => Date): Promise<LeaderboardResponse> {
  const deadline = Date.now() + 30000;
  for (let attempt = 0; ; attempt++) {
    // A failed SDK query iterator cannot be resumed reliably. Retry a fresh complete
    // scan, discarding partial candidates, rather than treating it as the last page.
    const top: BestDoc[] = [];
    try {
      for await (const value of repo.scanBest("prod", deadline)) {
        if (Date.now() >= deadline) throw new ApiError(503, "UNAVAILABLE", "랭킹 조회 시간이 초과되었습니다.", 1000);
        const row = parseDocument(value);
        if (row.kind !== "best" || row.namespace !== "prod" || !row.eligible || !row.record) {
          throw new ApiError(503, "UNSUPPORTED_SAVE", "랭킹 기록을 확인할 수 없습니다.");
        }
        const position = top.findIndex(previous => compareBestRows(row, previous) < 0);
        if (position >= 0) top.splice(position, 0, row);
        else if (top.length < 10) top.push(row);
        if (top.length > 10) top.pop();
      }
      if (Date.now() >= deadline) throw new ApiError(503, "UNAVAILABLE", "랭킹 조회 시간이 초과되었습니다.", 1000);
      return { generatedAt: now().toISOString(), rows: top.map((row, index) => ({
        rank: index + 1, nickname: row.displayName, deaths: row.record!.deaths,
        location: MILESTONES.find(m => m.id === row.record!.milestoneId)!.label,
      })) };
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "THROTTLED") throw error;
      const wait = Math.max(1, error.retryAfterMs ?? 1000);
      if (Date.now() + wait >= deadline) throw new ApiError(503, "UNAVAILABLE", "랭킹 조회 시간이 초과되었습니다.", 1000);
      if (attempt >= 2) throw error;
      await delay(wait);
    }
  }
}
