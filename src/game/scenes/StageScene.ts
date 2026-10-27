import * as Phaser from "phaser";
import { GAME_HEIGHT } from "../config";
import {
  createDefaultProgressState,
  createRuntimeStageState,
  getNextStageId,
  getPreviousWorld02StageId,
} from "../core/constants";
import type { CustomOutfitDesign, ProgressState, StageId } from "../core/types";
import type { CheckpointSnapshot } from "../core/runtimeTypes";
import { GameEventBus } from "../bridge/GameEventBus";
import { CameraDirector } from "../camera/CameraDirector";
import { AudioManager } from "../audio/AudioManager";
import { getStageMusicKey } from "../audio/stageMusic";
import { CutsceneDirector } from "../cutscenes/CutsceneDirector";
import { CUTSCENE_SCRIPTS } from "../data/cutscenes";
import { TOOL_DEFINITIONS } from "../data/tools";
import { getWorld02StageHazards } from "../data/world02StageHazards";
import {
  canBacktrackWorld02,
  getWorld02EntryPosition,
  isWorld02PlaygroundStageId,
  readWorld02TravelState,
  saveWorld02Visit,
  validWorld02Seed,
  type World02EntrySide,
} from "../data/world02Travel";
import { getWorld03Obstacles } from "../data/world03Construction";
import { BARK_COOLDOWN_MS, SKILL_DEFINITIONS } from "../data/skills";
import { BossFeedbackController, BARK_SHAKE_DURATION_MS, BARK_SHAKE_INTENSITY, type BossFeedbackSnapshot } from "../systems/bossFeedback";
import { GameplayEventBus } from "../core/events";
import { getStageDefinition, getWorldMapTheme } from "../data";
import { getWorld01StageTheme, getWorld02StageTheme, getWorld03StageTheme } from "../data/worldMaps";
import type { StageDefinition } from "../core/types";
import type { EnemyDefinition } from "../core/contentTypes";
import { MapDebugOverlay } from "../debug/MapDebugOverlay";
import { Enemy } from "../entities/Enemy";
import { Player } from "../entities/Player";
import { PlayerAnimator } from "../entities/PlayerAnimator";
import { PlayerWearables } from "../entities/PlayerWearables";
import { EquipmentVisual } from "../entities/EquipmentVisual";
import { BowlShieldVisual } from "../entities/BowlShieldVisual";
import { DEFAULT_PLAYER_TUNING } from "../entities/playerTypes";
import { InputManager, toKeybindMap } from "../input/InputManager";
import { ParallaxRenderer } from "../maps/ParallaxRenderer";
import { World03ConstructionObstacles } from "../systems/World03ConstructionObstacles";
import { BossEncounter } from "../systems/BossEncounter";
import { CheeseTabbyBallPattern } from "../systems/CheeseTabbyBallPattern";
import { MackerelBrickPattern } from "../systems/MackerelBrickPattern";
import { TuxedoMagnetPattern } from "../systems/TuxedoMagnetPattern";
import { MaineCoonPattern } from "../systems/MaineCoonPattern";
import { BOSS_COMBAT_CONFIG } from "../data/bossCombat";
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
import { DrawbackDiscovery } from "../systems/DrawbackDiscovery";
import { MapGimmickSystem } from "../systems/MapGimmickSystem";
import { PlayerController } from "../systems/PlayerController";
import { RestartController } from "../systems/RestartController";
import { SkillSystem } from "../systems/SkillSystem";
import { StrayDogEvent } from "../systems/StrayDogEvent";
import { World01CalicoBoss } from "../systems/World01CalicoBoss";
import { World02ObstacleSystem } from "../systems/World02ObstacleSystem";
import { World02PigeonDropSystem } from "../systems/World02PigeonDropSystem";
import { getWorld01Respawn, isWorld01CheckpointStageId } from "../systems/world01Respawn";
import { getWorld01ReplayTarget, getWorldStartStageId, isWorldSelectionUnlocked } from "../systems/worldSelection";
import { getMarketProduct } from "../data/marketCatalog";

const NORMAL_EXIT_RUNOUT = 256;
const WORLD01_CHECKPOINT_SNAPSHOT_KEY = "world01CheckpointSnapshot";

export interface StageSceneData {
  readonly stageId?: StageId;
  readonly seed?: number;
  readonly playerName?: string;
  readonly resumeCheckpointId?: string;
  readonly entrySide?: World02EntrySide;
}

export class StageScene extends Phaser.Scene {
  private player?: Player;
  private playerAnimator?: PlayerAnimator;
  private playerWearables?: PlayerWearables;
  private equipmentVisual?: EquipmentVisual;
  private inputManager?: InputManager;
  private playerController?: PlayerController;
  private cameraDirector?: CameraDirector;
  private runtime?: StageRuntime;
  private loadedMap?: LoadedMap | null;
  private bossGround?: Phaser.Tilemaps.Tilemap;
  private sandFloor?: Phaser.GameObjects.TileSprite;
  private world02Obstacles?: World02ObstacleSystem;
  private world03Obstacles?: World03ConstructionObstacles;
  private world02PigeonDrops?: World02PigeonDropSystem;
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
  private laterBossSprite?: Phaser.GameObjects.Sprite;
  private calicoBoss?: World01CalicoBoss;
  private bossEncounter?: BossEncounter;
  private victorySequenceStarted = false;
  private stageTransitionStarted = false;
  private combatSystem?: CombatSystem;
  private skillSystem?: SkillSystem;
  private skillElapsedMs = 0;
  private readonly bossFeedback = new BossFeedbackController();
  private lastBossFeedbackSnapshot?: BossFeedbackSnapshot;
  private defenseToolSystem?: DefenseToolSystem;
  private drawbackDiscovery?: DrawbackDiscovery;
  private bowlShieldVisual?: BowlShieldVisual;
  private audioManager?: AudioManager;
  private strayDogEvent?: StrayDogEvent;
  private stageBackdrop?: Phaser.GameObjects.Rectangle;
  private bossArenaBackdrop?: Phaser.GameObjects.Image;
  private stageReviewKey?: Phaser.Input.Keyboard.Key;
  private overviewKey?: Phaser.Input.Keyboard.Key;
  private mapOverview = false;
  private shopOpen = false;
  private catalogOpen = false;
  private paintOpen = false;
  private menuPauseGuard = false;
  private stageId: StageId = "world-01-stage-1";
  private stageDefinition?: StageDefinition;
  private activeSectionId?: string;

  public constructor() {
    super("StageScene");
  }

  private currentCustomOutfit(): CustomOutfitDesign | null {
    const id = this.progress.equippedCustomOutfitId;
    return id ? this.progress.customOutfits.find((design) => design.id === id) ?? null : null;
  }

  public create(data: StageSceneData = {}): void {
    this.stageId = data.stageId ?? "world-01-stage-1";
    this.victorySequenceStarted = false;
    this.stageTransitionStarted = false;
    this.mapOverview = false;
    this.shopOpen = false;
    this.catalogOpen = false;
    this.paintOpen = false;
    this.menuPauseGuard = false;
    this.activeSectionId = undefined;
    const stage = getStageDefinition(this.stageId);
    this.stageDefinition = stage;
    const registeredProgress = this.registry.get("progressState") as ProgressState | undefined;
    this.progress = registeredProgress ?? createDefaultProgressState(data.playerName);
    if (data.playerName) this.progress.playerName = data.playerName;
    const theme = getWorld03StageTheme(stage.id, getWorld02StageTheme(stage.id,
      getWorld01StageTheme(stage.id, getWorldMapTheme(stage.worldId))));
    const savedCheckpoint = this.registry.get(WORLD01_CHECKPOINT_SNAPSHOT_KEY) as CheckpointSnapshot | undefined;
    const world02StageId = isWorld02PlaygroundStageId(stage.id) ? stage.id : null;
    const world02Playground = world02StageId !== null;
    const travelState = readWorld02TravelState(this.registry.get("world02TravelState"));
    const visit = world02StageId ? travelState[world02StageId] : undefined;
    const savedWorld02Seed = this.registry.get("world02RunSeed");
    const seed = world02Playground ? visit?.seed ??
      (validWorld02Seed(data.seed) ? data.seed : undefined) ??
      (validWorld02Seed(savedWorld02Seed) ? savedWorld02Seed : undefined) ?? Phaser.Math.Between(1, 0x7fffffff)
      : data.seed ?? (savedCheckpoint?.stageId === stage.id &&
      savedCheckpoint.checkpointId === data.resumeCheckpointId ? savedCheckpoint.randomSeed : undefined) ?? 1;
    if (world02Playground) this.registry.set("world02RunSeed", seed);
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
    const finalArena = stage.id === "world-04-stage-boss" || stage.id === "world-05-stage-boss";
    const backgroundTheme = finalArena
      ? { ...theme, layers: theme.layers.filter((layer) => layer.kind !== "foreground") }
      : theme;
    this.parallaxRenderer.render(backgroundTheme, stage.mapWidth, stage.mapHeight);
    if (finalArena) {
      const backdropKey = stage.id === "world-04-stage-boss"
        ? "world-04-boss-scrapyard" : "world-05-boss-cat-tower";
      this.bossArenaBackdrop = this.add.image(0, 0, backdropKey)
        .setOrigin(0).setDisplaySize(stage.mapWidth, stage.mapHeight).setDepth(-19);
    }

    this.player = new Player(
      this, stage.spawn.x, stage.spawn.y, "corgi-run",
      stage.worldId === "world-01" ? 48 : 72,
    );
    if (world02Playground && data.entrySide === "right") {
      const entry = getWorld02EntryPosition("right", stage.mapWidth, stage.spawn);
      this.player.resetTo(new Phaser.Math.Vector2(entry.x, entry.y));
      this.player.setFlipX(true);
      this.player.setVelocity(0, 0);
    }
    this.player.setDepth(10);
    this.playerAnimator = new PlayerAnimator(this.player);
    this.playerWearables = new PlayerWearables(this, this.player);
    this.playerWearables.setEquipment(this.progress.equippedOutfitId, this.progress.equippedAccessoryId, this.currentCustomOutfit());
    this.equipmentVisual = new EquipmentVisual(this, this.player);
    this.equipmentVisual.setTools(this.progress.equippedAttackToolId, this.progress.equippedDefenseToolId);
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
    if (/^world-02-stage-[1-3]$/.test(stage.id) && !this.loadedMap) {
      this.createWorld02SandFloor(stage);
    }
    if (/^world-03-stage-[1-4]$/.test(stage.id) && !this.loadedMap) {
      this.createWorld03ConstructionFloor(stage);
    }
    this.gameplayEventBus = new GameplayEventBus();
    this.combatSystem = new CombatSystem(this.player, this.gameplayEventBus, TOOL_DEFINITIONS);
    this.combatSystem.setAttackTool(this.progress.equippedAttackToolId);
    this.drawbackDiscovery = new DrawbackDiscovery(this.progress, this.gameplayEventBus, this.persistenceEventBus);
    this.audioManager = new AudioManager(this, this.gameplayEventBus, this.eventBus);
    this.skillSystem = new SkillSystem(
      this.player, SKILL_DEFINITIONS, this.gameplayEventBus,
      this.persistenceEventBus, this.progress.unlockedSkills,
    );
    this.resetBossFeedback();
    this.eventUnsubscribers.push(
      this.gameplayEventBus.on("death", () => {
        this.combatSystem?.resetForStage();
        this.playerAnimator?.stopBark();
        this.resetBossFeedback();
        this.publishBossFeedback(true, true);
      }),
      this.gameplayEventBus.on("restart", () => {
        this.combatSystem?.resetForStage();
        this.world02Obstacles?.resetForAttempt();
        this.world03Obstacles?.resetForAttempt();
        this.bossEncounter?.resetAttempt();
        this.world02PigeonDrops?.resetForAttempt(this.player?.x ?? stage.spawn.x);
        this.playerAnimator?.stopBark();
        this.resetBossFeedback();
        this.publishBossFeedback(true);
      }),
      this.gameplayEventBus.on("stray-dog-surge", ({ source, count }) => {
        if (this.stageId !== "world-01-stage-boss" || source !== "upside-down-bowl" || count <= 0 ||
            this.runtime?.getStatus() !== "play" || this.stageTransitionStarted || this.calicoBoss?.isDefeated()) return;
        this.bossFeedback.showBowlAlarm();
        this.publishBossFeedback(true);
      }),
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
    if (world02StageId && !this.loadedMap) {
      const hazards = getWorld02StageHazards(world02StageId, seed);
      this.world02Obstacles = new World02ObstacleSystem(
        this,
        this.player,
        this.gameplayEventBus,
        stage.id,
        hazards.obstacles,
        () => this.runtime?.runtimeState.checkpointId ?? null,
        () => this.runtime?.getStatus() === "play" && !this.stageTransitionStarted,
      );
      this.world02PigeonDrops = new World02PigeonDropSystem(
        this,
        this.player,
        this.gameplayEventBus,
        stage.id,
        hazards.pigeonPasses,
        () => this.runtime?.runtimeState.checkpointId ?? null,
        () => this.runtime?.getStatus() === "play" && !this.stageTransitionStarted,
      );
    }
    if (getWorld03Obstacles(stage.id).length > 0 && !this.loadedMap) {
      this.world03Obstacles = new World03ConstructionObstacles(
        this,
        this.player,
        stage.id,
        this.gameplayEventBus,
        () => this.runtime?.runtimeState.checkpointId ?? null,
        () => this.runtime?.getStatus() === "play" && !this.stageTransitionStarted,
      );
    }

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
      if (this.sandFloor) record.entity.setVisible(false);
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
    if (world02Playground && visit?.checkpointSnapshot &&
        this.checkpointSystem.restore(visit.checkpointSnapshot)) {
      const snapshot = visit.checkpointSnapshot.mapSnapshot ?? null;
      this.runtime.setMapSnapshot(snapshot);
      this.mapInteraction?.reset(snapshot);
      this.gimmickSystem?.reset(snapshot);
      this.runtime.resetCoins();
      this.world02PigeonDrops?.resetForAttempt(this.player.x);
    }
    if (data.resumeCheckpointId) {
      this.restoreCheckpoint(data.resumeCheckpointId);
      this.world02PigeonDrops?.resetForAttempt(this.player.x);
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
      this.defenseToolSystem = new DefenseToolSystem(this.gameplayEventBus, TOOL_DEFINITIONS);
      this.defenseToolSystem.resetForStage(this.progress.equippedDefenseToolId);
      this.equipmentVisual?.setShieldCharges(this.defenseToolSystem.getRemainingCharges());
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
    if (stage.id === "world-02-stage-boss" || stage.id === "world-03-stage-boss" ||
        stage.id === "world-04-stage-boss" || stage.id === "world-05-stage-boss") {
      const isCheeseTabby = stage.id === "world-02-stage-boss";
      const isMackerel = stage.id === "world-03-stage-boss";
      const isTuxedo = stage.id === "world-04-stage-boss";
      const bossKey = isCheeseTabby ? "world-02-cheese-tabby-boss"
        : isMackerel ? "world-03-mackerel-boss"
          : isTuxedo ? "world-04-tuxedo-boss" : "world-05-maine-coon-boss";
      const bossConfig = isCheeseTabby ? BOSS_COMBAT_CONFIG["world-02"]
        : isMackerel ? BOSS_COMBAT_CONFIG["world-03"]
          : isTuxedo ? BOSS_COMBAT_CONFIG["world-04"] : BOSS_COMBAT_CONFIG["world-05"];
      const introId = `${stage.worldId}-boss-intro`;
      this.laterBossSprite = this.add.sprite(1280, isCheeseTabby ? 472 : stage.id === "world-05-stage-boss" ? 430 : 446, bossKey, 0)
        .setDepth(10).setFlipX(true);
      this.defenseToolSystem = new DefenseToolSystem(this.gameplayEventBus, TOOL_DEFINITIONS);
      this.defenseToolSystem.resetForStage(this.progress.equippedDefenseToolId);
      this.equipmentVisual?.setShieldCharges(this.defenseToolSystem.getRemainingCharges());
      this.bowlShieldVisual = new BowlShieldVisual(this, this.player, this.defenseToolSystem, this.gameplayEventBus);
      const pattern = isCheeseTabby
        ? new CheeseTabbyBallPattern(this, this.player, this.laterBossSprite,
          () => this.audioManager?.playSfx("boss-whistle"))
        : isMackerel ? new MackerelBrickPattern(this, this.player, this.laterBossSprite)
          : isTuxedo ? new TuxedoMagnetPattern(this, this.player, this.laterBossSprite,
            () => this.audioManager?.playSfx("magnet-hum"))
            : new MaineCoonPattern(this, this.player, this.laterBossSprite,
              new StageRandom(seed).fork("maine-coon"));
      this.bossEncounter = new BossEncounter(
        this, this.player, this.laterBossSprite, stage.id, bossConfig,
        this.defenseToolSystem, this.gameplayEventBus, pattern,
        (remaining) => this.eventBus?.emit("boss-hearts-changed", { stageId: stage.id, remaining }),
        () => { void this.handleLaterBossDefeat(stage); },
      );
      this.cutsceneDirector = new CutsceneDirector(
        this, this.player, this.progress, CUTSCENE_SCRIPTS, this.eventBus, this.cameraDirector, this.audioManager,
      );
      this.eventUnsubscribers.push(
        this.eventBus.on("cutscene-skip-requested", () => this.cutsceneDirector?.skip()),
        this.eventBus.on("cutscene-advance-requested", () => this.cutsceneDirector?.advance()),
        this.eventBus.on("cutscene-beat", ({ cutsceneId, beat, index }) => {
          if (cutsceneId !== "world-02-boss-intro" && cutsceneId !== "world-02-boss-clear") return;
          const speaker = beat.dialogue?.[0]?.speaker;
          const actor = speaker === "cheese-tabby" ? this.laterBossSprite
            : speaker === "corgi" ? this.player : undefined;
          if (actor) this.cameraDirector?.focusDialogue(actor.x, stage.mapHeight / 2, index === 0);
        }),
      );
      this.runtime.setStatus("cutscene");
      if (!this.progress.seenCutsceneIds.includes(introId)) {
        void this.cutsceneDirector.play(introId).then(() => {
          if (this.scene.isActive() && this.runtime?.getStatus() === "cutscene") {
            this.runtime.setStatus("play");
            this.audioManager?.playMusic(getStageMusicKey(stage.id));
          }
        });
      } else {
        const cue = this.add.text(640, 250, `${bossConfig.bossName}와 다시 대결!`, {
          color: "#f7ce69", fontFamily: "Galmuri11Pixel, monospace", fontSize: "30px",
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        this.time.delayedCall(900, () => {
          cue.destroy();
          if (this.scene.isActive() && this.runtime?.getStatus() === "cutscene") this.runtime.setStatus("play");
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
      this.rememberWorld02Visit();
      this.runtime?.setStatus("completed");
      if (stageId === "world-01-stage-boss" || stageId === "world-02-stage-boss") return;
      const nextStageId = getNextStageId(stageId);
      if (!nextStageId) {
        if (stageId === "world-05-stage-boss") {
          this.stageTransitionStarted = true;
          void this.playFinalEnding();
        }
        return;
      }
      this.stageTransitionStarted = true;
      this.time.delayedCall(180, () => {
        if (!this.scene.isActive()) return;
        this.scene.start("StageScene", {
          stageId: nextStageId,
          seed: this.runtime?.runtimeState.randomSeed ?? 1,
          playerName: this.progress.playerName,
          ...(isWorld02PlaygroundStageId(nextStageId) ? { entrySide: "left" as const } : {}),
        } satisfies StageSceneData);
      });
    }));
    this.eventUnsubscribers.push(this.eventBus.on("pause-requested", ({ paused }) => {
      this.setPaused(paused);
    }));
    this.eventUnsubscribers.push(this.eventBus.on("shop-state-changed", ({ open }) => {
      this.shopOpen = open;
      this.menuPauseGuard = true;
    }));
    this.eventUnsubscribers.push(this.eventBus.on("catalog-state-changed", ({ open }) => {
      this.catalogOpen = open;
      this.menuPauseGuard = true;
    }));
    this.eventUnsubscribers.push(this.eventBus.on("paint-state-changed", ({ open }) => {
      this.paintOpen = open;
      this.menuPauseGuard = true;
    }));
    this.eventUnsubscribers.push(this.eventBus.on("cosmetic-change-requested", (selection) => {
      const status = this.runtime?.getStatus();
      if (status !== "play" && status !== "paused") return;
      if ("outfitId" in selection) {
        const id = selection.outfitId;
        if (id === null || (id && this.progress.ownedCosmeticIds.includes(id) && getMarketProduct(id)?.category === "outfit")) {
          this.progress.equippedOutfitId = id;
          if (id) this.progress.equippedCustomOutfitId = null;
        }
      }
      if ("accessoryId" in selection) {
        const id = selection.accessoryId;
        if (id === null || (id && this.progress.ownedCosmeticIds.includes(id) && getMarketProduct(id)?.category === "accessory")) {
          this.progress.equippedAccessoryId = id;
        }
      }
      this.playerWearables?.setEquipment(this.progress.equippedOutfitId, this.progress.equippedAccessoryId, this.currentCustomOutfit());
    }));
    this.eventUnsubscribers.push(this.eventBus.on("custom-outfit-change-requested", ({ id }) => {
      const status = this.runtime?.getStatus();
      if (status !== "play" && status !== "paused") return;
      if (id === null) this.progress.equippedCustomOutfitId = null;
      else if (this.progress.customOutfits.some((design) => design.id === id)) {
        this.progress.equippedCustomOutfitId = id;
        this.progress.equippedOutfitId = null;
      } else return;
      this.playerWearables?.setEquipment(this.progress.equippedOutfitId, this.progress.equippedAccessoryId, this.currentCustomOutfit());
    }));
    this.eventUnsubscribers.push(this.eventBus.on("custom-outfit-saved", ({ design }) => {
      if (this.progress.equippedCustomOutfitId !== design.id) return;
      this.playerWearables?.setEquipment(this.progress.equippedOutfitId, this.progress.equippedAccessoryId, this.currentCustomOutfit());
    }));
    this.eventUnsubscribers.push(this.eventBus.on("equipment-change-requested", (selection) => {
      const status = this.runtime?.getStatus();
      if (status !== "play" && status !== "paused") return;
      if (selection.attackToolId && this.progress.ownedToolIds.includes(selection.attackToolId) &&
          TOOL_DEFINITIONS.some((tool) => tool.id === selection.attackToolId && tool.slot === "attack")) {
        this.progress.equippedAttackToolId = selection.attackToolId;
        this.combatSystem?.setAttackTool(selection.attackToolId);
      }
      if (selection.defenseToolId && this.progress.ownedToolIds.includes(selection.defenseToolId) &&
          TOOL_DEFINITIONS.some((tool) => tool.id === selection.defenseToolId && tool.slot === "defense")) {
        this.progress.equippedDefenseToolId = selection.defenseToolId;
        this.defenseToolSystem?.setDefenseTool(selection.defenseToolId);
      }
      this.equipmentVisual?.setTools(this.progress.equippedAttackToolId, this.progress.equippedDefenseToolId);
      this.equipmentVisual?.setShieldCharges(this.defenseToolSystem?.getRemainingCharges() ?? null);
      this.bowlShieldVisual?.update(0, false);
    }));
    this.eventUnsubscribers.push(this.eventBus.on("world-selection-requested", (selection) => {
      const finalReplay = this.stageId === "world-05-stage-boss" &&
        this.progress.clearedStages.includes("world-05-stage-boss");
      if ((!isWorldSelectionUnlocked(this.progress) && !finalReplay) || this.stageTransitionStarted) return;
      this.stageTransitionStarted = true;
      this.progress.selectedWorldId = selection.worldId;
      let target: StageSceneData;
      if (selection.worldId === "world-01") {
        const replayTarget = getWorld01ReplayTarget(selection.point);
        this.progress.world01CheckpointStageId = replayTarget.checkpointStageId;
        this.progress.world01BossReplayActive = replayTarget.bossReplayActive;
        this.registry.remove(WORLD01_CHECKPOINT_SNAPSHOT_KEY);
        target = {
          stageId: replayTarget.stageId,
          resumeCheckpointId: replayTarget.resumeCheckpointId,
          playerName: this.progress.playerName,
        };
      } else {
        this.progress.world01BossReplayActive = false;
        if (selection.worldId === "world-02") {
          this.registry.remove("world02RunSeed");
          this.registry.remove("world02TravelState");
        }
        target = {
          stageId: getWorldStartStageId(selection.worldId),
          playerName: this.progress.playerName,
        };
      }
      this.eventBus?.emit("world-selection-committed", { worldId: selection.worldId });
      this.setPaused(false);
      this.scene.start("StageScene", target);
    }));

    if (process.env.NODE_ENV !== "production" && this.input.keyboard) {
      this.stageReviewKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F2);
      this.stageReviewKey.on("down", this.reviewNextWorld01Stage, this);
      this.overviewKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
      this.overviewKey.on("down", this.toggleMapOverview, this);
    }

    this.events.once("shutdown", () => {
      this.resetBossFeedback();
      this.publishBossFeedback(true, true);
      this.eventBus?.emit("pause-state-changed", { paused: false });
      this.inputManager?.destroy();
      this.playerAnimator?.destroy();
      this.playerWearables?.destroy();
      this.playerWearables = undefined;
      this.equipmentVisual?.destroy();
      this.equipmentVisual = undefined;
      this.stageReviewKey?.off("down", this.reviewNextWorld01Stage, this);
      if (this.stageReviewKey) this.input.keyboard?.removeKey(this.stageReviewKey, true);
      this.overviewKey?.off("down", this.toggleMapOverview, this);
      if (this.overviewKey) this.input.keyboard?.removeKey(this.overviewKey, true);
      this.unsubscribeKeybinds?.();
      this.eventUnsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
      this.debugOverlay?.destroy();
      this.calicoBoss?.destroy();
      this.calicoBoss = undefined;
      this.bossEncounter?.destroy();
      this.bossEncounter = undefined;
      this.strayDogEvent?.destroy();
      this.strayDogEvent = undefined;
      this.combatSystem?.destroy();
      this.combatSystem = undefined;
      this.drawbackDiscovery?.destroy();
      this.drawbackDiscovery = undefined;
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
      this.laterBossSprite?.destroy();
      this.laterBossSprite = undefined;
      this.bossArenaBackdrop?.destroy();
      this.bossArenaBackdrop = undefined;
      this.mapInteraction?.destroy();
      this.world02Obstacles?.destroy();
      this.world02Obstacles = undefined;
      this.world03Obstacles?.destroy();
      this.world03Obstacles = undefined;
      this.world02PigeonDrops?.destroy();
      this.world02PigeonDrops = undefined;
      this.gimmickSystem?.destroy();
      this.deathSystem?.destroy();
      this.checkpointSystem?.resetForStage();
      this.clearMapEnemies();
      this.runtime?.destroy();
      this.loadedMap?.destroy();
      this.bossGround?.destroy();
      this.bossGround = undefined;
      this.sandFloor?.destroy();
      this.sandFloor = undefined;
      this.exitFloor?.destroy();
      this.exitFloor = undefined;
      this.parallaxRenderer?.destroy();
      this.gameplayEventBus?.clear();
      if (!this.persistenceEventBus) this.eventBus?.clear();
    });
    this.publishBossFeedback(true);
  }

  private createWorld02SandFloor(stage: StageDefinition): void {
    const platforms = this.runtime?.getEntities("platform") ?? [];
    const bounds = platforms.length === 1
      ? (platforms[0].entity as Phaser.GameObjects.Rectangle).getBounds()
      : null;
    if (!bounds || bounds.left !== 0 || bounds.right !== stage.mapWidth || bounds.top !== 504) {
      throw new Error("월드 2 놀이터의 모래 바닥과 충돌 범위가 일치하지 않습니다.");
    }
    // Center the small surface bumps around the flat collision plane.
    const visualTop = bounds.top - 5;
    const visualHeight = stage.mapHeight - visualTop;
    const textureHeight = this.textures.get("world-02-sand-floor").getSourceImage().height;
    this.sandFloor = this.add
      .tileSprite(0, visualTop, stage.mapWidth, visualHeight, "world-02-sand-floor")
      .setOrigin(0)
      .setDepth(-2)
      .setScrollFactor(1)
      .setTileScale(1, visualHeight / textureHeight);
  }

  private createWorld03ConstructionFloor(stage: StageDefinition): void {
    const platforms = this.runtime?.getEntities("platform") ?? [];
    const bounds = platforms.length === 1
      ? (platforms[0].entity as Phaser.GameObjects.Rectangle).getBounds()
      : null;
    if (!bounds || bounds.left !== 0 || bounds.right !== stage.mapWidth || bounds.top !== 504) {
      throw new Error("월드 3 공사장 바닥과 충돌 범위가 일치하지 않습니다.");
    }
    const visualTop = bounds.top - 5;
    const height = stage.mapHeight - visualTop;
    const textureHeight = this.textures.get("world-03-construction-floor").getSourceImage().height;
    this.sandFloor = this.add
      .tileSprite(0, visualTop, stage.mapWidth, height, "world-03-construction-floor")
      .setOrigin(0)
      .setDepth(-2)
      .setScrollFactor(1)
      .setTileScale(1, height / textureHeight);
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
    if (input?.pausePressed && !this.shopOpen && !this.catalogOpen && !this.paintOpen && !this.menuPauseGuard) {
      this.setPaused(this.runtime?.getStatus() !== "paused");
    }
    if (this.menuPauseGuard && !input?.pauseHeld) this.menuPauseGuard = false;
    if (this.runtime?.getStatus() !== "play") {
      this.equipmentVisual?.setEnabled(this.runtime?.getStatus() === "paused");
      if (this.runtime?.getStatus() !== "paused") {
        this.playerAnimator?.stopBark();
        this.bossFeedback.clearWarning();
        this.cameras.main?.shakeEffect.reset();
      }
      this.publishBossFeedback();
      this.playerAnimator?.stopSlipperSwing();
      this.bowlShieldVisual?.update(0, false);
      return;
    }
    const elapsed = Number.isFinite(delta) ? Math.max(0, delta) : 0;
    this.equipmentVisual?.setEnabled(true);
    this.skillElapsedMs += elapsed;
    this.bossFeedback.update(elapsed);
    this.playerController?.update(time, delta);
    this.world02Obstacles?.update(elapsed);
    this.world02PigeonDrops?.update(elapsed);
    if (this.player && input && canBacktrackWorld02({
      stageId: this.stageId,
      status: this.runtime.getStatus(),
      left: input.left,
      playerLeft: this.player.getBounds().left,
      controlLocked: this.player.isControlLocked(),
      controlOverridden: Boolean(this.player.getControlOverride()),
      transitionStarted: this.stageTransitionStarted,
      menuOpen: this.shopOpen || this.catalogOpen || this.paintOpen || this.menuPauseGuard,
    })) {
      const previousStageId = getPreviousWorld02StageId(this.stageId);
      if (previousStageId) {
        this.rememberWorld02Visit();
        this.stageTransitionStarted = true;
        this.scene.start("StageScene", {
          stageId: previousStageId,
          seed: this.registry.get("world02RunSeed") as number,
          playerName: this.progress.playerName,
          entrySide: "right",
        } satisfies StageSceneData);
        return;
      }
    }
    if (this.stageDefinition?.kind === "normal" && this.player &&
        !this.player.isControlLocked() && this.player.getBounds().left >= this.stageDefinition.mapWidth &&
        this.player.body.bottom < this.stageDefinition.mapHeight - 1) {
      this.player.setVelocity(0, 0);
      this.runtime.complete();
      this.publishBossFeedback(true, true);
      return;
    }
    if (input?.barkPressed && this.progress.unlockedSkills.includes("bark")) {
      const result = this.skillSystem?.use("bark", this.skillElapsedMs);
      if (result?.accepted) {
        this.playerAnimator?.triggerBark();
        this.calicoBoss?.tryBarkStun(time);
        this.bossEncounter?.tryBarkStun(time);
        if (!this.stageTransitionStarted &&
            !this.calicoBoss?.isDefeated() && !this.bossEncounter?.isDefeated() && this.bossFeedback.recordBarkUse()) {
          this.cameras.main.shake(BARK_SHAKE_DURATION_MS, BARK_SHAKE_INTENSITY, true);
        }
        this.publishBossFeedback(true);
      }
    }
    this.calicoBoss?.start(time);
    this.bossEncounter?.start();
    if (input?.attackPressed && this.combatSystem && this.player) {
      const result = this.combatSystem.tryAttack(time);
      if (result.accepted && result.kind === "slipper-hit" && (this.calicoBoss || this.bossEncounter)) {
        this.playerAnimator?.triggerSlipperSwing(time);
      } else if (result.accepted && result.kind === "tool-preview") {
        this.equipmentVisual?.showAttack(time, result.weaponKind ?? "melee");
      } else if (result.kind === "slipper-sneeze") {
        this.playerAnimator?.stopSlipperSwing();
      }
      if (this.calicoBoss) {
        this.calicoBoss.acceptMeleeHit(result, this.player);
      }
      this.bossEncounter?.acceptSlipperHit(result, this.player);
      for (const contact of result.contacts ?? []) {
        if (this.calicoBoss?.acceptToolHit(contact) || this.bossEncounter?.acceptToolHit(contact)) {
          this.combatSystem.registerHit(contact);
        }
      }
      if (this.runtime.getStatus() !== "play") {
        this.playerAnimator?.stopSlipperSwing();
        return;
      }
    }
    for (const contact of this.combatSystem?.update(time, elapsed) ?? []) {
      if (this.calicoBoss?.acceptToolHit(contact) || this.bossEncounter?.acceptToolHit(contact)) {
        this.combatSystem?.registerHit(contact);
      }
    }
    this.calicoBoss?.update(time, delta);
    this.bossEncounter?.update(elapsed);
    this.equipmentVisual?.setShieldCharges(this.defenseToolSystem?.getRemainingCharges() ?? null);
    this.playerAnimator?.update(time, delta);
    this.bowlShieldVisual?.update(delta, this.progress.equippedDefenseToolId === "upside-down-bowl" && this.runtime?.getStatus() === "play" && !this.calicoBoss?.isDefeated() && !this.bossEncounter?.isDefeated());
    this.gimmickSystem?.update(time, delta);
    this.mapInteraction?.update(time, delta);
    for (const enemy of this.mapEnemies.values()) enemy.updateMovement(time);
    this.debugOverlay?.update();
    this.syncSectionCamera();
    this.publishBossFeedback();
  }

  private resetBossFeedback(): void {
    this.skillElapsedMs = 0;
    this.skillSystem?.resetCooldowns();
    this.bossFeedback.reset();
    this.lastBossFeedbackSnapshot = undefined;
    this.cameras.main?.shakeEffect.reset();
  }

  private publishBossFeedback(force = false, forceInactive = false): void {
    const active = !forceInactive && this.runtime?.getStatus() === "play" &&
      !this.stageTransitionStarted && !this.victorySequenceStarted;
    const barkUnlocked = this.progress.unlockedSkills.includes("bark");
    const snapshot: BossFeedbackSnapshot = {
      stageId: this.stageId, active, barkUnlocked,
      barkRemainingMs: barkUnlocked
        ? Math.ceil((this.skillSystem?.getRemainingCooldown("bark", this.skillElapsedMs) ?? 0) / 100) * 100 : 0,
      barkCooldownMs: BARK_COOLDOWN_MS,
      warning: active ? this.bossFeedback.getWarning() : null,
    };
    const last = this.lastBossFeedbackSnapshot;
    if (!force && last && last.stageId === snapshot.stageId && last.active === snapshot.active &&
        last.barkUnlocked === snapshot.barkUnlocked && last.barkRemainingMs === snapshot.barkRemainingMs &&
        last.warning?.kind === snapshot.warning?.kind && last.warning?.sequence === snapshot.warning?.sequence) return;
    this.lastBossFeedbackSnapshot = snapshot;
    this.eventBus?.emit("boss-feedback-changed", snapshot);
  }

  private async handleCalicoDefeat(): Promise<void> {
    if (this.victorySequenceStarted || !this.calicoBoss?.isDefeated()) return;
    this.victorySequenceStarted = true;
    this.resetBossFeedback();
    this.publishBossFeedback(true, true);
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
    this.progress.world01BossReplayActive = false;
    if (this.progress.selectedWorldId === "world-01") {
      this.progress.selectedWorldId = "world-02";
    }
    this.runtime?.complete();
    this.scene.start("World01SkillUnlockScene", {
      stageId: "world-01-stage-boss",
      nextStageId: "world-02-stage-1",
      skillId: "bark",
    });
  }

  private async handleLaterBossDefeat(stage: StageDefinition): Promise<void> {
    if (this.victorySequenceStarted || !this.bossEncounter?.isDefeated()) return;
    this.victorySequenceStarted = true;
    this.runtime?.setStatus("cutscene");
    this.player?.setVelocity(0, 0);
    this.player?.lockControl("boss-victory");
    this.laterBossSprite?.setFrame(3);
    await this.cutsceneDirector?.play(`${stage.worldId}-boss-clear`);
    if (!this.scene.isActive() || !this.bossEncounter?.isDefeated()) return;
    const config = stage.worldId === "world-01" ? null : BOSS_COMBAT_CONFIG[stage.worldId];
    if (!config) throw new Error(`후속 보스 설정이 없습니다: ${stage.id}`);
    const skillId = config.rewardSkill;
    if (!this.progress.unlockedSkills.includes(skillId)) {
      this.progress.unlockedSkills.push(skillId);
      this.skillSystem?.unlockAfterBoss(`${stage.worldId}-boss`);
    }
    if (stage.id === "world-02-stage-boss") this.progress.selectedWorldId = null;
    this.player?.unlockControl("boss-victory");
    this.runtime?.complete();
    if (stage.id === "world-02-stage-boss") {
      this.scene.start("World01StageClearScene", {
        stageId: "world-02-stage-boss",
        nextStageId: "world-03-stage-1",
      });
    }
  }

  private async playFinalEnding(): Promise<void> {
    if (!this.cutsceneDirector || !this.player) return;
    this.runtime?.setStatus("cutscene");
    this.player.setVelocity(0, 0);
    await this.cutsceneDirector.play("ending-homecoming");
    if (!this.scene.isActive() || this.stageId !== "world-05-stage-boss") return;
    this.runtime?.setStatus("completed");
    this.stageTransitionStarted = false;
    this.eventBus?.emit("ending-finished", { cutsceneId: "ending-homecoming" });
  }

  private holdPlayerForVictoryDialogue(): void {
    if (!this.player) return;
    // Keep the visible actor at the final hit position while dialogue continues.
    this.player.disableBody(false, false);
    this.player.setAnimationState("idle");
    this.playerAnimator?.stopBark();
    this.playerAnimator?.stopSlipperSwing();
    this.playerAnimator?.update(this.time.now);
    this.bowlShieldVisual?.update(0, false);
  }

  private handleCalicoThirdHit(now: number): void {
    this.gameplayEventBus?.emit("death-requested", {
      stageId: "world-01-stage-boss",
      cause: "enemy",
      checkpointId: this.progress.world01BossReplayActive
        ? null : getWorld01Respawn(this.progress).resumeCheckpointId ?? null,
      now,
    });
  }

  private restartAtWorldCheckpoint(): boolean {
    if (this.stageDefinition?.worldId !== "world-01") return false;
    const target = this.stageId === "world-01-stage-boss" && this.progress.world01BossReplayActive
      ? { stageId: "world-01-stage-boss" as const }
      : getWorld01Respawn(this.progress);
    if (target.stageId === this.stageId && this.stageId !== "world-01-stage-boss") return false;
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
      this.cameras.main?.shakeEffect.reset();
    } else if (!paused && runtime.getStatus() === "paused") {
      runtime.resume();
      this.physics.world.resume();
      this.audioManager?.setPaused(false);
    }

    this.publishBossFeedback(true);
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

  private rememberWorld02Visit(): void {
    if (!isWorld02PlaygroundStageId(this.stageId) || !this.runtime) return;
    const current = readWorld02TravelState(this.registry.get("world02TravelState"));
    const snapshot = this.checkpointSystem?.getSnapshot() ?? null;
    this.registry.set("world02TravelState", saveWorld02Visit(
      current, this.stageId, this.runtime.runtimeState.randomSeed,
      snapshot?.stageId === this.stageId ? snapshot : null,
    ));
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
