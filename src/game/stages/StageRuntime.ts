import * as Phaser from "phaser";
import { STAGE_IDS, createRuntimeStageState } from "../core/constants";
import type {
  EnemyDefinition,
  MapObjectDefinition,
  PlatformDefinition,
  TrapDefinition,
} from "../core/contentTypes";
import type { MapRuntimeSnapshot } from "../core/runtimeTypes";
import type { ProgressState, RuntimeStageState, StageDefinition } from "../core/types";
import { GameEventBus } from "../bridge/GameEventBus";
import { StageRandom } from "../random/StageRandom";
import { StageEntityFactory, type StageEntity, type StageEntityKind } from "./StageEntityFactory";
import type { LoadedMap } from "../maps/mapTypes";
import { EconomySystem } from "../systems/EconomySystem";

interface RuntimeEntityRecord {
  readonly kind: StageEntityKind;
  readonly id: string;
  readonly entity: StageEntity;
}

export type StageRuntimeStatus =
  | "enter"
  | "play"
  | "paused"
  | "cutscene"
  | "dying"
  | "completed";

export class StageRuntime {
  public readonly definition: StageDefinition;
  public readonly runtimeState: RuntimeStageState;
  private readonly scene: Phaser.Scene;
  private readonly eventBus: GameEventBus;
  private readonly ownsEventBus: boolean;
  private readonly factory: StageEntityFactory;
  private readonly progress?: ProgressState;
  private readonly economy?: EconomySystem;
  private readonly loadedMap: LoadedMap | null;
  private mapSnapshot: MapRuntimeSnapshot | null = null;
  private records: RuntimeEntityRecord[] = [];
  private status: StageRuntimeStatus = "enter";

  public constructor(
    scene: Phaser.Scene,
    definition: StageDefinition,
    runtimeState = createRuntimeStageState(definition.id, 1),
    eventBus?: GameEventBus,
    factory = new StageEntityFactory(),
    progress?: ProgressState,
    loadedMap: LoadedMap | null = null,
  ) {
    this.scene = scene;
    this.definition = definition;
    this.runtimeState = runtimeState;
    this.eventBus = eventBus ?? new GameEventBus();
    this.ownsEventBus = eventBus === undefined;
    this.factory = factory;
    this.progress = progress;
    if (progress) this.economy = new EconomySystem(progress, runtimeState, this.eventBus);
    this.loadedMap = loadedMap;
  }

  public build(): void {
    this.clearEntities();

    if (this.loadedMap) {
      this.buildFromMap();
      return;
    }

    this.buildFromSegments();
  }

  private buildFromSegments(): void {
    const random = new StageRandom(this.runtimeState.randomSeed);
    let segmentOffset = 0;

    for (const segment of this.definition.segments) {
      for (const platform of segment.platforms) {
        this.add("platform", platform.id, this.factory.create(this.scene, {
          kind: "platform",
          definition: this.offsetPlatform(platform, segmentOffset),
        }));
      }

      for (const trap of segment.traps) {
        const resolvedTrap = this.resolveTrap(trap, segmentOffset, random);
        this.add("trap", trap.id, this.factory.create(this.scene, {
          kind: "trap",
          definition: resolvedTrap,
        }));
      }

      for (const enemy of segment.enemies) {
        const resolvedEnemy = this.offsetEnemy(enemy, segmentOffset);
        this.add("enemy", enemy.id, this.factory.create(this.scene, {
          kind: "enemy",
          definition: resolvedEnemy,
        }));
      }

      segment.coins.forEach((coinId, index) => {
        this.add("coin", coinId, this.factory.create(this.scene, {
          kind: "coin",
          id: coinId,
          x: segmentOffset + 180 + index * 72,
          y: 450,
        }));
      });

      segment.collectibles.forEach((collectibleId) => {
        this.add("collectible", collectibleId, this.factory.create(this.scene, {
          kind: "collectible",
          id: collectibleId,
          x: segmentOffset + segment.length - 110,
          y: 430,
        }));
      });

      segmentOffset += segment.length;
    }

    this.addCheckpointAndExit();
  }

  private buildFromMap(): void {
    let hasCheckpoint = false;
    let hasExit = false;

    for (const object of this.loadedMap?.objects ?? []) {
      switch (object.kind) {
        case "trap":
          this.add("trap", object.id, this.factory.create(this.scene, {
            kind: "trap",
            definition: this.toTrapDefinition(object),
          }));
          break;
        case "enemy-spawn":
          if (object.properties.active === false) {
            break;
          }
          this.add("enemy", object.id, this.factory.create(this.scene, {
            kind: "enemy",
            definition: this.toEnemyDefinition(object),
          }));
          break;
        case "collectible":
          if (object.properties.collectibleType === "snack-coin") {
            this.add("coin", object.id, this.factory.create(this.scene, {
              kind: "coin", id: object.id, appearance: "bone",
              x: object.x + object.width / 2, y: object.y + object.height / 2,
            }));
            break;
          }
          this.add("collectible", object.id, this.factory.create(this.scene, {
            kind: "collectible",
            id: object.id,
            x: object.x,
            y: object.y,
          }));
          break;
        case "checkpoint":
          hasCheckpoint = true;
          this.add("checkpoint", object.id, this.factory.create(this.scene, {
            kind: "checkpoint",
            id: object.id,
            x: object.x + object.width / 2,
            y: object.y + object.height / 2,
            height: object.height,
          }));
          break;
        case "exit":
          hasExit = true;
          this.add("exit", object.id, this.factory.create(this.scene, {
            kind: "exit",
            id: object.id,
            x: object.x + object.width / 2,
            y: object.y + object.height / 2,
          }));
          break;
        default:
          break;
      }
    }

    if (!hasCheckpoint && this.definition.kind === "normal") {
      this.addCheckpoint();
    }

    if (!hasExit) {
      this.addExit();
    }
  }

  private addCheckpointAndExit(): void {
    if (this.definition.kind === "normal") {
      this.addCheckpoint();
    }

    this.addExit();
  }

  private addCheckpoint(): void {
    const checkpointId = this.definition.checkpointIds[0];

    if (!checkpointId) {
      return;
    }

    const section = this.definition.map?.sections.find(
      (candidate) => candidate.checkpointId === checkpointId,
    );
    const x = section?.x ?? Math.floor(this.definition.mapWidth / 2);

    this.add("checkpoint", checkpointId, this.factory.create(this.scene, {
      kind: "checkpoint",
      id: checkpointId,
      x,
      y: 460,
    }));
  }

  private addExit(): void {
    this.add("exit", this.definition.id + "-exit", this.factory.create(this.scene, {
      kind: "exit",
      id: this.definition.id + "-exit",
      x: this.definition.mapWidth - 96,
      y: 440,
    }));
  }

  private toTrapDefinition(object: MapObjectDefinition): TrapDefinition {
    const trapKinds: readonly TrapDefinition["kind"][] = [
      "spike",
      "falling-object",
      "false-floor",
      "moving-platform",
      "wind",
      "catapult",
      "juice-slick",
      "camera-flash",
    ];
    const value = object.properties.trapKind;
    const kind = trapKinds.includes(value as TrapDefinition["kind"])
      ? (value as TrapDefinition["kind"])
      : "false-floor";

    return {
      id: object.id,
      kind,
      x: object.x + object.width / 2,
      y: object.y + object.height / 2,
      width: object.width || 64,
      height: object.height || 32,
      trigger: "proximity",
      lethal: object.properties.lethal === true,
      randomized: object.properties.randomized === true,
      telegraph: "map object telegraph",
      effect: "map-chain",
    };
  }

  private toEnemyDefinition(object: MapObjectDefinition): EnemyDefinition {
    const enemyKinds: readonly EnemyDefinition["kind"][] = [
      "stray-cat",
      "alley-cat",
      "junkyard-cat",
      "factory-cat",
      "storm-cat",
      "guard-cat",
    ];
    const value = object.properties.enemyKind;
    const kind = enemyKinds.includes(value as EnemyDefinition["kind"])
      ? (value as EnemyDefinition["kind"])
      : "stray-cat";
    const minX = object.x - 96;
    const maxX = object.x + Math.max(96, object.width);

    return {
      id: object.id,
      kind,
      spawn: { x: object.x, y: object.y },
      patrol: { minX, maxX, speed: 48 },
      health: 2,
      contactDamage: 1,
      canBeStunned: true,
      loot: [],
    };
  }

  public start(): void {
    if (this.status === "completed") {
      return;
    }

    this.status = "play";
    this.eventBus.emit("stage-started", {
      stageId: this.definition.id,
      attempt: this.runtimeState.attempt,
    });
  }

  public restartStage(): void {
    if (this.status === "completed") {
      return;
    }

    this.runtimeState.attempt += 1;
    this.runtimeState.currentStageCoins = 0;
    this.runtimeState.checkpointId = null;
    this.runtimeState.checkpointUsed = false;
    this.runtimeState.checkpointSeed = null;
    this.runtimeState.mapSnapshotVersion = 0;
    this.mapSnapshot = null;
    this.runtimeState.randomSeed = StageRandom.hash(
      this.definition.id + ":" + this.runtimeState.attempt,
    );
    this.status = "enter";
    this.build();
    this.start();
  }

  public restartFromCheckpoint(snapshot = this.mapSnapshot): void {
    if (this.status === "completed") {
      return;
    }

    this.runtimeState.currentStageCoins = 0;
    this.runtimeState.checkpointSeed = this.runtimeState.randomSeed;
    this.mapSnapshot = snapshot;
    this.status = "enter";
    this.build();
    this.start();
    this.eventBus.emit("map-state-restored", {
      stageId: this.definition.id,
      checkpointId: this.runtimeState.checkpointId,
    });
  }

  public restart(): void {
    this.restartStage();
  }

  public setMapSnapshot(snapshot: MapRuntimeSnapshot | null): void {
    this.mapSnapshot = snapshot;
    this.runtimeState.checkpointSeed = snapshot?.randomSeed ?? null;
    this.runtimeState.mapSnapshotVersion += snapshot ? 1 : 0;
  }

  public getMapSnapshot(): MapRuntimeSnapshot | null {
    return this.mapSnapshot;
  }

  public complete(): void {
    if (this.status === "completed") {
      return;
    }

    this.status = "completed";
    if (this.economy) this.economy.commitStageClear();
    else this.runtimeState.currentStageCoins = 0;
    const nextIndex = STAGE_IDS.indexOf(this.definition.id) + 1;
    const nextStageId = STAGE_IDS[nextIndex] ?? null;
    this.eventBus.emit("stage-completed", {
      stageId: this.definition.id,
      nextStageId,
      bankedCoins: this.progress?.bankedCoins ?? 0,
    });
  }

  public pause(): void {
    if (this.status === "play") {
      this.status = "paused";
    }
  }

  public resume(): void {
    if (this.status === "paused") {
      this.status = "play";
    }
  }

  public setStatus(status: StageRuntimeStatus): void {
    this.status = status;
  }

  public getStatus(): StageRuntimeStatus {
    return this.status;
  }

  public getEventBus(): GameEventBus {
    return this.eventBus;
  }

  public getEntities(kind?: StageEntityKind): readonly RuntimeEntityRecord[] {
    return kind
      ? this.records.filter((record) => record.kind === kind)
      : this.records;
  }

  public collectCoin(coinId: string): boolean {
    const record = this.records.find(
      (candidate) => candidate.kind === "coin" && candidate.id === coinId,
    );
    if (!record || !record.entity.active) {
      return false;
    }

    record.entity.setActive(false);
    record.entity.setVisible(false);
    const body = (record.entity as Phaser.GameObjects.Image).body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) body.enable = false;
    if (this.economy) this.economy.collectCoin(this.definition.id);
    else {
      this.runtimeState.currentStageCoins += 1;
      this.emitCoins();
    }
    this.eventBus.emit("coin-collected", { stageId: this.definition.id, coinId });
    return true;
  }

  public resetCoins(): void {
    for (const { entity } of this.getEntities("coin")) {
      entity.setActive(true).setVisible(true);
      const body = (entity as Phaser.GameObjects.Image).body as Phaser.Physics.Arcade.StaticBody | null;
      if (body) body.enable = true;
    }
    this.runtimeState.currentStageCoins = 0;
    this.emitCoins();
  }

  private emitCoins(): void {
    this.eventBus.emit("coin-changed", {
      stageId: this.definition.id,
      currentStageCoins: this.runtimeState.currentStageCoins,
      bankedCoins: this.progress?.bankedCoins ?? 0,
    });
  }

  public destroy(): void {
    this.clearEntities();
    if (this.ownsEventBus) this.eventBus.clear();
  }

  private add(kind: StageEntityKind, id: string, entity: StageEntity): void {
    this.records.push({ kind, id, entity });
  }

  private clearEntities(): void {
    for (const record of this.records) {
      record.entity.destroy();
    }
    this.records = [];
  }

  private resolveTrap(
    trap: TrapDefinition,
    segmentOffset: number,
    random: StageRandom,
  ): TrapDefinition {
    const offset = trap.randomized ? random.offset([-64, 0, 64]) : 0;
    return {
      ...trap,
      x: trap.x + segmentOffset + offset,
      randomized: false,
    };
  }

  private offsetPlatform(
    platform: PlatformDefinition,
    segmentOffset: number,
  ): PlatformDefinition {
    return { ...platform, x: platform.x + segmentOffset };
  }

  private offsetEnemy(
    enemy: EnemyDefinition,
    segmentOffset: number,
  ): EnemyDefinition {
    return {
      ...enemy,
      spawn: { ...enemy.spawn, x: enemy.spawn.x + segmentOffset },
      patrol: {
        ...enemy.patrol,
        minX: enemy.patrol.minX + segmentOffset,
        maxX: enemy.patrol.maxX + segmentOffset,
      },
    };
  }
}
