import * as Phaser from "phaser";
import type { GameEventBus } from "../bridge/GameEventBus";
import type { ProgressState } from "../core/types";
import { AudioManager } from "../audio/AudioManager";
import { IntroActorRig } from "../cutscenes/IntroActorRig";
import { getCaptionPlaybackMs } from "../cutscenes/cutsceneTiming";
import { INTRO_HOME_LAYOUT } from "../cutscenes/introLayout";
import { INTRO_CUTSCENE } from "../data/cutscenes/intro";
import type { CameraAction, CutsceneBeat, DialogueLine } from "../cutscenes/types";

interface IntroSceneData {
  readonly assetLoadError?: string | null;
}

export class IntroScene extends Phaser.Scene {
  private readonly unsubscribers: Array<() => void> = [];
  private actorRig?: IntroActorRig;
  private eventBus?: GameEventBus;
  private audioManager?: AudioManager;
  private progress?: ProgressState;
  private currentBeat?: CutsceneBeat;
  private currentCaptions: Array<{ readonly narration?: string; readonly dialogue?: DialogueLine }> = [];
  private captionTimer?: Phaser.Time.TimerEvent;
  private lastCaptionAt = 0;
  private beatIndex = 0;
  private captionIndex = 0;
  private active = false;
  private skipAllowed = false;
  private skipped = false;
  private nameConfirmed = false;

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
    this.progress = this.registry.get("progressState") as ProgressState | undefined;
    this.bindEvents();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    if (!this.progress?.seenCutsceneIds.includes(INTRO_CUTSCENE.id)) {
      this.startCutscene();
    }
  }

  private bindEvents(): void {
    if (!this.eventBus) return;
    this.unsubscribers.push(
      this.eventBus.on("cutscene-skip-requested", () => this.skip()),
      this.eventBus.on("cutscene-advance-requested", () => this.advance()),
      this.eventBus.on("cutscene-requested", (payload) => {
        if (payload.cutsceneId === INTRO_CUTSCENE.id) this.startCutscene();
      }),
      this.eventBus.on("player-name-confirmed", (payload) => {
        if (this.active || this.nameConfirmed) return;
        this.nameConfirmed = true;
        const progress = this.registry.get("progressState") as ProgressState | undefined;
        if (progress) {
          progress.playerName = payload.playerName;
          progress.onboardingCompleted = true;
        }
        this.scene.start("StageScene", {
          stageId: "world-01-stage-1",
          playerName: payload.playerName,
        });
      }),
    );
  }

  private startCutscene(): void {
    if (this.active) return;
    this.clearCaptionTimer();
    this.cameras.main.resetFX();
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(640, 360);
    this.actorRig?.reset();
    this.active = true;
    this.skipped = false;
    this.progress = this.registry.get("progressState") as ProgressState | undefined;
    this.skipAllowed = this.progress?.seenCutsceneIds.includes(INTRO_CUTSCENE.id) ?? false;
    this.beatIndex = 0;

    this.eventBus?.emit("cutscene-started", {
      cutsceneId: INTRO_CUTSCENE.id,
      skipAllowed: this.skipAllowed,
    });

    this.playBeat();
  }

  private playBeat(): void {
    if (!this.active) return;
    const beat = INTRO_CUTSCENE.beats[this.beatIndex];
    if (!beat) {
      this.finishCutscene();
      return;
    }

    this.currentBeat = beat;
    this.currentCaptions = [];
    if (beat.narration) this.currentCaptions.push({ narration: beat.narration });
    beat.dialogue?.forEach((line) => this.currentCaptions.push({ dialogue: line }));
    if (this.currentCaptions.length === 0) this.currentCaptions.push({});
    this.captionIndex = 0;

    beat.actors?.forEach((action) => this.actorRig?.playAction(action));
    beat.camera?.forEach((action) => this.applyCameraAction(action));
    this.emitCurrentCaption();
  }

  private emitCurrentCaption(): void {
    const beat = this.currentBeat;
    const caption = this.currentCaptions[this.captionIndex];
    if (!beat || !caption) return;

    this.clearCaptionTimer();
    const captionText = [
      caption.narration ?? caption.dialogue?.text,
      ...(this.captionIndex === 0 && beat.itemCard
        ? [beat.itemCard.title, beat.itemCard.description]
        : []),
    ].filter((text): text is string => Boolean(text)).join(" ");
    const durationMs = getCaptionPlaybackMs(beat.durationMs, captionText);
    const visibleBeat: CutsceneBeat = {
      ...beat,
      durationMs,
      narration: caption.narration,
      dialogue: caption.dialogue ? [caption.dialogue] : undefined,
      itemCard: this.captionIndex === 0 ? beat.itemCard : undefined,
      soundCue: this.captionIndex === 0 ? beat.soundCue : undefined,
      musicKey: this.captionIndex === 0 ? beat.musicKey : undefined,
    };
    this.lastCaptionAt = Date.now();
    this.eventBus?.emit("cutscene-beat", {
      cutsceneId: INTRO_CUTSCENE.id,
      beat: visibleBeat,
      index: this.beatIndex,
      totalBeats: INTRO_CUTSCENE.beats.length,
      skipAllowed: this.skipAllowed && beat.skipAllowedAfterSeen,
      manualAdvance: true,
      captionIndex: this.captionIndex,
      captionCount: this.currentCaptions.length,
    });
    this.captionTimer = this.time.delayedCall(durationMs, () => this.advance());
  }

  private advance(): void {
    if (!this.active || Date.now() - this.lastCaptionAt < 120) return;
    this.clearCaptionTimer();
    if (this.captionIndex + 1 < this.currentCaptions.length) {
      this.captionIndex += 1;
      this.emitCurrentCaption();
      return;
    }

    this.beatIndex += 1;
    this.playBeat();
  }

  private skip(): void {
    if (!this.active || !this.skipAllowed) return;
    this.clearCaptionTimer();
    this.skipped = true;
    this.actorRig?.stop();
    this.audioManager?.stopAllSounds();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.finishCutscene();
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

  private finishCutscene(): void {
    if (!this.active) return;
    this.active = false;
    this.clearCaptionTimer();
    if (this.progress && !this.progress.seenCutsceneIds.includes(INTRO_CUTSCENE.id)) {
      this.progress.seenCutsceneIds.push(INTRO_CUTSCENE.id);
    }
    this.actorRig?.stop();
    this.actorRig?.hideOwnerAndBag();
    this.audioManager?.stopMusic();
    this.eventBus?.emit("cutscene-finished", {
      cutsceneId: INTRO_CUTSCENE.id,
      skipped: this.skipped,
    });
    this.skipAllowed = false;
    this.currentBeat = undefined;
    this.currentCaptions = [];
  }

  private showAssetError(message: string): void {
    const panel = this.add
      .rectangle(640, 360, 840, 250, 0x251d25, 0.96)
      .setStrokeStyle(6, 0xe7ba75, 1);
    const title = this.add.text(640, 290, "인트로 에셋 오류", {
      color: "#fff0d1",
      fontFamily: "Galmuri11Pixel, monospace",
      fontSize: "32px",
      align: "center",
    });
    const detail = this.add.text(640, 380, message, {
      color: "#f5c6a0",
      fontFamily: "Galmuri11Pixel, monospace",
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
    this.clearCaptionTimer();
    this.currentBeat = undefined;
    this.currentCaptions = [];
    this.actorRig?.destroy();
    this.actorRig = undefined;
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    this.audioManager?.destroy();
    this.audioManager = undefined;
  }

  private clearCaptionTimer(): void {
    this.captionTimer?.remove(false);
    this.captionTimer = undefined;
  }
}
