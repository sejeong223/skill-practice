import * as Phaser from "phaser";
import type {
  MapChainActionDefinition,
  MapChainRule,
  MapChainTrigger,
  MapPropertyValue,
} from "../core/contentTypes";
import type { MapRuntimeSnapshot } from "../core/runtimeTypes";
import { GameplayEventBus } from "../core/events";
import { StageRandom } from "../random/StageRandom";
import { Player } from "../entities/Player";
import type { LoadedMap } from "./mapTypes";
import { MapRuleRegistry } from "./MapRuleRegistry";

interface PendingAction {
  readonly at: number;
  readonly chainId: string;
  readonly action: MapChainActionDefinition;
}

export class MapInteractionSystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly eventBus: GameplayEventBus;
  private readonly stageId: string;
  private readonly random: StageRandom;
  private readonly registry: MapRuleRegistry;
  private readonly pendingActions: PendingAction[] = [];

  public constructor(
    scene: Phaser.Scene,
    player: Player,
    eventBus: GameplayEventBus,
    stageId: string,
    random: StageRandom,
    loadedMap: LoadedMap | null,
  ) {
    this.scene = scene;
    this.player = player;
    this.eventBus = eventBus;
    this.stageId = stageId;
    this.random = random;
    this.registry = new MapRuleRegistry(loadedMap?.objects ?? [], random);
    this.registerRules(loadedMap?.chainRules ?? []);
  }

  public registerRules(rules: readonly MapChainRule[]): void {
    this.registry.registerRules(rules);
  }

  public update(time: number, delta: number): void {
    void delta;
    while (this.pendingActions[0]?.at <= time) {
      const pending = this.pendingActions.shift();
      if (pending) {
        this.applyAction(pending.chainId, pending.action, time);
      }
    }
  }

  public triggerObject(
    objectId: string,
    trigger: MapChainTrigger,
    now = this.scene.time.now,
  ): boolean {
    this.eventBus.emit("map-object-triggered", {
      stageId: this.stageId,
      objectId,
      trigger,
      now,
    });

    const rules = this.registry.getRulesForTrigger(trigger, objectId);
    let fired = false;

    for (const rule of rules) {
      if (!this.canRunRule(rule, objectId)) {
        continue;
      }

      fired = this.fireChain(rule.id, objectId, now) || fired;
    }

    return fired;
  }

  public fireChain(
    chainId: string,
    sourceId?: string,
    now = this.scene.time.now,
  ): boolean {
    if (this.registry.hasChainFired(chainId)) {
      return false;
    }

    const rule = this.registry.getRule(chainId);
    if (!rule) {
      return false;
    }

    this.registry.markChainFired(chainId);
    this.eventBus.emit("map-chain-fired", {
      stageId: this.stageId,
      chainId,
      sourceId,
      now,
    });

    for (const action of rule.actions) {
      if ((action.delayMs ?? 0) > 0) {
        this.pendingActions.push({
          at: now + (action.delayMs ?? 0),
          chainId,
          action,
        });
      } else {
        this.applyAction(chainId, action, now);
      }
    }

    return true;
  }

  public createSnapshot(checkpointId: string): MapRuntimeSnapshot {
    return this.registry.createSnapshot(checkpointId, this.random.seed);
  }

  public reset(snapshot: MapRuntimeSnapshot | null, now = this.scene.time.now): void {
    this.pendingActions.splice(0);
    if (snapshot) {
      this.registry.restore(snapshot);
    } else {
      this.registry.reset();
    }

    this.eventBus.emit("map-reset", {
      stageId: this.stageId,
      checkpointId: snapshot?.checkpointId ?? null,
      now,
    });
  }

  public getObjectState(objectId: string) {
    return this.registry.getObjectState(objectId);
  }

  public getPlayer(): Player {
    return this.player;
  }

  private canRunRule(rule: MapChainRule, objectId: string): boolean {
    if (rule.sourceId && rule.sourceId !== objectId) {
      return false;
    }

    if (!rule.condition) {
      return true;
    }

    const definition = this.registry.getObjectDefinition(objectId);
    const state = this.registry.getObjectState(objectId);
    const value = definition?.properties[rule.condition.property] ??
      state?.[rule.condition.property as keyof typeof state];

    if (rule.condition.equals !== undefined && value !== rule.condition.equals) {
      return false;
    }

    return rule.condition.notEquals === undefined || value !== rule.condition.notEquals;
  }

  private applyAction(
    chainId: string,
    action: MapChainActionDefinition,
    now: number,
  ): void {
    const targetId = action.targetId;
    const current = targetId ? this.registry.getObjectState(targetId) : undefined;

    if (targetId && action.type === "activate-object") {
      this.emitState(targetId, this.registry.setObjectState(targetId, { active: true }), now);
    } else if (targetId && action.type === "deactivate-object") {
      this.emitState(targetId, this.registry.setObjectState(targetId, { active: false }), now);
    } else if (targetId && action.type === "move-object") {
      const position = this.readPosition(action.value, current?.x ?? 0, current?.y ?? 0);
      this.emitState(targetId, this.registry.setObjectState(targetId, position), now);
    } else if (targetId && action.type === "spawn-enemy") {
      this.registry.markEntitySpawned(targetId);
      this.emitState(targetId, this.registry.setObjectState(targetId, { active: true }), now);
    } else if (targetId && action.type === "set-collision") {
      this.emitState(
        targetId,
        this.registry.setObjectState(targetId, {
          collision: action.value === true,
        }),
        now,
      );
    } else if (action.type === "emit-event" || action.type === "camera-effect") {
      const objectId = targetId ?? chainId;
      const state = current ?? {
        active: true,
        x: 0,
        y: 0,
        collision: false,
      };
      this.emitState(objectId, state, now, action.eventType);
    }
  }

  private emitState(
    objectId: string,
    state: {
      active: boolean;
      x: number;
      y: number;
      collision: boolean;
      variant?: string;
    },
    now: number,
    effect?: string,
  ): void {
    this.eventBus.emit("map-object-state-changed", {
      stageId: this.stageId,
      objectId,
      active: state.active,
      x: state.x,
      y: state.y,
      collision: state.collision,
      variant: state.variant,
      effect,
      now,
    });
  }

  private readPosition(
    value: MapPropertyValue | undefined,
    fallbackX: number,
    fallbackY: number,
  ): { x: number; y: number } {
    if (typeof value !== "string") {
      return { x: fallbackX, y: fallbackY };
    }

    const [x, y] = value.split(",").map(Number);
    return {
      x: Number.isFinite(x) ? x : fallbackX,
      y: Number.isFinite(y) ? y : fallbackY,
    };
  }
}
