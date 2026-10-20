import { GameplayEventBus } from "../core/events";
import type { ToolDefinition } from "../core/types";
import { Player } from "../entities/Player";
import {
  SlipperAttackController,
  type SlipperAttackResult,
} from "./SlipperAttack";

export class CombatSystem {
  private readonly player: Player;
  private readonly tools: ReadonlyMap<string, ToolDefinition>;
  private readonly eventBus: GameplayEventBus;
  private readonly slipperAttack: SlipperAttackController;
  private attackToolId = "rabbit-slipper";
  private nextToolAttackAt = 0;

  public constructor(
    player: Player,
    eventBus: GameplayEventBus,
    tools: readonly ToolDefinition[],
  ) {
    this.player = player;
    this.eventBus = eventBus;
    this.tools = new Map(tools.map((tool) => [tool.id, tool]));
    this.slipperAttack = new SlipperAttackController(player, eventBus);
  }

  public tryAttack(now: number): SlipperAttackResult {
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
    if (now < this.nextToolAttackAt) {
      return { accepted: false, kind: "cooldown", comboCount: 0, knockbackX: 0 };
    }
    this.nextToolAttackAt = now + 280;
    return { accepted: true, kind: "tool-preview", comboCount: 0, knockbackX: 0 };
  }

  public setAttackTool(toolId: string): void {
    const tool = this.tools.get(toolId);

    if (tool?.slot === "attack") {
      this.attackToolId = toolId;
      this.nextToolAttackAt = 0;
    }
  }

  public update(now: number): void {
    this.slipperAttack.update(now);
  }

  public resetForStage(): void {
    this.slipperAttack.resetForStage();
    this.nextToolAttackAt = 0;
  }

  public getAttackToolId(): string {
    return this.attackToolId;
  }

  public getEventBus(): GameplayEventBus {
    return this.eventBus;
  }
}
