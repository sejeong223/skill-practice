import * as Phaser from "phaser";
import { GameEventBus } from "../bridge/GameEventBus";
import { AudioManager } from "../audio/AudioManager";
import type { ProgressState } from "../core/types";
import { WORLD_CUTSCENES } from "../data/cutscenes/worlds";

export interface World04EntranceSceneData {
  readonly nextStageId: "world-04-stage-1";
}

const INTRO_ID = "world-04-intro";
const BACKGROUND_KEY = "world-04-boss-scrapyard";
const INTRO = WORLD_CUTSCENES.find((script) => script.id === INTRO_ID);

export class World04EntranceScene extends Phaser.Scene {
  private progress?: ProgressState;
  private eventBus?: GameEventBus;
  private audioManager?: AudioManager;
  private timer?: Phaser.Time.TimerEvent;
  private removeSkipRequest?: () => void;
  private canSkip = false;
  private finished = false;

  public constructor() { super("World04EntranceScene"); }

  public create(data?: Partial<World04EntranceSceneData>): void {
    this.finished = false;
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(640, 360);
    this.cameras.main.setBackgroundColor("#574b48");
    const eventBus = this.registry.get("gameEventBus");
    const progress = this.registry.get("progressState") as ProgressState | undefined;
    if (data?.nextStageId !== "world-04-stage-1" || !(eventBus instanceof GameEventBus) ||
        !progress || !INTRO || !this.textures.exists(BACKGROUND_KEY)) {
      this.add.rectangle(640, 360, 1280, 720, 0x221d29);
      this.add.text(640, 360, "월드 4 진입 장면을 불러오지 못했습니다.", {
        fontFamily: "Galmuri11Pixel, monospace", fontSize: "28px", color: "#ffdddd",
      }).setOrigin(0.5);
      return;
    }
    this.progress = progress;
    this.eventBus = eventBus;
    this.canSkip = progress.seenCutsceneIds.includes(INTRO_ID);
    this.removeSkipRequest = eventBus.on("cutscene-skip-requested", () => this.skip());
    this.input.keyboard?.on("keydown-ESC", this.skip, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.audioManager = new AudioManager(this, undefined, eventBus);
    this.add.image(640, 360, BACKGROUND_KEY).setDisplaySize(1280, 720);
    this.add.rectangle(640, 360, 1280, 720, 0x171923, 0.28);
    eventBus.emit("cutscene-started", { cutsceneId: INTRO_ID, skipAllowed: this.canSkip });
    const beat = INTRO.beats[0];
    if (beat.musicKey) this.audioManager.playMusic(beat.musicKey);
    eventBus.emit("cutscene-beat", {
      cutsceneId: INTRO_ID, beat, index: 0, totalBeats: INTRO.beats.length,
      skipAllowed: this.canSkip, manualAdvance: false, captionIndex: 0, captionCount: 1,
    });
    this.timer = this.time.delayedCall(beat.durationMs, () => this.finish(false));
  }

  private skip(): void { if (this.canSkip) this.finish(true); }

  private finish(skipped: boolean): void {
    if (this.finished || !this.progress || !this.eventBus) return;
    this.finished = true;
    if (!this.progress.seenCutsceneIds.includes(INTRO_ID)) this.progress.seenCutsceneIds.push(INTRO_ID);
    this.eventBus.emit("cutscene-finished", { cutsceneId: INTRO_ID, skipped });
    this.scene.start("StageScene", { stageId: "world-04-stage-1", playerName: this.progress.playerName });
  }

  private cleanup(): void {
    this.timer?.remove(false);
    this.timer = undefined;
    this.removeSkipRequest?.();
    this.removeSkipRequest = undefined;
    this.input.keyboard?.off("keydown-ESC", this.skip, this);
    this.audioManager?.destroy();
    this.audioManager = undefined;
  }
}
