import type { ProgressState, StageId, WorldId } from "../core/types";

type CoinLedgerProgress = Pick<ProgressState, "collectedCoinIds">;

export function coinLedgerKey(stageId: StageId, coinId: string): string {
  return `${stageId}:${coinId}`;
}

export function hasCollectedCoin(progress: CoinLedgerProgress, stageId: StageId, coinId: string): boolean {
  return progress.collectedCoinIds.includes(coinLedgerKey(stageId, coinId));
}

export function recordCollectedCoin(progress: CoinLedgerProgress, stageId: StageId, coinId: string): boolean {
  if (coinId.trim().length === 0 || hasCollectedCoin(progress, stageId, coinId)) return false;
  progress.collectedCoinIds.push(coinLedgerKey(stageId, coinId));
  return true;
}

export function clearCollectedCoinsForWorld(progress: CoinLedgerProgress, worldId: WorldId): number {
  const before = progress.collectedCoinIds.length;
  progress.collectedCoinIds = progress.collectedCoinIds.filter((key) => !key.startsWith(`${worldId}-stage-`));
  return before - progress.collectedCoinIds.length;
}
