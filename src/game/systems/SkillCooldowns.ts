import type { SkillId } from "../core/types";

export class SkillCooldowns {
  private readonly cooldownUntil = new Map<SkillId, number>();

  public canUse(skillId: SkillId, now: number): boolean {
    return this.getRemaining(skillId, now) === 0;
  }

  public start(skillId: SkillId, now: number, cooldownMs: number): void {
    this.cooldownUntil.set(skillId, now + cooldownMs);
  }

  public getRemaining(skillId: SkillId, now: number): number {
    const until = this.cooldownUntil.get(skillId) ?? 0;
    return Math.max(0, until - now);
  }

  public reset(skillId?: SkillId): void {
    if (skillId) {
      this.cooldownUntil.delete(skillId);
    } else {
      this.cooldownUntil.clear();
    }
  }
}
