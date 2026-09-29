import { GameplayEventBus } from "../core/events";
import { GameEventBus } from "../bridge/GameEventBus";
import type { SkillDefinition, SkillId } from "../core/types";
import { Player } from "../entities/Player";
import { SkillCooldowns } from "./SkillCooldowns";

export interface SkillRuntimeState {
  unlocked: Set<SkillId>;
  cooldownUntil: Partial<Record<SkillId, number>>;
}

export interface SkillUseResult {
  skillId: SkillId;
  accepted: boolean;
  reason: "used" | "locked" | "cooldown";
  remainingCooldownMs: number;
}

export class SkillSystem {
  private readonly player: Player;
  private readonly definitions: ReadonlyMap<SkillId, SkillDefinition>;
  private readonly cooldowns = new SkillCooldowns();
  private readonly unlocked = new Set<SkillId>();
  private readonly eventBus?: GameplayEventBus;
  private readonly persistenceEventBus?: GameEventBus;

  public constructor(
    player: Player,
    definitions: readonly SkillDefinition[],
    eventBus?: GameplayEventBus,
    persistenceEventBus?: GameEventBus,
    initialUnlocked: readonly SkillId[] = [],
  ) {
    this.player = player;
    this.definitions = new Map(
      definitions.map((definition) => [definition.id, definition]),
    );
    this.eventBus = eventBus;
    this.persistenceEventBus = persistenceEventBus;
    initialUnlocked.forEach((skillId) => this.unlocked.add(skillId));
  }

  public unlockAfterBoss(bossId: string): SkillId | null {
    const definition = [...this.definitions.values()].find(
      (candidate) => candidate.unlockAfterBossId === bossId,
    );

    if (!definition) {
      return null;
    }

    this.unlocked.add(definition.id);
    this.persistenceEventBus?.emit("skill-unlocked", {
      skillId: definition.id,
    });
    return definition.id;
  }

  public canUse(skillId: SkillId, now: number): boolean {
    return (
      this.unlocked.has(skillId) &&
      this.cooldowns.canUse(skillId, now)
    );
  }

  public use(skillId: SkillId, now: number): SkillUseResult {
    const definition = this.definitions.get(skillId);

    if (!definition || !this.unlocked.has(skillId)) {
      return {
        skillId,
        accepted: false,
        reason: "locked",
        remainingCooldownMs: 0,
      };
    }

    const remainingCooldownMs = this.cooldowns.getRemaining(skillId, now);

    if (remainingCooldownMs > 0) {
      return {
        skillId,
        accepted: false,
        reason: "cooldown",
        remainingCooldownMs,
      };
    }

    this.cooldowns.start(skillId, now, definition.cooldownMs);
    this.applySkillState(skillId);
    this.eventBus?.emit("skill-used", { skillId, now });

    return {
      skillId,
      accepted: true,
      reason: "used",
      remainingCooldownMs: definition.cooldownMs,
    };
  }

  public getRemainingCooldown(skillId: SkillId, now: number): number {
    return this.cooldowns.getRemaining(skillId, now);
  }

  public getRuntimeState(): SkillRuntimeState {
    const cooldownUntil: Partial<Record<SkillId, number>> = {};

    return {
      unlocked: new Set(this.unlocked),
      cooldownUntil,
    };
  }

  private applySkillState(skillId: SkillId): void {
    switch (skillId) {
      case "bark":
        this.player.setAnimationState("bark");
        break;
      case "bite":
        this.player.setAnimationState("attack-bite");
        break;
      case "dash":
        this.player.setAnimationState("dash");
        this.player.setVelocityX(this.player.flipX ? -480 : 480);
        break;
      case "double-jump":
        this.player.setAnimationState("double-jump");
        this.player.setVelocityY(-420);
        break;
      case "tail-rotor":
        this.player.setAnimationState("tail-rotor");
        break;
    }
  }
}
