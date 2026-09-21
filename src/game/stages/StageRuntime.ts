import * as Phaser from "phaser";
import { STAGE_IDS, createRuntimeStageState } from "../core/constants";
import type { EnemyDefinition, PlatformDefinition, TrapDefinition } from "../core/contentTypes";
import type { MapRuntimeSnapshot } from "../core/runtimeTypes";
import type { ProgressState, RuntimeStageState, StageDefinition } from "../core/types";
import { GameEventBus } from "../bridge/GameEventBus";
import { StageRandom } from "../random/StageRandom";
import { StageEntityFactory, type StageEntity, type StageEntityKind } from "./StageEntityFactory";

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
  private readonly factory: StageEntityFactory;
  private readonly progress?: ProgressState;
  private mapSnapshot: MapRuntimeSnapshot | null = null;
  private records: RuntimeEntityRecord[] = [];
  private status: StageRuntimeStatus = "enter";

  public constructor(
    scene: Phaser.Scene,
    definition: StageDefinition,
    runtimeState = createRuntimeStageState(definition.id, 1),
    eventBus = new GameEventBus(),
    factory = new StageEntityFactory(),
    progress?: ProgressState,
  ) {
    this.scene = scene;
    this.definition = definition;
    this.runtimeState = runtimeState;
    this.eventBus = eventBus;
    this.factory = factory;
    this.progress = progress;
  }

  public build(): void {
    this.clearEntities();
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

    const checkpointId = this.definition.checkpointIds[0];
    if (checkpointId) {
      this.add("checkpoint", checkpointId, this.factory.create(this.scene, {
        kind: "checkpoint",
        id: checkpointId,
        x: Math.floor(this.definition.mapWidth / 2),
        y: 460,
      }));
    }

    this.add("exit", this.definition.id + "-exit", this.factory.create(this.scene, {
      kind: "exit",
      id: this.definition.id + "-exit",
      x: this.definition.mapWidth - 96,
      y: 440,
    }));
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
    if (this.progress) {
      this.progress.bankedCoins += this.runtimeState.currentStageCoins;
    }
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
    this.runtimeState.currentStageCoins += 1;
    this.eventBus.emit("coin-changed", {
      stageId: this.definition.id,
      currentStageCoins: this.runtimeState.currentStageCoins,
      bankedCoins: this.progress?.bankedCoins ?? 0,
    });
    return true;
  }

  public destroy(): void {
    this.clearEntities();
    this.eventBus.clear();
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
