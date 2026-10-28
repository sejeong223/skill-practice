import * as Phaser from "phaser";
import { GameEventBus } from "../bridge/GameEventBus";
import { AudioManager } from "../audio/AudioManager";
import type { ProgressState } from "../core/types";
import { WORLD03_ENTRANCE_CUTSCENE } from "../data/cutscenes/worlds";

export interface World03EntranceSceneData {
  readonly nextStageId: "world-03-stage-1";
}

const IMAGE_KEYS = [
  "world-03-entrance-construction",
  "world-03-entrance-corgi-cough",
  "world-03-entrance-corgi-resolved",
] as const;

export class World03EntranceScene extends Phaser.Scene {
  private progress?: ProgressState;
  private eventBus?: GameEventBus;
  private audioManager?: AudioManager;
  private background?: Phaser.GameObjects.Image;
  private portrait?: Phaser.GameObjects.Image;
  private dimmer?: Phaser.GameObjects.Rectangle;
  private beatTimer?: Phaser.Time.TimerEvent;
  private excavatorTimer?: Phaser.Time.TimerEvent;
  private removeSkipRequest?: () => void;
  private canSkip = false;
  private finished = false;

  public constructor() {
    super("World03EntranceScene");
  }

  public create(data?: Partial<World03EntranceSceneData>): void {
    this.finished = false;
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(640, 360);
    this.cameras.main.setBackgroundColor("#75b7ec");

    const eventBus = this.registry.get("gameEventBus");
    const progress = this.registry.get("progressState") as ProgressState | undefined;
    const missingImage = IMAGE_KEYS.find((key) => !this.textures.exists(key));
    if (
      data?.nextStageId !== "world-03-stage-1" ||
      !(eventBus instanceof GameEventBus) ||
      !progress ||
      missingImage
    ) {
      this.add.rectangle(640, 360, 1280, 720, 0x221d29);
      this.add.text(640, 360, missingImage
        ? `월드 3 진입 그림을 불러오지 못했습니다: ${missingImage}`
        : "월드 3 진입 데이터를 불러오지 못했습니다.", {
        fontFamily: "Galmuri11Pixel, monospace",
        fontSize: "25px",
        color: "#ffdddd",
        align: "center",
        wordWrap: { width: 1000 },
      }).setOrigin(0.5);
      return;
    }

    this.eventBus = eventBus;
    this.progress = progress;
    this.canSkip = progress.seenCutsceneIds.includes(WORLD03_ENTRANCE_CUTSCENE.id);
    this.removeSkipRequest = eventBus.on("cutscene-skip-requested", () => this.skip());
    this.input.keyboard?.on("keydown-ESC", this.skip, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.audioManager = new AudioManager(this, undefined, eventBus);

    eventBus.emit("cutscene-started", {
      cutsceneId: WORLD03_ENTRANCE_CUTSCENE.id,
      skipAllowed: this.canSkip,
    });
    this.background = this.add.image(640, 360, IMAGE_KEYS[0]);
    const coverScale = Math.max(1280 / this.background.width, 720 / this.background.height);
    this.background.setDisplaySize(this.background.width * coverScale, this.background.height * coverScale);
    this.playBeat(0);
  }

  private playBeat(index: number): void {
    if (this.finished) return;
    const beat = WORLD03_ENTRANCE_CUTSCENE.beats[index];
    if (!beat) {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.beatTimer = this.time.delayedCall(400, () => this.finish(false));
      return;
    }

    if (index === 0 && this.background) {
      this.tweens.add({
        targets: this.background,
        scaleX: this.background.scaleX * 1.05,
        scaleY: this.background.scaleY * 1.05,
        duration: WORLD03_ENTRANCE_CUTSCENE.beats[0].durationMs +
          WORLD03_ENTRANCE_CUTSCENE.beats[1].durationMs,
        ease: "Sine.easeInOut",
      });
    } else if (index === 2) {
      this.showPortrait(IMAGE_KEYS[1]);
    } else if (index === 4) {
      this.showPortrait(IMAGE_KEYS[2]);
    }
    this.eventBus?.emit("cutscene-beat", {
      cutsceneId: WORLD03_ENTRANCE_CUTSCENE.id,
      beat,
      index,
      totalBeats: WORLD03_ENTRANCE_CUTSCENE.beats.length,
      skipAllowed: this.canSkip,
      manualAdvance: false,
      captionIndex: 0,
      captionCount: 1,
    });
    if (index === 1) {
      this.excavatorTimer = this.time.delayedCall(900, () => {
        if (!this.finished) this.audioManager?.playSfx("world-03-excavator");
      });
    }
    this.beatTimer = this.time.delayedCall(beat.durationMs, () => this.playBeat(index + 1));
  }

  private showPortrait(assetKey: string): void {
    if (this.portrait) {
      this.tweens.killTweensOf(this.portrait);
      this.portrait.destroy();
    }
    if (!this.dimmer) {
      this.dimmer = this.add.rectangle(640, 360, 1280, 720, 0x162838, 0.19);
    }
    const compact = window.innerWidth <= 720;
    const portraitSize = compact ? 360 : 480;
    this.portrait = this.add.image(640, compact ? 237 : 342, assetKey)
      .setDisplaySize(portraitSize, portraitSize);
    this.portrait.setAlpha(0);
    this.tweens.add({ targets: this.portrait, alpha: 1, duration: 220 });
  }

  private skip(): void {
    if (this.canSkip) this.finish(true);
  }

  private finish(skipped: boolean): void {
    if (this.finished || !this.progress || !this.eventBus) return;
    this.finished = true;
    if (!this.progress.seenCutsceneIds.includes(WORLD03_ENTRANCE_CUTSCENE.id)) {
      this.progress.seenCutsceneIds.push(WORLD03_ENTRANCE_CUTSCENE.id);
    }
    this.eventBus.emit("cutscene-finished", {
      cutsceneId: WORLD03_ENTRANCE_CUTSCENE.id,
      skipped,
    });
    this.scene.start("StageScene", {
      stageId: "world-03-stage-1",
      playerName: this.progress.playerName,
    });
  }

  private cleanup(): void {
    this.beatTimer?.remove(false);
    this.beatTimer = undefined;
    this.excavatorTimer?.remove(false);
    this.excavatorTimer = undefined;
    this.removeSkipRequest?.();
    this.removeSkipRequest = undefined;
    this.input.keyboard?.off("keydown-ESC", this.skip, this);
    this.tweens.killTweensOf([this.background, this.portrait].filter(Boolean));
    this.audioManager?.destroy();
    this.audioManager = undefined;
    this.background = undefined;
    this.portrait = undefined;
    this.dimmer = undefined;
  }
}
