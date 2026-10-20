import { GameplayEventBus } from "../core/events";
import type { ToolDefinition } from "../core/types";

export type IncomingAttackKind =
  | "weak"
  | "lethal-trap"
  | "hazard"
  | "boss-phase";

export interface IncomingAttack {
  id: string;
  kind: IncomingAttackKind;
  damage: number;
}

export interface DefenseResult {
  blocked: boolean;
  reason: "blocked" | "broken" | "not-weak" | "no-charges";
  remainingCharges: number;
}

export class DefenseToolSystem {
  private readonly eventBus: GameplayEventBus;
  private readonly tools: ReadonlyMap<string, ToolDefinition>;
  private toolId = "upside-down-bowl";
  private remainingCharges = 0;
  private broken = false;

  public constructor(
    eventBus: GameplayEventBus,
    tools: readonly ToolDefinition[],
  ) {
    this.eventBus = eventBus;
    this.tools = new Map(tools.map((tool) => [tool.id, tool]));
    this.resetForStage();
  }

  public resetForStage(toolId = "upside-down-bowl"): void {
    const tool = this.tools.get(toolId);

    if (!tool || tool.slot !== "defense") {
      return;
    }

    this.toolId = toolId;
    this.remainingCharges = tool.charges ?? 0;
    this.broken = false;
  }

  public setDefenseTool(toolId: string): boolean {
    if (!this.tools.has(toolId)) {
      return false;
    }
    this.resetForStage(toolId);
    return this.toolId === toolId;
  }

  public tryBlock(attack: IncomingAttack, now: number): DefenseResult {
    if (this.broken || this.remainingCharges <= 0) {
      return {
        blocked: false,
        reason: "no-charges",
        remainingCharges: this.remainingCharges,
      };
    }

    if (attack.kind !== "weak") {
      return {
        blocked: false,
        reason: "not-weak",
        remainingCharges: this.remainingCharges,
      };
    }

    this.remainingCharges -= 1;
    this.eventBus.emit("clang", {
      toolId: this.toolId,
      remainingCharges: this.remainingCharges,
      now,
    });

    if (this.remainingCharges === 0) {
      this.broken = true;
      this.eventBus.emit("bowl-broken", {
        toolId: this.toolId,
        now,
      });
      this.eventBus.emit("drawback-triggered", {
        toolId: this.toolId,
        drawbackId: "bowl-stray-dog-blockade",
        now,
      });
    }

    return {
      blocked: true,
      reason: "blocked",
      remainingCharges: this.remainingCharges,
    };
  }

  public getRemainingCharges(): number {
    return this.remainingCharges;
  }

  public getToolId(): string { return this.toolId; }

  public isBroken(): boolean {
    return this.broken;
  }
}
