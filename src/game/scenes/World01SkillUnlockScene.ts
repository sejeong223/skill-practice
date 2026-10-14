import * as Phaser from "phaser";
import { GameEventBus } from "../bridge/GameEventBus";
import type { ProgressState } from "../core/types";

export interface World01SkillUnlockSceneData {
  readonly stageId: "world-01-stage-boss";
  readonly nextStageId: "world-02-stage-1";
  readonly skillId: "bark";
}

export class World01SkillUnlockScene extends Phaser.Scene {
  private transitioning = false;
  private canContinue = false;
  private stageData?: World01SkillUnlockSceneData;
  private continueDelay?: Phaser.Time.TimerEvent;

  public constructor() {
    super("World01SkillUnlockScene");
  }

  public create(data?: Partial<World01SkillUnlockSceneData>): void {
    this.transitioning = false;
    this.canContinue = false;
    this.stageData = undefined;
    this.cameras.main.setBackgroundColor("#9bdcf2");
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(640, 360);

    const eventBus = this.registry.get("gameEventBus");
    const progress = this.registry.get("progressState") as ProgressState | undefined;
    if (
      data?.stageId !== "world-01-stage-boss" ||
      data.nextStageId !== "world-02-stage-1" ||
      data.skillId !== "bark" ||
      !(eventBus instanceof GameEventBus) ||
      !progress?.unlockedSkills.includes("bark") ||
      !progress.clearedStages.includes("world-01-stage-boss")
    ) {
      this.add.rectangle(640, 360, 1280, 720, 0x221d29);
      this.add.text(640, 360, "짖기 해금 안내 데이터를 불러오지 못했습니다.", {
        fontFamily: "Galmuri11Pixel, monospace",
        fontSize: "28px",
        color: "#ffdddd",
      }).setOrigin(0.5);
      return;
    }
    this.stageData = {
      stageId: data.stageId,
      nextStageId: data.nextStageId,
      skillId: data.skillId,
    };

    if (this.textures.exists("world-01-roof-day-mid")) {
      this.add.image(640, 360, "world-01-roof-day-mid").setDisplaySize(1280, 720);
    }
    this.add.rectangle(640, 360, 1280, 720, 0x16212b, 0.7);
    if (this.textures.exists("world-01-calico-boss")) {
      this.add.sprite(990, 555, "world-01-calico-boss", 2)
        .setScale(1.4).setAlpha(0.65);
    }
    this.add.rectangle(640, 350, 960, 440, 0x1b2630, 0.94)
      .setStrokeStyle(5, 0xb17b2a);
    this.add.text(640, 215, "[SKILL UNLOCKED!]", {
      fontFamily: "Galmuri11Pixel, monospace",
      fontSize: "48px",
      color: "#FFD34D",
      stroke: "#74501b",
      strokeThickness: 6,
      shadow: { offsetX: 4, offsetY: 5, color: "#0b0f17", blur: 3, fill: true },
    }).setOrigin(0.5);
    this.add.text(640, 303, "짖기", {
      fontFamily: "Galmuri11Pixel, monospace",
      fontSize: "43px",
      color: "#fff5d8",
    }).setOrigin(0.5);
    this.add.text(640, 382, "맹렬한 멍멍 소리로 보스 고양이를 순간 당황시킵니다", {
      fontFamily: "Galmuri11Pixel, monospace",
      fontSize: "23px",
      color: "#fff5d8",
      align: "center",
      wordWrap: { width: 870 },
    }).setOrigin(0.5);
    this.add.text(640, 438, "(※ 보스 공격 패턴을 잠시 멈출 수 있습니다.)", {
      fontFamily: "Galmuri11Pixel, monospace",
      fontSize: "20px",
      color: "#f0b95f",
      align: "center",
      wordWrap: { width: 870 },
    }).setOrigin(0.5);
    this.add.text(640, 529, "클릭 또는 Enter/Space로 계속", {
      fontFamily: "Galmuri11Pixel, monospace",
      fontSize: "18px",
      color: "#d9c7a3",
    }).setOrigin(0.5);

    this.input.on("pointerdown", this.continueToStageClear, this);
    this.input.keyboard?.on("keydown-ENTER", this.continueToStageClear, this);
    this.input.keyboard?.on("keydown-SPACE", this.continueToStageClear, this);
    this.continueDelay = this.time.delayedCall(250, () => { this.canContinue = true; });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    eventBus.emit("skill-unlock-scene-opened", {
      stageId: data.stageId,
      skillId: data.skillId,
    });
  }

  private continueToStageClear(): void {
    if (!this.canContinue || this.transitioning || !this.stageData) return;
    this.transitioning = true;
    this.scene.start("World01StageClearScene", {
      stageId: this.stageData.stageId,
      nextStageId: this.stageData.nextStageId,
    });
  }

  private cleanup(): void {
    this.continueDelay?.remove(false);
    this.continueDelay = undefined;
    this.input.off("pointerdown", this.continueToStageClear, this);
    this.input.keyboard?.off("keydown-ENTER", this.continueToStageClear, this);
    this.input.keyboard?.off("keydown-SPACE", this.continueToStageClear, this);
  }
}
