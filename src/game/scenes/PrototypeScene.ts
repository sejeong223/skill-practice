import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { GameplayEventBus } from "../core/events";
import { createDefaultProgressState } from "../core/constants";
import { SKILL_DEFINITIONS } from "../data/skills";
import { TOOL_DEFINITIONS } from "../data/tools";
import { PlayerAnimator } from "../entities/PlayerAnimator";
import { Player } from "../entities/Player";
import { DEFAULT_PLAYER_TUNING } from "../entities/playerTypes";
import { DEFAULT_KEYBINDS, InputManager } from "../input/InputManager";
import { CombatSystem } from "../systems/CombatSystem";
import { DefenseToolSystem } from "../systems/DefenseToolSystem";
import { DrawbackDiscovery } from "../systems/DrawbackDiscovery";
import { PlayerController } from "../systems/PlayerController";
import { SkillSystem } from "../systems/SkillSystem";
import { StrayDogEvent } from "../systems/StrayDogEvent";

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
  private skillSystem?: SkillSystem;
  private combatSystem?: CombatSystem;
  private defenseToolSystem?: DefenseToolSystem;
  private strayDogEvent?: StrayDogEvent;
  private drawbackDiscovery?: DrawbackDiscovery;

  public constructor() {
    super("PrototypeScene");
  }

  public create(data: PrototypeSceneData = {}): void {
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
      createDefaultProgressState(),
      this.eventBus,
    );

    // The prototype scene exposes two unlocked skills for manual testing.
    this.skillSystem.unlockAfterBoss("world-01-boss");
    this.skillSystem.unlockAfterBoss("world-03-boss");

    this.eventBus.on("slipper-hit", (payload) => {
      this.eventLogText?.setText("event: slipper-hit  combo " + payload.comboCount);
    });
    this.eventBus.on("slipper-sneeze", () => {
      this.eventLogText?.setText("event: 에취!  slipper-sneeze  knockback 3m");
    });
    this.eventBus.on("bite-hit", () => {
      this.eventLogText?.setText("event: bite-hit");
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

    this.events.once("shutdown", () => {
      this.inputManager?.destroy();
      this.strayDogEvent?.destroy();
      this.drawbackDiscovery?.destroy();
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
    this.playerAnimator?.update(time);

    if (this.player && this.stateText) {
      this.stateText.setText(
        "state: " +
          this.player.getAnimationState() +
          "   velocity: " +
          Math.round(this.player.body.velocity.x),
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
