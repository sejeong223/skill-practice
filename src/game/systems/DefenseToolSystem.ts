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
  sourceX?: number;
  defenderX?: number;
  facing?: -1 | 1;
  projectile?: boolean;
}

export interface DefenseResult {
  blocked: boolean;
  reason: "blocked" | "broken" | "not-weak" | "no-charges" | "wrong-direction" | "unsupported-kind";
  remainingCharges: number;
  toolId: string;
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
    if (this.tools.get(toolId)?.slot !== "defense") {
      return false;
    }
    this.resetForStage(toolId);
    return this.toolId === toolId;
  }

  public tryBlock(attack: IncomingAttack, now: number): DefenseResult {
    const rejected = (reason: DefenseResult["reason"]): DefenseResult => ({
      blocked: false, reason, remainingCharges: this.remainingCharges, toolId: this.toolId,
    });
    if (this.broken || this.remainingCharges <= 0) {
      return rejected("no-charges");
    }

    if (attack.kind !== "weak") {
      return rejected("not-weak");
    }

    if (this.toolId !== "upside-down-bowl" && attack.sourceX !== undefined && attack.defenderX !== undefined &&
        attack.facing !== undefined && (attack.sourceX - attack.defenderX) * attack.facing <= 0) {
      if (this.toolId === "umbrella") this.eventBus.emit("drawback-triggered", {
        toolId: this.toolId, drawbackId: "umbrella-rear-gap", now,
      });
      return rejected("wrong-direction");
    }
    if (this.toolId === "umbrella" && attack.projectile === false) return rejected("unsupported-kind");

    this.remainingCharges -= 1;
    if (this.toolId === "upside-down-bowl") this.eventBus.emit("clang", {
      toolId: this.toolId, remainingCharges: this.remainingCharges, now,
    });
    else this.eventBus.emit("shield-blocked", {
      toolId: this.toolId, remainingCharges: this.remainingCharges, now,
    });

    if (this.toolId === "greasy-pizza-box") this.eventBus.emit("drawback-triggered", {
      toolId: this.toolId, drawbackId: "pizza-grease-slide", now,
    });

    if (this.remainingCharges === 0) {
      this.broken = true;
      if (this.toolId === "upside-down-bowl") {
        this.eventBus.emit("bowl-broken", { toolId: this.toolId, now });
        this.eventBus.emit("drawback-triggered", {
          toolId: this.toolId, drawbackId: "bowl-stray-dog-blockade", now,
        });
      } else {
        this.eventBus.emit("shield-broken", { toolId: this.toolId, now });
        if (this.toolId === "cushion-pad" || this.toolId === "yellow-pot-lid") {
          this.eventBus.emit("drawback-triggered", {
            toolId: this.toolId,
            drawbackId: this.toolId === "cushion-pad" ? "cushion-side-bounce" : "pot-lid-ear-ringing", now,
          });
        }
      }
    }

    return {
      blocked: true,
      reason: "blocked",
      remainingCharges: this.remainingCharges,
      toolId: this.toolId,
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
