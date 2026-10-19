import type { StageId } from "../core/types";

export type BossWarningKind = "bark-third" | "bowl-alarm";
export interface BossWarningView {
  readonly kind: BossWarningKind;
  readonly sequence: number;
}
export interface BossFeedbackSnapshot {
  readonly stageId: StageId;
  readonly active: boolean;
  readonly barkUnlocked: boolean;
  readonly barkRemainingMs: number;
  readonly barkCooldownMs: number;
  readonly warning: BossWarningView | null;
}
export const BOSS_WARNING_DURATION_MS = 2500;
export const BARK_SHAKE_DURATION_MS = 800;
export const BARK_SHAKE_INTENSITY = 0.035;

export class BossFeedbackController {
  private barkUseCount = 0;
  private warningSequence = 0;
  private warning: BossWarningView | null = null;
  private warningRemainingMs = 0;

  public recordBarkUse(): boolean {
    this.barkUseCount += 1;
    if (this.barkUseCount % 3 !== 0) return false;
    this.showWarning("bark-third");
    return true;
  }

  public showBowlAlarm(): void { this.showWarning("bowl-alarm"); }

  public update(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
    this.warningRemainingMs = Math.max(0, this.warningRemainingMs - deltaMs);
    if (this.warningRemainingMs === 0) this.warning = null;
  }

  public getWarning(): BossWarningView | null {
    return this.warning ? { ...this.warning } : null;
  }

  public clearWarning(): void {
    this.warning = null;
    this.warningRemainingMs = 0;
  }

  public reset(): void {
    this.barkUseCount = 0;
    this.warningSequence = 0;
    this.clearWarning();
  }

  private showWarning(kind: BossWarningKind): void {
    this.warning = { kind, sequence: ++this.warningSequence };
    this.warningRemainingMs = BOSS_WARNING_DURATION_MS;
  }
}
