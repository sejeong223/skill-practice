import type { MarketCategory, ProgressState, RuntimeStageState, StageId } from "../core/types";
import { getMarketProduct } from "../data/marketCatalog";
import { hasCollectedCoin, recordCollectedCoin } from "./coinLedger";
import { GameEventBus } from "../bridge/GameEventBus";

export class EconomySystem {
  private readonly progress: ProgressState;
  private readonly runtime: RuntimeStageState;
  private readonly eventBus: GameEventBus;

  public constructor(
    progress: ProgressState,
    runtime: RuntimeStageState,
    eventBus: GameEventBus,
  ) {
    this.progress = progress;
    this.runtime = runtime;
    this.eventBus = eventBus;
  }

  public collectCoin(stageId: StageId, amount = 1, coinId?: string): boolean {
    if (stageId !== this.runtime.stageId || !Number.isInteger(amount) || amount <= 0 ||
        (coinId !== undefined && (amount !== 1 || coinId.trim().length === 0 || hasCollectedCoin(this.progress, stageId, coinId)))) {
      return false;
    }
    if (coinId !== undefined && !recordCollectedCoin(this.progress, stageId, coinId)) return false;
    this.runtime.currentStageCoins += amount;
    this.progress.bankedCoins += amount;
    this.emitCoins(stageId);
    return true;
  }

  public commitStageClear(): number {
    this.runtime.currentStageCoins = 0;
    if (!this.progress.clearedStages.includes(this.runtime.stageId)) {
      this.progress.clearedStages.push(this.runtime.stageId);
    }
    this.emitCoins(this.runtime.stageId);
    return this.progress.bankedCoins;
  }

  public handleDeath(): void {
    this.runtime.currentStageCoins = 0;
    this.emitCoins(this.runtime.stageId);
  }

  public purchaseTool(toolId: string): boolean {
    const product = getMarketProduct(toolId);
    return Boolean(product && (product.category === "weapon" || product.category === "shield") &&
      this.purchaseMarketProduct(toolId).ok);
  }

  public purchaseMarketProduct(itemId: string): PurchaseResult {
    const product = getMarketProduct(itemId);
    if (!product) return { ok: false, reason: "unknown-item" };
    const alreadyOwned = product.cosmeticId !== undefined
      ? this.progress.ownedCosmeticIds.includes(product.cosmeticId)
      : this.progress.ownedToolIds.includes(product.toolId);
    if (alreadyOwned) return { ok: false, reason: "already-owned" };
    if (this.progress.bankedCoins < product.price) return { ok: false, reason: "insufficient-coins" };

    this.progress.bankedCoins -= product.price;
    if (product.cosmeticId === undefined) {
      this.progress.ownedToolIds.push(product.toolId);
      this.eventBus.emit("tool-purchased", { toolId: product.toolId, bankedCoins: this.progress.bankedCoins });
    } else {
      this.progress.ownedCosmeticIds.push(product.cosmeticId);
    }
    this.eventBus.emit("market-item-purchased", { itemId, category: product.category, bankedCoins: this.progress.bankedCoins });
    this.emitCoins(this.runtime.stageId);
    return { ok: true, itemId, category: product.category, bankedCoins: this.progress.bankedCoins };
  }

  public getBankedCoins(): number {
    return this.progress.bankedCoins;
  }

  public getCurrentStageCoins(): number {
    return this.runtime.currentStageCoins;
  }

  private emitCoins(stageId: StageId): void {
    this.eventBus.emit("coin-changed", {
      stageId,
      currentStageCoins: this.runtime.currentStageCoins,
      bankedCoins: this.progress.bankedCoins,
    });
  }
}

export type PurchaseResult =
  | { ok: true; itemId: string; category: MarketCategory; bankedCoins: number }
  | { ok: false; reason: "insufficient-coins" | "already-owned" | "unknown-item" };
