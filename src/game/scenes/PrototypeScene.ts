import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { createDefaultProgressState, createRuntimeStageState } from "../core/constants";
import type { ProgressState, RuntimeStageState } from "../core/types";
import { GameplayEventBus } from "../core/events";
import { getStageDefinition } from "../data";
import { SKILL_DEFINITIONS } from "../data/skills";
import { TOOL_DEFINITIONS } from "../data/tools";
import { CheckpointSystem } from "../systems/CheckpointSystem";
import { PlayerAnimator } from "../entities/PlayerAnimator";
import { Player } from "../entities/Player";
import { DEFAULT_PLAYER_TUNING } from "../entities/playerTypes";
import { DEFAULT_KEYBINDS, InputManager } from "../input/InputManager";
import { CombatSystem } from "../systems/CombatSystem";
import { DeathSystem } from "../systems/DeathSystem";
import { DefenseToolSystem } from "../systems/DefenseToolSystem";
import { DrawbackDiscovery } from "../systems/DrawbackDiscovery";
import { EnemySystem } from "../systems/EnemySystem";
import { PlayerController } from "../systems/PlayerController";
import { RestartController } from "../systems/RestartController";
import { SkillSystem } from "../systems/SkillSystem";
import { StrayDogEvent } from "../systems/StrayDogEvent";
import { TrapSystem } from "../systems/TrapSystem";

interface PrototypeSceneData {
  readonly assetLoadError?: string | null;
}

export class PrototypeScene extends Phaser.Scene {
  private player?: Player;
  private inputManager?: InputManager;
  private playerController?: PlayerController;
  private playerAnimator?: PlayerAnimator;
  private stateText?: Phaser.GameObjects.Text;
  private eventLogText?: Phaser.GameObjects.Text;
  private eventBus?: GameplayEventBus;
  private progress?: ProgressState;
  private runtime?: RuntimeStageState;
  private checkpointSystem?: CheckpointSystem;
  private restartController?: RestartController;
  private deathSystem?: DeathSystem;
  private enemySystem?: EnemySystem;
  private trapSystem?: TrapSystem;
  private skillSystem?: SkillSystem;
  private combatSystem?: CombatSystem;
  private defenseToolSystem?: DefenseToolSystem;
  private strayDogEvent?: StrayDogEvent;
  private drawbackDiscovery?: DrawbackDiscovery;

  public constructor() {
    super("PrototypeScene");
  }

  public create(data: PrototypeSceneData = {}): void {
    const stage = getStageDefinition("world-01-stage-1");
    this.progress = createDefaultProgressState();
    this.runtime = createRuntimeStageState(stage.id, 1);
    this.cameras.main.setBackgroundColor("#f5e7c7");
    this.createBackdrop();

    const ground = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 72,
      GAME_WIDTH - 120,
      28,
      0x5f3942,
    );
    this.physics.add.existing(ground, true);

    this.player = new Player(this, 218, GAME_HEIGHT - 88);
    this.physics.add.collider(this.player, ground);

    this.inputManager = new InputManager(this, DEFAULT_KEYBINDS);
    this.playerController = new PlayerController(
      this.player,
      this.inputManager,
      DEFAULT_PLAYER_TUNING,
    );
    this.playerAnimator = new PlayerAnimator(this.player);
    this.eventBus = new GameplayEventBus();
    this.skillSystem = new SkillSystem(
      this.player,
      SKILL_DEFINITIONS,
      this.eventBus,
    );
    this.combatSystem = new CombatSystem(
      this.player,
      this.eventBus,
      TOOL_DEFINITIONS,
    );
    this.defenseToolSystem = new DefenseToolSystem(
      this.eventBus,
      TOOL_DEFINITIONS,
    );
    this.strayDogEvent = new StrayDogEvent(this.eventBus);
    this.drawbackDiscovery = new DrawbackDiscovery(
      this.progress,
      this.eventBus,
    );

    this.checkpointSystem = new CheckpointSystem(
      this.player,
      this.eventBus,
      stage.id,
      this.runtime,
    );
    this.restartController = new RestartController(
      this.player,
      this.checkpointSystem,
      { x: 218, y: GAME_HEIGHT - 88, facing: 1 },
      stage.id,
      this.runtime,
      this.eventBus,
      () => {
        this.enemySystem?.resetForAttempt();
        this.trapSystem?.resetForAttempt(
          (this.runtime?.randomSeed ?? 1) + (this.runtime?.attempt ?? 1),
        );
        this.combatSystem?.resetForStage();
      },
    );
    this.enemySystem = new EnemySystem(
      this,
      this.player,
      this.eventBus,
      stage.id,
      () => this.checkpointSystem?.getSnapshot()?.checkpointId ?? null,
    );
    this.enemySystem.spawn(
      stage.segments.flatMap((segment) => segment.enemies),
    );
    this.trapSystem = new TrapSystem(
      this,
      this.player,
      this.eventBus,
      stage.id,
      () => this.checkpointSystem?.getSnapshot()?.checkpointId ?? null,
    );
    this.trapSystem.spawn(
      stage.segments.flatMap((segment) => segment.traps),
      this.runtime.randomSeed,
    );
    this.deathSystem = new DeathSystem(
      this.progress,
      this.runtime,
      this.restartController,
      this.eventBus,
    );

    // The prototype scene exposes two unlocked skills for manual testing.
    this.skillSystem.unlockAfterBoss("world-01-boss");
    this.skillSystem.unlockAfterBoss("world-03-boss");

    this.eventBus.on("slipper-hit", (payload) => {
      this.eventLogText?.setText("event: slipper-hit  combo " + payload.comboCount);
      this.enemySystem?.damageInFront(1, payload.now);
    });
    this.eventBus.on("slipper-sneeze", () => {
      this.eventLogText?.setText("event: 에취!  slipper-sneeze  knockback 3m");
    });
    this.eventBus.on("bite-hit", () => {
      this.eventLogText?.setText("event: bite-hit");
    });
    this.eventBus.on("bite-hit", (payload) => {
      this.enemySystem?.damageInFront(2, payload.now);
    });
    this.eventBus.on("skill-used", (payload) => {
      this.eventLogText?.setText("event: skill-used  " + payload.skillId);
    });
    this.eventBus.on("stray-dog-surge", (payload) => {
      this.eventLogText?.setText(
        "event: stray-dog-surge  +" + payload.count + " route blockers",
      );
    });
    this.eventBus.on("drawback-discovered", (payload) => {
      this.eventLogText?.setText(
        "event: drawback-discovered  " + payload.drawbackId,
      );
    });
    this.eventBus.on("checkpoint-reached", (payload) => {
      this.eventLogText?.setText(
        "event: checkpoint-reached  " + payload.checkpointId,
      );
    });
    this.eventBus.on("enemy-contact", (payload) => {
      this.eventLogText?.setText(
        "event: enemy-contact  " + payload.enemyId,
      );
    });
    this.eventBus.on("trap-triggered", (payload) => {
      this.eventLogText?.setText(
        "event: trap-triggered  " + payload.trapId,
      );
    });
    this.eventBus.on("death", (payload) => {
      this.eventLogText?.setText(
        "event: death  " + payload.cause + "  retrying",
      );
    });
    this.eventBus.on("restart", (payload) => {
      this.eventLogText?.setText(
        "event: restart  attempt " + payload.attempt,
      );
    });

    this.events.once("shutdown", () => {
      this.inputManager?.destroy();
      this.strayDogEvent?.destroy();
      this.drawbackDiscovery?.destroy();
      this.deathSystem?.destroy();
      this.enemySystem?.destroy();
      this.trapSystem?.destroy();
      this.eventBus?.clear();
    });

    this.add
      .text(36, 32, "T01  ·  Corgi player controller", {
        color: "#5f3942",
        fontFamily: "monospace",
        fontSize: "22px",
      })
      .setResolution(2);
    this.add
      .text(36, 64, "WASD / 방향키 이동   SPACE 점프   J 공격   K 돌진   L 짖기", {
        color: "#8b5a56",
        fontFamily: "sans-serif",
        fontSize: "18px",
      })
      .setResolution(2);

    this.stateText = this.add
      .text(36, GAME_HEIGHT - 44, "state: idle", {
        color: "#8b5a56",
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setResolution(2);
    this.eventLogText = this.add
      .text(36, 96, "event: waiting for input", {
        color: "#8b5a56",
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setResolution(2);

    if (data.assetLoadError) {
      this.add
        .text(36, GAME_HEIGHT - 70, data.assetLoadError, {
          color: "#8f283d",
          fontFamily: "monospace",
          fontSize: "16px",
        })
        .setResolution(2);
    }
  }

  public update(time: number, delta: number): void {
    this.playerController?.update(time, delta);
    const snapshot = this.inputManager?.getSnapshot();

    if (snapshot?.attackPressed) {
      this.combatSystem?.tryAttack(time);
    }
    if (snapshot?.dashPressed) {
      this.skillSystem?.use("dash", time);
    }
    if (snapshot?.barkPressed) {
      this.skillSystem?.use("bark", time);
    }

    this.combatSystem?.update(time);
    this.enemySystem?.update(time);
    this.trapSystem?.update(time);
    this.playerAnimator?.update(time);

    const checkpointId = this.checkpointSystem?.getSnapshot()?.checkpointId;
    const firstCheckpointId = getStageDefinition("world-01-stage-1").checkpointIds[0];
    if (
      this.player &&
      !checkpointId &&
      firstCheckpointId &&
      this.player.x >= 620
    ) {
      this.checkpointSystem?.activate(
        firstCheckpointId,
        620,
        GAME_HEIGHT - 88,
        this.player.flipX ? -1 : 1,
        time,
      );
    }

    if (this.player && this.stateText) {
      this.stateText.setText(
        "state: " +
          this.player.getAnimationState() +
          "   velocity: " +
          Math.round(this.player.body.velocity.x) +
          "   deaths: " +
          (this.progress?.deathsTotal ?? 0) +
          "   coins: " +
          (this.runtime?.currentStageCoins ?? 0) +
          "   checkpoint: " +
          (checkpointId ?? "spawn"),
      );
    }
  }

  private createBackdrop(): void {
    this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0xf5e7c7,
    );
    this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 112,
      GAME_WIDTH,
      110,
      0xe8cda0,
    );
    this.add.circle(1040, 142, 58, 0xf0b95f, 0.8);
    this.add.rectangle(820, 450, 260, 18, 0xc78b72, 0.75);
    this.add.rectangle(1010, 380, 170, 18, 0xc78b72, 0.55);
  }
}
