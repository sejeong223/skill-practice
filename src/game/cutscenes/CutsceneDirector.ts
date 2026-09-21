import * as Phaser from "phaser";
import type { GameEventBus } from "../bridge/GameEventBus";
import type { ProgressState } from "../core/types";
import { AudioManager } from "../audio/AudioManager";
import { CameraDirector } from "../camera/CameraDirector";
import { CutsceneTimeline } from "./CutsceneTimeline";
import type { CameraAction, CutsceneBeat, CutsceneScript } from "./types";
import { Player } from "../entities/Player";

export class CutsceneDirector {
  private readonly player: Player;
  private readonly progress: ProgressState;
  private readonly scripts: ReadonlyMap<string, CutsceneScript>;
  private readonly eventBus?: GameEventBus;
  private readonly cameraDirector?: CameraDirector;
  private readonly audioManager?: AudioManager;
  private readonly timeline = new CutsceneTimeline();
  private playing = false;
  private canSkip = false;
  private skipped = false;
  private currentId: string | null = null;

  public constructor(
    _scene: Phaser.Scene,
    player: Player,
    progress: ProgressState,
    scripts: readonly CutsceneScript[],
    eventBus?: GameEventBus,
    cameraDirector?: CameraDirector,
    audioManager?: AudioManager,
  ) {
    this.player = player;
    this.progress = progress;
    this.scripts = new Map(scripts.map((script) => [script.id, script]));
    this.eventBus = eventBus;
    this.cameraDirector = cameraDirector;
    this.audioManager = audioManager;
  }

  public play(id: string): Promise<void> {
    const script = this.scripts.get(id);
    if (!script || this.playing) return Promise.resolve();
    this.playing = true;
    this.skipped = false;
    this.currentId = id;
    this.canSkip = this.progress.seenCutsceneIds.includes(id);
    this.player.lockControl("cutscene");
    this.eventBus?.emit("cutscene-started", { cutsceneId: id, skipAllowed: this.canSkip });
    return this.timeline.play(script.beats, (beat, index) => this.handleBeat(script, beat, index)).then(() => this.finish(id));
  }

  public skip(): void {
    if (this.playing && this.canSkip) {
      this.skipped = true;
      this.timeline.skip();
    }
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public canSkipCurrent(): boolean {
    return this.canSkip;
  }

  public destroy(): void {
    this.timeline.cancel();
    this.player.unlockControl("cutscene");
    this.playing = false;
  }

  private handleBeat(script: CutsceneScript, beat: CutsceneBeat, index: number): void {
    this.eventBus?.emit("cutscene-beat", { cutsceneId: script.id, beat, index, skipAllowed: this.canSkip && beat.skipAllowedAfterSeen });
    beat.camera?.forEach((action) => this.applyCameraAction(action));
  }

  private applyCameraAction(action: CameraAction): void {
    if (!this.cameraDirector) return;
    switch (action.kind) {
      case "pan": this.cameraDirector.playCutscene(action.x ?? this.player.x, action.y ?? this.player.y, action.durationMs ?? 500); break;
      case "zoom": this.cameraDirector.playCutscene(this.player.x, this.player.y, action.durationMs ?? 500, action.value ?? 1.1); break;
      case "shake": this.cameraDirector.shake(action.durationMs, action.value); break;
      case "fade": this.cameraDirector.fadeToBlack(action.durationMs); break;
    }
  }

  private finish(id: string): void {
    if (!this.progress.seenCutsceneIds.includes(id)) this.progress.seenCutsceneIds.push(id);
    this.player.unlockControl("cutscene");
    this.cameraDirector?.endCutscene();
    this.audioManager?.stopMusic();
    this.eventBus?.emit("cutscene-finished", { cutsceneId: id, skipped: this.skipped });
    this.playing = false;
    this.currentId = null;
    this.canSkip = false;
  }
}
