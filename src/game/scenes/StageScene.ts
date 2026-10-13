import * as Phaser from "phaser";
import { GAME_HEIGHT } from "../config";
import {
  createDefaultProgressState,
  createRuntimeStageState,
  getNextStageId,
} from "../core/constants";
import type { ProgressState, StageId } from "../core/types";
import type { CheckpointSnapshot } from "../core/runtimeTypes";
import { GameEventBus } from "../bridge/GameEventBus";
import { CameraDirector } from "../camera/CameraDirector";
import { AudioManager } from "../audio/AudioManager";
import { getStageMusicKey } from "../audio/stageMusic";
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
import { BowlShieldVisual } from "../entities/BowlShieldVisual";
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
import { getWorld01Respawn, isWorld01CheckpointStageId } from "../systems/world01Respawn";

const NORMAL_EXIT_RUNOUT = 256;
const WORLD01_CHECKPOINT_SNAPSHOT_KEY = "world01CheckpointSnapshot";

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
  private bossGround?: Phaser.Tilemaps.Tilemap;
  private exitFloor?: Phaser.GameObjects.Rectangle;
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
  private bowlShieldVisual?: BowlShieldVisual;
  private audioManager?: AudioManager;
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
    this.activeSectionId = undefined;
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
    const savedCheckpoint = this.registry.get(WORLD01_CHECKPOINT_SNAPSHOT_KEY) as CheckpointSnapshot | undefined;
    const seed = data.seed ?? (savedCheckpoint?.stageId === stage.id &&
      savedCheckpoint.checkpointId === data.resumeCheckpointId ? savedCheckpoint.randomSeed : undefined) ?? 1;
    const sharedEventBus = this.registry.get("gameEventBus");
    this.persistenceEventBus = sharedEventBus instanceof GameEventBus
      ? sharedEventBus
      : undefined;
    this.eventBus = this.persistenceEventBus ?? new GameEventBus();
    // Keep camera bounds at the map edge, but allow the corgi to walk fully out.
    this.physics.world.setBounds(0, 0, stage.mapWidth + (stage.kind === "normal" ? NORMAL_EXIT_RUNOUT : 0), stage.mapHeight);
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
    this.audioManager = new AudioManager(this, this.gameplayEventBus, this.eventBus);
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
        this.runtime?.resetCoins();
      },
      () => this.restartAtWorldCheckpoint(),
    );
    this.deathSystem = new DeathSystem(
      this.progress,
      this.runtime.runtimeState,
      this.restartController,
      this.gameplayEventBus,
      this.persistenceEventBus,
      () => this.runtime?.getStatus() === "play",
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

    const gameplayLayer = this.loadedMap?.layers.gameplay
      ?? (stage.id === "world-01-stage-boss" ? this.createBossGround(stage) : undefined);
    if (gameplayLayer) {
      this.physics.add.collider(this.player, gameplayLayer);
    }

    for (const record of this.runtime.getEntities("platform")) {
      if (this.bossGround) {
        record.entity.setVisible(false);
        continue;
      }
      this.physics.add.collider(this.player, record.entity as Phaser.GameObjects.GameObject);
    }
    this.createExitFloor(stage, gameplayLayer);
    for (const record of this.runtime.getEntities("coin")) {
      this.physics.add.overlap(
        this.player,
        record.entity as Phaser.GameObjects.GameObject,
        () => {
          if (this.runtime?.getStatus() === "play") this.runtime.collectCoin(record.id);
        },
      );
    }
    for (const record of this.runtime.getEntities("checkpoint")) {
      this.physics.add.overlap(
        this.player,
        record.entity as Phaser.GameObjects.GameObject,
        () => this.activateCheckpoint(record.id),
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
      this.restoreCheckpoint(data.resumeCheckpointId);
    }
    this.runtime.start();
    this.eventBus.emit("pause-state-changed", { paused: false });
    if (data.resumeCheckpointId) {
      this.eventBus.emit("checkpoint-activated", {
        stageId: stage.id,
        checkpointId: data.resumeCheckpointId,
      });
    }
    if (stage.id === "world-01-stage-boss") {
      this.calicoSprite = this.add.sprite(1280, 472, "world-01-calico-boss", 0)
        .setDepth(10);
      this.combatSystem = new CombatSystem(this.player, this.gameplayEventBus, TOOL_DEFINITIONS);
      this.combatSystem.setAttackTool("rabbit-slipper");
      this.defenseToolSystem = new DefenseToolSystem(this.gameplayEventBus, TOOL_DEFINITIONS);
      this.bowlShieldVisual = new BowlShieldVisual(this, this.player, this.defenseToolSystem, this.gameplayEventBus);
      this.strayDogEvent = new StrayDogEvent(this.gameplayEventBus, () => ({
        x: this.player!.x, y: this.player!.y - 20,
      }), { count: 5 });
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
        this, this.player, this.progress, CUTSCENE_SCRIPTS, this.eventBus, this.cameraDirector, this.audioManager,
      );
      this.eventUnsubscribers.push(
        this.eventBus.on("cutscene-skip-requested", () => this.cutsceneDirector?.skip()),
        this.eventBus.on("cutscene-advance-requested", () => this.cutsceneDirector?.advance()),
        this.eventBus.on("cutscene-beat", ({ cutsceneId, beat, index }) => {
          if (cutsceneId === "world-01-boss-intro" || cutsceneId === "world-01-boss-clear") {
            const speaker = beat.dialogue?.[0]?.speaker;
            const actor = speaker === "calico" ? this.calicoSprite : speaker === "corgi" ? this.player : undefined;
            if (actor) this.cameraDirector?.focusDialogue(actor.x, stage.mapHeight / 2, index === 0);
          }
        }),
      );
      this.runtime.setStatus("cutscene");
      if (!this.progress.seenCutsceneIds.includes("world-01-boss-intro")) {
        void this.cutsceneDirector.play("world-01-boss-intro").then(() => {
          if (this.scene.isActive() && this.runtime?.getStatus() === "cutscene") {
            this.runtime.setStatus("play");
            this.audioManager?.playMusic(getStageMusicKey(stage.id));
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
      this.runtime?.resetCoins();
    });
    this.eventUnsubscribers.push(this.eventBus.on("stage-completed", ({ stageId }) => {
      if (stageId !== this.stageId || this.stageTransitionStarted) return;
      this.runtime?.setStatus("completed");
      if (stageId === "world-01-stage-boss") return;
      const nextStageId = getNextStageId(stageId);
      if (!nextStageId) return;
      this.stageTransitionStarted = true;
      this.time.delayedCall(180, () => {
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
      this.eventBus?.emit("pause-state-changed", { paused: false });
      this.inputManager?.destroy();
      this.playerAnimator?.destroy();
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
      this.bowlShieldVisual?.destroy();
      this.bowlShieldVisual = undefined;
      this.cutsceneDirector?.destroy();
      this.cutsceneDirector = undefined;
      this.audioManager?.destroy();
      this.audioManager = undefined;
      this.calicoSprite?.destroy();
      this.calicoSprite = undefined;
      this.mapInteraction?.destroy();
      this.gimmickSystem?.destroy();
      this.deathSystem?.destroy();
      this.checkpointSystem?.resetForStage();
      this.clearMapEnemies();
      this.runtime?.destroy();
      this.loadedMap?.destroy();
      this.bossGround?.destroy();
      this.bossGround = undefined;
      this.exitFloor?.destroy();
      this.exitFloor = undefined;
      this.parallaxRenderer?.destroy();
      this.gameplayEventBus?.clear();
      if (!this.persistenceEventBus) this.eventBus?.clear();
    });
  }

  private createExitFloor(stage: StageDefinition, gameplayLayer?: Phaser.Tilemaps.TilemapLayer): void {
    if (stage.kind !== "normal" || !this.player) return;

    let floorY: number | undefined;
    if (gameplayLayer) {
      const lastColumn = gameplayLayer.layer.width - 1;
      const tile = gameplayLayer.getTilesWithin(
        lastColumn, 0, 1, gameplayLayer.layer.height, { isColliding: true },
      )[0];
      floorY = tile?.getTop();
    } else {
      const platforms = this.runtime?.getEntities("platform") ?? [];
      const lastPlatform = platforms
        .map(({ entity }) => (entity as Phaser.GameObjects.Rectangle).getBounds())
        .sort((a, b) => b.right - a.right)[0];
      if (lastPlatform && lastPlatform.left <= stage.mapWidth && lastPlatform.right >= stage.mapWidth) {
        floorY = lastPlatform.top;
      }
    }
    if (floorY === undefined) return;

    // The body leaves the map before the whole sprite does. Support that final
    // walk offscreen (and the transition delay) at the existing ground height.
    const left = stage.mapWidth - 1;
    this.exitFloor = this.add.rectangle(left, floorY, this.physics.world.bounds.right - left, 32)
      .setOrigin(0, 0).setVisible(false);
    this.physics.add.existing(this.exitFloor, true);
    this.physics.add.collider(this.player, this.exitFloor);
  }

  private createBossGround(stage: StageDefinition): Phaser.Tilemaps.TilemapLayer {
    const platform = stage.segments[0].platforms[0];
    const floorY = platform.y - platform.height / 2;
    const tileSize = stage.map!.tileWidth;
    const map = this.make.tilemap({
      tileWidth: tileSize,
      tileHeight: tileSize,
      width: Math.ceil(stage.mapWidth / tileSize),
      height: Math.ceil((stage.mapHeight - floorY) / tileSize),
    });
    const tileset = map.addTilesetImage("world-01-tileset", "world-01-tileset", tileSize, tileSize, 0, 0, 1);
    const layer = tileset ? map.createBlankLayer("world-01-boss-ground", tileset, 0, floorY) : null;
    if (!layer) {
      map.destroy();
      throw new Error("삼색이 보스전의 기존 땅 타일을 생성하지 못했습니다.");
    }
    // Match the normal maps' surface (1) and paving (13), at the existing arena floor.
    layer.fill(13);
    layer.fill(1, 0, 0, map.width, 1);
    layer.setDepth(0).setCollisionByExclusion([-1]);
    this.bossGround = map;
    return layer;
  }

  public update(time: number, delta: number): void {
    const input = this.inputManager?.getSnapshot();
    if (input?.pausePressed) {
      this.setPaused(this.runtime?.getStatus() !== "paused");
    }
    if (this.runtime?.getStatus() !== "play") {
      this.playerAnimator?.stopSlipperSwing();
      this.bowlShieldVisual?.update(0, false);
      return;
    }
    this.playerController?.update(time, delta);
    if (this.stageDefinition?.kind === "normal" && this.player &&
        !this.player.isControlLocked() && this.player.getBounds().left >= this.stageDefinition.mapWidth &&
        this.player.body.bottom < this.stageDefinition.mapHeight - 1) {
      this.player.setVelocity(0, 0);
      this.runtime.complete();
      return;
    }
    if (input?.barkPressed && this.progress.unlockedSkills.includes("bark")) {
      this.skillSystem?.use("bark", time);
    }
    if (this.calicoBoss && this.player && this.combatSystem) {
      this.calicoBoss.start(time);
      this.combatSystem.update(time);
      if (input?.attackPressed) {
        const result = this.combatSystem.tryAttack(time);
        if (result.accepted && result.kind === "slipper-hit") {
          this.playerAnimator?.triggerSlipperSwing(time);
        } else if (result.kind === "slipper-sneeze") {
          this.playerAnimator?.stopSlipperSwing();
        }
        this.calicoBoss.acceptMeleeHit(result, this.player);
        if (this.runtime.getStatus() !== "play") {
          this.playerAnimator?.stopSlipperSwing();
          return;
        }
      }
      this.calicoBoss.update(time, delta);
    }
    this.playerAnimator?.update(time);
    this.bowlShieldVisual?.update(delta, this.runtime?.getStatus() === "play" && !this.calicoBoss?.isDefeated());
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
    this.holdPlayerForVictoryDialogue();
    this.calicoBoss.showCollapseFrame();
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

  private holdPlayerForVictoryDialogue(): void {
    if (!this.player) return;
    // Keep the visible actor at the final hit position while dialogue continues.
    this.player.disableBody(false, false);
    this.player.setAnimationState("idle");
    this.playerAnimator?.stopSlipperSwing();
    this.playerAnimator?.update(this.time.now);
    this.bowlShieldVisual?.update(0, false);
  }

  private handleCalicoThirdHit(now: number): void {
    this.gameplayEventBus?.emit("death-requested", {
      stageId: "world-01-stage-boss",
      cause: "enemy",
      checkpointId: getWorld01Respawn(this.progress).resumeCheckpointId ?? null,
      now,
    });
  }

  private restartAtWorldCheckpoint(): boolean {
    if (this.stageDefinition?.worldId !== "world-01") return false;
    const target = getWorld01Respawn(this.progress);
    if (target.stageId === this.stageId) return false;
    if (this.stageTransitionStarted) return true;
    this.stageTransitionStarted = true;
    this.runtime?.setStatus("dying");
    this.player?.disableBody(false, false);
    this.playerAnimator?.stopSlipperSwing();
    this.time.delayedCall(this.stageId === "world-01-stage-boss" ? 900 : 0, () => {
      if (!this.scene.isActive()) return;
      this.scene.start("StageScene", {
        ...target,
        playerName: this.progress.playerName,
      } satisfies StageSceneData);
    });
    return true;
  }

  private restoreCheckpoint(checkpointId: string): void {
    if (!this.player || !this.checkpointSystem) return;
    const spawn = this.getCheckpointSpawn(checkpointId);
    if (!spawn) throw new Error("복원할 체크포인트를 찾을 수 없습니다: " + checkpointId);
    const saved = this.registry.get(WORLD01_CHECKPOINT_SNAPSHOT_KEY) as CheckpointSnapshot | undefined;
    const restored = saved?.stageId === this.stageId && saved.checkpointId === checkpointId &&
      this.checkpointSystem.restore({ ...saved, x: spawn.x, y: spawn.y });
    if (!restored) {
      this.checkpointSystem.activate(checkpointId, spawn.x, spawn.y, 1, this.time.now, { silent: true });
    }
    const snapshot = this.checkpointSystem.getSnapshot();
    const mapSnapshot = snapshot?.mapSnapshot ?? null;
    this.runtime?.setMapSnapshot(mapSnapshot);
    this.mapInteraction?.reset(mapSnapshot);
    this.gimmickSystem?.reset(mapSnapshot);
    this.player.resetTo(new Phaser.Math.Vector2(spawn.x, spawn.y));
    this.player.setFlipX((snapshot?.facing ?? 1) < 0);
    this.cameraDirector?.followPlayer();
    if (snapshot && isWorld01CheckpointStageId(this.stageId)) {
      this.registry.set(WORLD01_CHECKPOINT_SNAPSHOT_KEY, structuredClone(snapshot));
    }
  }

  private setPaused(paused: boolean): void {
    const runtime = this.runtime;
    if (!runtime) return;

    if (paused && runtime.getStatus() === "play") {
      runtime.pause();
      this.physics.world.pause();
      this.audioManager?.setPaused(true);
    } else if (!paused && runtime.getStatus() === "paused") {
      runtime.resume();
      this.physics.world.resume();
      this.audioManager?.setPaused(false);
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
    const spawn = this.getCheckpointSpawn(checkpointId);
    if (!spawn) return;
    const activated = this.checkpointSystem.activate(
      checkpointId,
      spawn.x,
      spawn.y,
      1,
      this.time.now,
    );
    if (!activated) return;
    if (isWorld01CheckpointStageId(this.stageId)) {
      this.progress.world01CheckpointStageId = this.stageId;
      this.registry.set(WORLD01_CHECKPOINT_SNAPSHOT_KEY, structuredClone(this.checkpointSystem.getSnapshot()));
    }
    this.mapInteraction?.triggerObject(checkpointId, "checkpoint-reached");
    this.eventBus?.emit("checkpoint-activated", {
      stageId: this.stageId,
      checkpointId,
    });
  }

  private getCheckpointSpawn(checkpointId: string): { x: number; y: number } | undefined {
    return this.runtime?.getEntities("checkpoint")
      .find((record) => record.id === checkpointId)?.entity.getData("respawnPosition");
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
