import * as Phaser from "phaser";
import type { GameEventBus } from "../bridge/GameEventBus";
import type { ProgressState } from "../core/types";
import { AudioManager } from "../audio/AudioManager";
import { CutsceneTimeline } from "../cutscenes/CutsceneTimeline";
import { IntroActorRig } from "../cutscenes/IntroActorRig";
import { INTRO_HOME_LAYOUT } from "../cutscenes/introLayout";
import { INTRO_CUTSCENE } from "../data/cutscenes/intro";
import type { CameraAction } from "../cutscenes/types";

interface IntroSceneData {
  readonly assetLoadError?: string | null;
}

export class IntroScene extends Phaser.Scene {
  private readonly timeline = new CutsceneTimeline();
  private readonly unsubscribers: Array<() => void> = [];
  private actorRig?: IntroActorRig;
  private eventBus?: GameEventBus;
  private audioManager?: AudioManager;
  private active = false;
  private skipAllowed = false;
  private skipped = false;

  public constructor() {
    super("IntroScene");
  }

  public create(data: IntroSceneData = {}): void {
    const camera = this.cameras.main;
    camera.setBounds(
      0,
      0,
      INTRO_HOME_LAYOUT.worldSize.width,
      INTRO_HOME_LAYOUT.worldSize.height,
    );
    camera.centerOn(640, 360);
    camera.setBackgroundColor("#f6e2c5");

    this.eventBus = this.registry.get("gameEventBus") as GameEventBus | undefined;
    this.audioManager = new AudioManager(this, undefined, this.eventBus);

    if (data.assetLoadError) {
      this.showAssetError(data.assetLoadError);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
      return;
    }

    this.actorRig = new IntroActorRig(this, INTRO_HOME_LAYOUT);
    this.bindEvents();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.startCutscene();
  }

  private bindEvents(): void {
    if (!this.eventBus) return;
    this.unsubscribers.push(
      this.eventBus.on("cutscene-skip-requested", () => this.skip()),
      this.eventBus.on("cutscene-requested", (payload) => {
        if (payload.cutsceneId === INTRO_CUTSCENE.id) this.startCutscene();
      }),
    );
  }

  private startCutscene(): void {
    if (this.active) return;
    this.cameras.main.resetFX();
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(640, 360);
    this.actorRig?.reset();
    this.active = true;
    this.skipped = false;
    const progress = this.registry.get("progressState") as ProgressState | undefined;
    this.skipAllowed = progress?.seenCutsceneIds.includes(INTRO_CUTSCENE.id) ?? false;

    this.eventBus?.emit("cutscene-started", {
      cutsceneId: INTRO_CUTSCENE.id,
      skipAllowed: this.skipAllowed,
    });

    void this.timeline
      .play(INTRO_CUTSCENE.beats, (beat, index) => {
        if (!this.active) return;
        const beatSkipAllowed = this.skipAllowed && beat.skipAllowedAfterSeen;
        this.eventBus?.emit("cutscene-beat", {
          cutsceneId: INTRO_CUTSCENE.id,
          beat,
          index,
          skipAllowed: beatSkipAllowed,
        });
        beat.actors?.forEach((action) => this.actorRig?.playAction(action));
        beat.camera?.forEach((action) => this.applyCameraAction(action));
      })
      .then(() => this.finishCutscene(progress));
  }

  private skip(): void {
    if (!this.active || !this.skipAllowed) return;
    this.skipped = true;
    this.actorRig?.stop();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.timeline.skip();
  }

  private applyCameraAction(action: CameraAction): void {
    const camera = this.cameras.main;
    const x = action.x ?? camera.midPoint.x;
    const y = action.y ?? camera.midPoint.y;
    const duration = action.durationMs ?? 500;

    switch (action.kind) {
      case "pan":
        camera.pan(x, y, duration, "Sine.easeInOut");
        break;
      case "zoom":
        camera.pan(x, y, duration, "Sine.easeInOut");
        camera.zoomTo(action.value ?? 1.12, duration, "Sine.easeInOut");
        break;
      case "shake":
        camera.shake(duration, action.value ?? 0.004);
        break;
      case "fade":
        camera.fadeOut(duration, 0, 0, 0);
        break;
    }
  }

  private finishCutscene(progress?: ProgressState): void {
    if (!this.active) return;
    this.active = false;
    if (progress && !progress.seenCutsceneIds.includes(INTRO_CUTSCENE.id)) {
      progress.seenCutsceneIds.push(INTRO_CUTSCENE.id);
    }
    this.actorRig?.stop();
    this.audioManager?.stopMusic();
    this.eventBus?.emit("cutscene-finished", {
      cutsceneId: INTRO_CUTSCENE.id,
      skipped: this.skipped,
    });
    this.skipAllowed = false;
  }

  private showAssetError(message: string): void {
    const panel = this.add
      .rectangle(640, 360, 840, 250, 0x251d25, 0.96)
      .setStrokeStyle(6, 0xe7ba75, 1);
    const title = this.add.text(640, 290, "인트로 에셋 오류", {
      color: "#fff0d1",
      fontFamily: "Galmuri11, monospace",
      fontSize: "32px",
      align: "center",
    });
    const detail = this.add.text(640, 380, message, {
      color: "#f5c6a0",
      fontFamily: "Galmuri11, monospace",
      fontSize: "18px",
      align: "center",
      wordWrap: { width: 760 },
    });
    title.setOrigin(0.5).setResolution(2);
    detail.setOrigin(0.5).setResolution(2);
    panel.setDepth(100);
    title.setDepth(101);
    detail.setDepth(101);
  }

  private cleanup(): void {
    this.active = false;
    this.timeline.cancel();
    this.actorRig?.destroy();
    this.actorRig = undefined;
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    this.audioManager?.destroy();
    this.audioManager = undefined;
  }
}
