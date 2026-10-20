import { GameplayEventBus } from "../core/events";
import type { ToolDefinition } from "../core/types";
import { Player } from "../entities/Player";
import {
  SlipperAttackController,
  type SlipperAttackResult,
} from "./SlipperAttack";
import { WeaponAttack, type AttackContact, type WeaponFireResult } from "./WeaponAttack";

export interface AttackResult extends SlipperAttackResult {
  readonly contacts?: readonly AttackContact[];
  readonly weaponKind?: WeaponFireResult["kind"];
}

export class CombatSystem {
  private readonly player: Player;
  private readonly tools: ReadonlyMap<string, ToolDefinition>;
  private readonly eventBus: GameplayEventBus;
  private readonly slipperAttack: SlipperAttackController;
  private readonly weaponAttack: WeaponAttack;
  private attackToolId = "rabbit-slipper";

  public constructor(
    player: Player,
    eventBus: GameplayEventBus,
    tools: readonly ToolDefinition[],
  ) {
    this.player = player;
    this.eventBus = eventBus;
    this.tools = new Map(tools.map((tool) => [tool.id, tool]));
    this.slipperAttack = new SlipperAttackController(player, eventBus);
    this.weaponAttack = new WeaponAttack(player.scene, player, eventBus);
  }

  public tryAttack(now: number): AttackResult {
    const tool = this.tools.get(this.attackToolId);

    if (!tool || tool.slot !== "attack") {
      return {
        accepted: false,
        kind: "cooldown",
        comboCount: 0,
        knockbackX: 0,
      };
    }

    if (tool.id === "rabbit-slipper") return this.slipperAttack.tryAttack(now);
    const fired = this.weaponAttack.tryAttack(now);
    return { accepted: fired.accepted, kind: fired.accepted ? "tool-preview" : "cooldown",
      comboCount: 0, knockbackX: 0, contacts: fired.contacts, weaponKind: fired.kind };
  }

  public setAttackTool(toolId: string): void {
    const tool = this.tools.get(toolId);

    if (tool?.slot === "attack") {
      this.attackToolId = toolId;
      this.weaponAttack.setTool(toolId);
    }
  }

  public update(now: number, deltaMs = 0): readonly AttackContact[] {
    this.slipperAttack.update(now);
    return this.weaponAttack.update(now, deltaMs);
  }

  public resetForStage(): void {
    this.slipperAttack.resetForStage();
    this.weaponAttack.reset();
  }

  public registerHit(contact: AttackContact): void { this.weaponAttack.registerHit(contact); }

  public destroy(): void { this.weaponAttack.destroy(); this.slipperAttack.resetForStage(); }

  public getAttackToolId(): string {
    return this.attackToolId;
  }

  public getEventBus(): GameplayEventBus {
    return this.eventBus;
  }
}
