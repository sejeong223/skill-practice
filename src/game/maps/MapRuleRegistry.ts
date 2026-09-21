import type {
  MapChainRule,
  MapObjectDefinition,
} from "../core/contentTypes";
import type {
  MapObjectRuntimeState,
  MapRuntimeSnapshot,
} from "../core/runtimeTypes";
import { StageRandom } from "../random/StageRandom";

export class MapRuleRegistry {
  private readonly random: StageRandom;
  private readonly objects = new Map<string, MapObjectRuntimeState>();
  private readonly definitions = new Map<string, MapObjectDefinition>();
  private readonly rules = new Map<string, MapChainRule>();
  private readonly firedChainIds = new Set<string>();
  private readonly spawnedEntityIds = new Set<string>();

  public constructor(
    objectDefinitions: readonly MapObjectDefinition[],
    random: StageRandom,
  ) {
    this.random = random;

    for (const definition of objectDefinitions) {
      this.definitions.set(definition.id, definition);
      this.objects.set(definition.id, {
        active: true,
        x: definition.x,
        y: definition.y,
        collision: definition.collision,
        variant: this.resolveVariant(definition),
      });
    }
  }

  public registerRules(rules: readonly MapChainRule[]): void {
    for (const rule of rules) {
      this.rules.set(rule.id, rule);
    }
  }

  public getRules(): readonly MapChainRule[] {
    return [...this.rules.values()];
  }

  public getRule(ruleId: string): MapChainRule | undefined {
    return this.rules.get(ruleId);
  }

  public getRulesForTrigger(
    trigger: MapChainRule["trigger"],
    sourceId: string,
  ): readonly MapChainRule[] {
    return [...this.rules.values()].filter(
      (rule) =>
        rule.trigger === trigger && (!rule.sourceId || rule.sourceId === sourceId),
    );
  }

  public getObjectDefinition(objectId: string): MapObjectDefinition | undefined {
    return this.definitions.get(objectId);
  }

  public getObjectState(objectId: string): MapObjectRuntimeState | undefined {
    return this.objects.get(objectId);
  }

  public getObjectStates(): Readonly<Record<string, MapObjectRuntimeState>> {
    return Object.fromEntries(this.objects.entries());
  }

  public getFiredChainIds(): readonly string[] {
    return [...this.firedChainIds];
  }

  public setObjectState(
    objectId: string,
    patch: Partial<MapObjectRuntimeState>,
  ): MapObjectRuntimeState {
    const current = this.objects.get(objectId) ?? {
      active: true,
      x: 0,
      y: 0,
      collision: false,
    };
    const next = { ...current, ...patch };
    this.objects.set(objectId, next);
    return next;
  }

  public markChainFired(chainId: string): void {
    this.firedChainIds.add(chainId);
  }

  public hasChainFired(chainId: string): boolean {
    return this.firedChainIds.has(chainId);
  }

  public markEntitySpawned(entityId: string): void {
    this.spawnedEntityIds.add(entityId);
  }

  public createSnapshot(
    checkpointId: string,
    randomSeed: number,
  ): MapRuntimeSnapshot {
    const objectStates = Object.fromEntries(this.objects.entries());
    const activeObjectStates = Object.fromEntries(
      [...this.objects.entries()].map(([id, state]) => [id, state.active]),
    );
    const movedObjectPositions = Object.fromEntries(
      [...this.objects.entries()].map(([id, state]) => [id, { x: state.x, y: state.y }]),
    );

    return {
      checkpointId,
      randomSeed,
      activeObjectStates,
      movedObjectPositions,
      spawnedEntityIds: [...this.spawnedEntityIds],
      firedChainIds: [...this.firedChainIds],
      objectStates,
    };
  }

  public restore(snapshot: MapRuntimeSnapshot): void {
    this.objects.clear();
    for (const [id, state] of Object.entries(snapshot.objectStates)) {
      this.objects.set(id, { ...state });
    }

    this.spawnedEntityIds.clear();
    snapshot.spawnedEntityIds.forEach((id) => this.spawnedEntityIds.add(id));
    this.firedChainIds.clear();
    snapshot.firedChainIds.forEach((id) => this.firedChainIds.add(id));
  }

  public reset(): void {
    this.objects.clear();
    this.spawnedEntityIds.clear();
    this.firedChainIds.clear();

    for (const definition of this.definitions.values()) {
      this.objects.set(definition.id, {
        active: true,
        x: definition.x,
        y: definition.y,
        collision: definition.collision,
        variant: this.resolveVariant(definition),
      });
    }
  }

  private resolveVariant(definition: MapObjectDefinition): string | undefined {
    if (!definition.variantPool || definition.variantPool.length === 0) {
      return undefined;
    }

    const random = definition.seedGroup
      ? this.random.fork(definition.seedGroup)
      : this.random;
    return random.pick(definition.variantPool);
  }
}
