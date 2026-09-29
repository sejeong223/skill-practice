import * as Phaser from "phaser";
import { GAME_HEIGHT } from "../config";
import {
  createDefaultProgressState,
  createRuntimeStageState,
  getNextStageId,
} from "../core/constants";
import type { ProgressState, StageId } from "../core/types";
import { GameEventBus } from "../bridge/GameEventBus";
import { CameraDirector } from "../camera/CameraDirector";
import { CutsceneDirector } from "../cutscenes/CutsceneDirector";
import { CUTSCENE_SCRIPTS } from "../data/cutscenes";
import { TOOL_DEFINITIONS } from "../data/tools";
import { SKILL_DEFINITIONS } from "../data/skills";
import { GameplayEventBus } from "../core/events";
import { getStageDefinition, getWorldMapTheme } from "../data";
import { getWorld01StageTheme } from "../data/worldMaps";
import type { StageDefinition } from "../core/types";
import type { EnemyDefinition } from "../core/contentTypes";
import { MapDebugOverlay } from "../debug/MapDebugOverlay";
import { Enemy } from "../entities/Enemy";
import { Player } from "../entities/Player";
import { PlayerAnimator } from "../entities/PlayerAnimator";
import { DEFAULT_PLAYER_TUNING } from "../entities/playerTypes";
import { InputManager, toKeybindMap } from "../input/InputManager";
import { ParallaxRenderer } from "../maps/ParallaxRenderer";
import { MapInteractionSystem } from "../maps/MapInteractionSystem";
import { TiledMapLoader } from "../maps/TiledMapLoader";
import type { LoadedMap } from "../maps/mapTypes";
import { StageRandom } from "../random/StageRandom";
import { StageBuilder } from "../stages/StageBuilder";
import { StageRuntime } from "../stages/StageRuntime";
import { CheckpointSystem } from "../systems/CheckpointSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { DeathSystem } from "../systems/DeathSystem";
import { DefenseToolSystem } from "../systems/DefenseToolSystem";
import { MapGimmickSystem } from "../systems/MapGimmickSystem";
import { PlayerController } from "../systems/PlayerController";
import { RestartController } from "../systems/RestartController";
import { SkillSystem } from "../systems/SkillSystem";
import { StrayDogEvent } from "../systems/StrayDogEvent";
import { World01CalicoBoss } from "../systems/World01CalicoBoss";

export interface StageSceneData {
  readonly stageId?: StageId;
  readonly seed?: number;
  readonly playerName?: string;
  readonly resumeCheckpointId?: string;
}

export class StageScene extends Phaser.Scene {
  private player?: Player;
  private playerAnimator?: PlayerAnimator;
  private inputManager?: InputManager;
  private playerController?: PlayerController;
  private cameraDirector?: CameraDirector;
  private runtime?: StageRuntime;
  private loadedMap?: LoadedMap | null;
  private parallaxRenderer?: ParallaxRenderer;
  private eventBus?: GameEventBus;
  private gameplayEventBus?: GameplayEventBus;
  private mapInteraction?: MapInteractionSystem;
  private gimmickSystem?: MapGimmickSystem;
  private checkpointSystem?: CheckpointSystem;
  private restartController?: RestartController;
  private deathSystem?: DeathSystem;
  private progress = createDefaultProgressState();
  private unsubscribeKeybinds?: () => void;
  private readonly eventUnsubscribers: Array<() => void> = [];
  private persistenceEventBus?: GameEventBus;
  private readonly mapEnemies = new Map<string, Enemy>();
  private debugOverlay?: MapDebugOverlay;
  private cutsceneDirector?: CutsceneDirector;
  private calicoSprite?: Phaser.GameObjects.Sprite;
  private calicoBoss?: World01CalicoBoss;
  private victorySequenceStarted = false;
  private stageTransitionStarted = false;
  private combatSystem?: CombatSystem;
  private skillSystem?: SkillSystem;
  private defenseToolSystem?: DefenseToolSystem;
  private strayDogEvent?: StrayDogEvent;
  private stageBackdrop?: Phaser.GameObjects.Rectangle;
  private stageReviewKey?: Phaser.Input.Keyboard.Key;
  private overviewKey?: Phaser.Input.Keyboard.Key;
  private mapOverview = false;
  private stageId: StageId = "world-01-stage-1";
  private stageDefinition?: StageDefinition;
  private activeSectionId?: string;

  public constructor() {
    super("StageScene");
  }

  public create(data: StageSceneData = {}): void {
    this.stageId = data.stageId ?? "world-01-stage-1";
    this.victorySequenceStarted = false;
    this.stageTransitionStarted = false;
    this.mapOverview = false;
    const stage = getStageDefinition(this.stageId);
    this.stageDefinition = stage;
    const registeredProgress = this.registry.get("progressState") as ProgressState | undefined;
    this.progress = registeredProgress ?? createDefaultProgressState(data.playerName);
    if (data.playerName) this.progress.playerName = data.playerName;
    if (stage.id === "world-01-stage-boss") {
      this.progress.equippedAttackToolId = "rabbit-slipper";
      this.progress.equippedDefenseToolId = "upside-down-bowl";
    }
    const theme = getWorld01StageTheme(stage.id, getWorldMapTheme(stage.worldId));
    const seed = data.seed ?? 1;
    const sharedEventBus = this.registry.get("gameEventBus");
    this.persistenceEventBus = sharedEventBus instanceof GameEventBus
      ? sharedEventBus
      : undefined;
    this.eventBus = this.persistenceEventBus ?? new GameEventBus();
    this.physics.world.setBounds(0, 0, stage.mapWidth, stage.mapHeight);
    this.stageBackdrop = this.add
      .rectangle(stage.mapWidth / 2, GAME_HEIGHT / 2, stage.mapWidth, GAME_HEIGHT, 0xf5e7c7)
      .setDepth(-40);
    this.parallaxRenderer = new ParallaxRenderer(this);
    this.parallaxRenderer.render(theme, stage.mapWidth, stage.mapHeight);

    this.player = new Player(
      this, stage.spawn.x, stage.spawn.y, "corgi-run",
      stage.worldId === "world-01" ? 48 : 72,
    );
    this.player.setDepth(10);
    this.playerAnimator = new PlayerAnimator(this.player);
    this.inputManager = new InputManager(this, toKeybindMap(this.progress.keybinds));
    this.playerController = new PlayerController(
      this.player,
      this.inputManager,
      DEFAULT_PLAYER_TUNING,
    );
    const runtimeState = createRuntimeStageState(stage.id, seed);
    this.loadedMap = TiledMapLoader.load(this, stage, theme);
    this.runtime = new StageBuilder(undefined, this.eventBus, this.progress).build(
      this,
      stage,
      seed,
      runtimeState,
      this.loadedMap,
    );
    this.gameplayEventBus = new GameplayEventBus();
    this.skillSystem = new SkillSystem(
      this.player, SKILL_DEFINITIONS, this.gameplayEventBus,
      this.persistenceEventBus, this.progress.unlockedSkills,
    );
    this.unsubscribeKeybinds = this.persistenceEventBus?.on("keybinds-changed", (payload) => {
      this.inputManager?.setKeybinds(toKeybindMap(payload.keybinds));
    });
    this.mapInteraction = new MapInteractionSystem(
      this,
      this.player,
      this.gameplayEventBus,
      stage.id,
      new StageRandom(this.runtime!.runtimeState.randomSeed),
      this.loadedMap,
      () => this.runtime?.runtimeState.checkpointId ?? null,
    );
    const map = stage.map;
    if (map) {
      this.gimmickSystem = new MapGimmickSystem(
        this,
        this.player,
        this.inputManager,
        stage,
        map,
        this.gameplayEventBus,
        this.mapInteraction,
        this.loadedMap,
        data.playerName ?? this.progress.playerName,
        () => this.runtime?.runtimeState.checkpointId ?? null,
      );
    }
    this.checkpointSystem = new CheckpointSystem(
      this.player,
      this.gameplayEventBus,
      stage.id,
      this.runtime.runtimeState,
      (checkpointId) => {
        const snapshot = this.mapInteraction?.createSnapshot(
          checkpointId,
          this.gimmickSystem?.getSnapshotStates(),
        ) ?? null;
        this.runtime?.setMapSnapshot(snapshot);
        return snapshot;
      },
      (checkpointId) => map?.objectDefinitions.some(
        (object) => object.id === checkpointId && object.properties.fakeCheckpoint === true,
      ) ?? false,
    );
    this.restartController = new RestartController(
      this.player,
      this.checkpointSystem,
      { ...stage.spawn, facing: 1 },
      stage.id,
      this.runtime.runtimeState,
      this.gameplayEventBus,
      undefined,
      (snapshot) => {
        this.mapInteraction?.reset(snapshot?.mapSnapshot ?? null);
        this.gimmickSystem?.reset(snapshot?.mapSnapshot ?? null);
      },
    );
    this.deathSystem = new DeathSystem(
      this.progress,
      this.runtime.runtimeState,
      this.restartController,
      this.gameplayEventBus,
      this.persistenceEventBus,
    );

    if (process.env.NODE_ENV !== "production") {
      this.debugOverlay = new MapDebugOverlay(
        this,
        stage,
        this.runtime,
        this.player,
        this.mapInteraction,
        this.loadedMap,
        () => this.gimmickSystem?.getDebugState() ?? {
          gimmickId: "none",
          status: "armed",
          counterpresses: 0,
          lastOutcome: "none",
        },
      );
    }

    const gameplayLayer = this.loadedMap?.layers.gameplay;
    if (gameplayLayer) {
      this.physics.add.collider(this.player, gameplayLayer);
    }

    for (const record of this.runtime.getEntities("platform")) {
      this.physics.add.collider(this.player, record.entity as Phaser.GameObjects.GameObject);
    }
    for (const record of this.runtime.getEntities("coin")) {
      this.physics.add.overlap(
        this.player,
        record.entity as Phaser.GameObjects.GameObject,
        () => this.runtime?.collectCoin(record.id),
      );
    }
    for (const record of this.runtime.getEntities("checkpoint")) {
      this.physics.add.overlap(
        this.player,
        record.entity as Phaser.GameObjects.GameObject,
        () => this.activateCheckpoint(record.id),
      );
    }
    for (const record of this.runtime.getEntities("exit")) {
      this.physics.add.overlap(
        this.player,
        record.entity as Phaser.GameObjects.GameObject,
        () => {
          if (stage.id === "world-01-stage-boss") return;
          this.runtime?.complete();
        },
      );
    }

    this.gameplayEventBus.on("map-object-state-changed", (payload) => {
      const object = this.loadedMap?.objects.find((candidate) => candidate.id === payload.objectId);
      if (object?.kind !== "enemy-spawn") return;
      if (payload.active) this.spawnMapEnemy(object, payload.x, payload.y);
      else this.destroyMapEnemy(payload.objectId);
    });
    this.gameplayEventBus.on("map-reset", () => this.restoreMapEnemies());
    this.cameraDirector = new CameraDirector(this, this.player, stage);
    this.cameraDirector.followPlayer();
    this.syncSectionCamera();
    if (data.resumeCheckpointId) {
      if (stage.id !== "world-01-stage-4") throw new Error("보스 재시작 체크포인트는 4단계에서만 사용합니다.");
      const save = map?.objectDefinitions.find((object) => object.id === data.resumeCheckpointId && object.kind === "checkpoint");
      if (!save) throw new Error("4단계 마지막 체크포인트를 찾을 수 없습니다: " + data.resumeCheckpointId);
      this.player.setPosition(save.x + 40, save.y + save.height);
      this.checkpointSystem.activate(data.resumeCheckpointId, this.player.x, this.player.y, 1, this.time.now);
    }
    this.runtime.start();
    if (data.resumeCheckpointId) {
      this.eventBus.emit("checkpoint-activated", {
        stageId: stage.id,
        checkpointId: data.resumeCheckpointId,
      });
    }
    if (stage.id === "world-01-stage-boss") {
      this.calicoSprite = this.add.sprite(1280, 472, "world-01-calico-boss", 0)
        .setDepth(10)
        .setFlipX(true);
      this.combatSystem = new CombatSystem(this.player, this.gameplayEventBus, TOOL_DEFINITIONS);
      this.combatSystem.setAttackTool("rabbit-slipper");
      this.defenseToolSystem = new DefenseToolSystem(this.gameplayEventBus, TOOL_DEFINITIONS);
      this.strayDogEvent = new StrayDogEvent(this.gameplayEventBus, () => ({
        x: this.player!.x, y: this.player!.y - 20,
      }));
      this.calicoBoss = new World01CalicoBoss(
        this, this.player, this.calicoSprite, this.defenseToolSystem,
        this.strayDogEvent, this.gameplayEventBus,
        (remaining) => this.eventBus?.emit("boss-hearts-changed", {
          stageId: "world-01-stage-boss", remaining,
        }),
        () => { void this.handleCalicoDefeat(); },
        (now) => this.handleCalicoThirdHit(now),
      );
      this.cutsceneDirector = new CutsceneDirector(
        this, this.player, this.progress, CUTSCENE_SCRIPTS, this.eventBus, this.cameraDirector,
      );
      this.eventUnsubscribers.push(
        this.eventBus.on("cutscene-skip-requested", () => this.cutsceneDirector?.skip()),
        this.eventBus.on("cutscene-advance-requested", () => this.cutsceneDirector?.advance()),
        this.eventBus.on("cutscene-beat", ({ cutsceneId, index }) => {
          if (cutsceneId === "world-01-boss-clear" && index === 7) {
            this.calicoBoss?.showCollapseFrame();
          }
        }),
      );
      this.runtime.setStatus("cutscene");
      if (!this.progress.seenCutsceneIds.includes("world-01-boss-intro")) {
        this.cameras.main.setZoom(0.8);
        void this.cutsceneDirector.play("world-01-boss-intro").then(() => {
          this.cameras.main.setZoom(1);
          if (this.scene.isActive() && this.runtime?.getStatus() === "cutscene") {
            this.runtime.setStatus("play");
          }
        });
      } else {
        const cue = this.add.text(640, 250, "삼색이와 다시 대결!", {
          color: "#f7ce69", fontFamily: "Galmuri11Pixel, monospace", fontSize: "30px",
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        this.time.delayedCall(900, () => {
          cue.destroy();
          if (this.scene.isActive() && this.runtime?.getStatus() === "cutscene") {
            this.runtime.setStatus("play");
          }
        });
      }
    }
    this.runtime.getEventBus().on("map-state-restored", () => {
      const snapshot = this.runtime?.getMapSnapshot() ?? null;
      this.mapInteraction?.reset(snapshot);
      this.gimmickSystem?.reset(snapshot);
    });
    this.eventUnsubscribers.push(this.eventBus.on("stage-completed", ({ stageId }) => {
      if (stageId !== this.stageId || this.stageTransitionStarted) return;
      this.runtime?.setStatus("completed");
      if (stageId === "world-01-stage-boss") return;
      const nextStageId = getNextStageId(stageId);
      if (!nextStageId) return;
      this.stageTransitionStarted = true;
      this.add.text(this.cameras.main.centerX, 255, "STAGE CLEAR!", {
        color: "#FFD34D", fontFamily: "Galmuri11Pixel, monospace", fontSize: "42px",
        stroke: "#543b1d", strokeThickness: 6,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
      this.time.delayedCall(700, () => {
        if (!this.scene.isActive()) return;
        this.scene.start("StageScene", {
          stageId: nextStageId,
          seed: this.runtime?.runtimeState.randomSeed ?? 1,
          playerName: this.progress.playerName,
        } satisfies StageSceneData);
      });
    }));
    this.eventUnsubscribers.push(this.eventBus.on("pause-requested", ({ paused }) => {
      this.setPaused(paused);
    }));

    if (process.env.NODE_ENV !== "production" && this.input.keyboard) {
      this.stageReviewKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F2);
      this.stageReviewKey.on("down", this.reviewNextWorld01Stage, this);
      this.overviewKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
      this.overviewKey.on("down", this.toggleMapOverview, this);
    }

    this.events.once("shutdown", () => {
      this.inputManager?.destroy();
      this.stageReviewKey?.off("down", this.reviewNextWorld01Stage, this);
      if (this.stageReviewKey) this.input.keyboard?.removeKey(this.stageReviewKey, true);
      this.overviewKey?.off("down", this.toggleMapOverview, this);
      if (this.overviewKey) this.input.keyboard?.removeKey(this.overviewKey, true);
      this.unsubscribeKeybinds?.();
      this.eventUnsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
      this.debugOverlay?.destroy();
      this.calicoBoss?.destroy();
      this.calicoBoss = undefined;
      this.strayDogEvent?.destroy();
      this.strayDogEvent = undefined;
      this.combatSystem?.resetForStage();
      this.combatSystem = undefined;
      this.skillSystem = undefined;
      this.defenseToolSystem = undefined;
      this.cutsceneDirector?.destroy();
      this.cutsceneDirector = undefined;
      this.calicoSprite?.destroy();
      this.calicoSprite = undefined;
      this.mapInteraction?.destroy();
      this.gimmickSystem?.destroy();
      this.deathSystem?.destroy();
      this.checkpointSystem?.resetForStage();
      this.clearMapEnemies();
      this.runtime?.destroy();
      this.loadedMap?.destroy();
      this.parallaxRenderer?.destroy();
      this.gameplayEventBus?.clear();
      if (!this.persistenceEventBus) this.eventBus?.clear();
    });
  }

  public update(time: number, delta: number): void {
    const input = this.inputManager?.getSnapshot();
    if (input?.pausePressed) {
      this.setPaused(this.runtime?.getStatus() !== "paused");
    }
    if (this.runtime?.getStatus() !== "play") {
      return;
    }
    this.playerController?.update(time, delta);
    this.playerAnimator?.update();
    if (input?.barkPressed && this.progress.unlockedSkills.includes("bark")) {
      this.skillSystem?.use("bark", time);
    }
    if (this.calicoBoss && this.player && this.combatSystem) {
      this.calicoBoss.start(time);
      this.combatSystem.update(time);
      if (input?.attackPressed) {
        const result = this.combatSystem.tryAttack(time);
        this.calicoBoss.acceptMeleeHit(result, this.player);
      }
      this.calicoBoss.update(time, delta);
    }
    this.gimmickSystem?.update(time, delta);
    this.mapInteraction?.update(time, delta);
    for (const enemy of this.mapEnemies.values()) enemy.updateMovement(time);
    this.debugOverlay?.update();
    this.syncSectionCamera();
  }

  private async handleCalicoDefeat(): Promise<void> {
    if (this.victorySequenceStarted || !this.calicoBoss?.isDefeated()) return;
    this.victorySequenceStarted = true;
    this.calicoBoss.stopAttacks();
    this.runtime?.setStatus("cutscene");
    await this.cutsceneDirector?.play("world-01-boss-clear");
    if (!this.scene.isActive() || !this.calicoBoss?.isDefeated()) return;
    if (!this.progress.unlockedSkills.includes("bark")) {
      this.progress.unlockedSkills.push("bark");
      this.skillSystem?.unlockAfterBoss("world-01-boss");
    }
    this.runtime?.complete();
    this.scene.start("World01StageClearScene", {
      stageId: "world-01-stage-boss",
      nextStageId: "world-02-stage-1",
    });
  }

  private handleCalicoThirdHit(now: number): void {
    this.gameplayEventBus?.emit("death-requested", {
      stageId: "world-01-stage-boss",
      cause: "enemy",
      checkpointId: null,
      now,
    });
    this.runtime?.setStatus("dying");
    this.time.delayedCall(900, () => {
      if (!this.scene.isActive()) return;
      this.scene.start("StageScene", {
        stageId: "world-01-stage-4",
        resumeCheckpointId: "world-01-stage-4-checkpoint",
        playerName: this.progress.playerName,
      } satisfies StageSceneData);
    });
  }

  private setPaused(paused: boolean): void {
    const runtime = this.runtime;
    if (!runtime) return;

    if (paused && runtime.getStatus() === "play") {
      runtime.pause();
      this.physics.world.pause();
    } else if (!paused && runtime.getStatus() === "paused") {
      runtime.resume();
      this.physics.world.resume();
    }

    this.eventBus?.emit("pause-state-changed", {
      paused: runtime.getStatus() === "paused",
    });
  }

  private activateCheckpoint(checkpointId: string): void {
    if (
      this.runtime?.getStatus() !== "play" ||
      !this.player ||
      !this.checkpointSystem
    ) {
      return;
    }
    this.mapInteraction?.triggerObject(checkpointId, "checkpoint-reached");
    const activated = this.checkpointSystem.activate(
      checkpointId,
      this.player.x,
      this.player.y,
      this.player.flipX ? -1 : 1,
      this.time.now,
    );
    if (!activated) return;
    this.eventBus?.emit("checkpoint-activated", {
      stageId: this.stageId,
      checkpointId,
    });
  }

  private spawnMapEnemy(
    object: NonNullable<LoadedMap["objects"][number]>,
    x: number,
    y: number,
  ): void {
    if (!this.player || this.mapEnemies.has(object.id)) return;
    const enemyKinds: readonly EnemyDefinition["kind"][] = [
      "stray-cat",
      "alley-cat",
      "junkyard-cat",
      "factory-cat",
      "storm-cat",
      "guard-cat",
    ];
    const requestedKind = object.properties.enemyKind;
    const kind = enemyKinds.includes(requestedKind as EnemyDefinition["kind"])
      ? requestedKind as EnemyDefinition["kind"]
      : "stray-cat";
    const numberProperty = (key: string, fallback: number): number =>
      typeof object.properties[key] === "number" ? object.properties[key] as number : fallback;
    const enemy = new Enemy(this, {
      id: object.id,
      kind,
      spawn: { x: x + object.width / 2, y: y + object.height / 2 },
      patrol: {
        minX: numberProperty("patrolMinX", x - 96),
        maxX: numberProperty("patrolMaxX", x + 144),
        speed: numberProperty("patrolSpeed", 48),
      },
      health: numberProperty("health", 2),
      contactDamage: numberProperty("contactDamage", 1),
      canBeStunned: true,
      loot: [],
    });
    this.mapEnemies.set(object.id, enemy);
    this.physics.add.overlap(this.player, enemy, () => {
      if (!enemy.active) return;
      this.gameplayEventBus?.emit("death-requested", {
        stageId: this.stageId,
        cause: "enemy",
        checkpointId: this.runtime?.runtimeState.checkpointId ?? null,
        now: this.time.now,
      });
    });
  }

  private destroyMapEnemy(objectId: string): void {
    const enemy = this.mapEnemies.get(objectId);
    enemy?.destroy();
    this.mapEnemies.delete(objectId);
  }

  private clearMapEnemies(): void {
    for (const enemy of this.mapEnemies.values()) enemy.destroy();
    this.mapEnemies.clear();
  }

  private restoreMapEnemies(): void {
    this.clearMapEnemies();
    for (const object of this.loadedMap?.objects ?? []) {
      if (object.kind !== "enemy-spawn") continue;
      if (this.mapInteraction?.getObjectState(object.id)?.active) {
        const state = this.mapInteraction.getObjectState(object.id);
        this.spawnMapEnemy(object, state?.x ?? object.x, state?.y ?? object.y);
      }
    }
  }

  private syncSectionCamera(): void {
    if (!this.cameraDirector || !this.player) {
      return;
    }

    const sections = this.stageDefinition?.map?.sections ?? [];
    const section = sections.find(
      (candidate) =>
        this.player!.x >= candidate.x &&
        this.player!.x < candidate.x + candidate.width,
    );

    if (section?.id === this.activeSectionId) {
      return;
    }

    this.activeSectionId = section?.id;
    this.cameraDirector.setSectionMode(section);
  }

  private reviewNextWorld01Stage(): void {
    const stages: readonly StageId[] = [
      "world-01-stage-1",
      "world-01-stage-2",
      "world-01-stage-3",
      "world-01-stage-4",
    ];
    const currentIndex = stages.indexOf(this.stageId);
    if (currentIndex < 0) return;
    const nextStageId = stages[(currentIndex + 1) % stages.length];
    this.scene.restart({
      stageId: nextStageId,
      seed: this.runtime?.runtimeState.randomSeed ?? 1,
      playerName: this.progress.playerName,
    });
  }

  private toggleMapOverview(): void {
    if (!this.stageDefinition || this.stageDefinition.worldId !== "world-01") return;
    this.mapOverview = !this.mapOverview;
    if (this.mapOverview) {
      this.cameraDirector?.pauseFollow();
      this.parallaxRenderer?.setOverview(true);
      const skyColor = Phaser.Display.Color.HexStringToColor(
        getWorldMapTheme(this.stageDefinition.worldId).palette.far,
      ).color;
      this.stageBackdrop?.setFillStyle(skyColor);
      this.cameras.main.setBackgroundColor(skyColor);
      this.cameras.main.setZoom(this.cameras.main.width / this.stageDefinition.mapWidth);
      this.cameras.main.centerOn(
        this.stageDefinition.mapWidth / 2,
        this.stageDefinition.mapHeight / 2,
      );
      return;
    }
    this.cameras.main.setZoom(1);
    this.parallaxRenderer?.setOverview(false);
    this.stageBackdrop?.setFillStyle(0xf5e7c7);
    this.cameras.main.setBackgroundColor(0xf5e7c7);
    this.cameraDirector?.followPlayer();
  }
}
