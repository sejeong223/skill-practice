import * as Phaser from "phaser";
import { GameEventBus } from "../bridge/GameEventBus";
import type { ProgressState } from "../core/types";
import { getBossVictoryPresentation, type BossVictoryStageId } from "../data/bossVictoryPresentation";

export interface World01StageClearSceneData {
  readonly stageId: BossVictoryStageId;
  readonly nextStageId: "world-02-stage-1" | "world-03-stage-1";
}

export class World01StageClearScene extends Phaser.Scene {
  private transitioning = false;
  private canContinue = false;
  private progress?: ProgressState;
  private stageData?: World01StageClearSceneData;
  private continueDelay?: Phaser.Time.TimerEvent;

  public constructor() {
    super("World01StageClearScene");
  }

  public create(data?: Partial<World01StageClearSceneData>): void {
    this.transitioning = false;
    this.canContinue = false;
    this.stageData = undefined;
    this.progress = undefined;
    this.cameras.main.setBackgroundColor("#9bdcf2");
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(640, 360);

    const eventBus = this.registry.get("gameEventBus");
    const progress = this.registry.get("progressState") as ProgressState | undefined;
    const presentation = getBossVictoryPresentation(data?.stageId);
    if (
      !data?.stageId || !presentation ||
      data.nextStageId !== presentation.nextStageId ||
      !(eventBus instanceof GameEventBus) ||
      !progress || !progress.clearedStages.includes(data.stageId)
    ) {
      this.add.rectangle(640, 360, 1280, 720, 0x221d29);
      this.add.text(640, 360, "STAGE CLEAR scene data error", {
        fontFamily: "Galmuri11Pixel, monospace",
        fontSize: "32px",
        color: "#ffdddd",
      }).setOrigin(0.5);
      return;
    }
    this.progress = progress;
    this.stageData = { stageId: data.stageId, nextStageId: data.nextStageId };

    if (this.textures.exists(presentation.backgroundKey)) {
      this.add.image(640, 360, presentation.backgroundKey).setDisplaySize(1280, 720);
    }
    this.add.rectangle(640, 360, 1280, 720, 0x16212b, 0.7);
    if (this.textures.exists(presentation.bossTextureKey)) {
      this.add.sprite(990, 555, presentation.bossTextureKey, presentation.defeatedFrame)
        .setFlipX(presentation.defeatedFlipX).setScale(1.4).setAlpha(0.65);
    }
    const panel = this.add.rectangle(640, 340, 920, 350, 0x1b2630, 0.94);
    panel.setStrokeStyle(5, 0xb17b2a);
    this.add.text(640, 292, "[STAGE CLEAR!]", {
      fontFamily: "Galmuri11Pixel, monospace",
      fontSize: "64px",
      color: "#FFD34D",
      stroke: "#74501b",
      strokeThickness: 8,
      shadow: { offsetX: 5, offsetY: 6, color: "#0b0f17", blur: 3, fill: true },
    }).setOrigin(0.5);

    const button = this.add.rectangle(640, 430, 420, 68, 0xffd34d)
      .setStrokeStyle(4, 0x6b4317)
      .setInteractive({ useHandCursor: true });
    const label = this.add.text(640, 430, presentation.clearButtonLabel, {
      fontFamily: "Galmuri11Pixel, monospace",
      fontSize: "28px",
      color: "#302519",
    }).setOrigin(0.5);
    button.on("pointerover", () => button.setFillStyle(0xffeb91));
    button.on("pointerout", () => button.setFillStyle(0xffd34d));
    button.on("pointerdown", this.continueToNextStage, this);
    label.setInteractive({ useHandCursor: true });
    label.on("pointerdown", this.continueToNextStage, this);
    this.input.keyboard?.on("keydown-ENTER", this.continueToNextStage, this);
    this.input.keyboard?.on("keydown-SPACE", this.continueToNextStage, this);
    this.continueDelay = this.time.delayedCall(250, () => { this.canContinue = true; });

    eventBus.emit("stage-clear-scene-opened", {
      stageId: data.stageId,
      nextStageId: data.nextStageId,
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.continueDelay?.remove(false);
      this.continueDelay = undefined;
      button.off("pointerdown", this.continueToNextStage, this);
      label.off("pointerdown", this.continueToNextStage, this);
      this.input.keyboard?.off("keydown-ENTER", this.continueToNextStage, this);
      this.input.keyboard?.off("keydown-SPACE", this.continueToNextStage, this);
    });
  }

  private continueToNextStage(): void {
    if (!this.canContinue || this.transitioning || !this.progress || !this.stageData) return;
    this.transitioning = true;
    if (this.stageData.stageId === "world-02-stage-boss") {
      this.scene.start("World01SkillUnlockScene", {
        ...this.stageData,
        skillId: "bite",
      });
    } else {
      this.scene.start("World02EntranceScene", { nextStageId: "world-02-stage-1" });
    }
  }
}
