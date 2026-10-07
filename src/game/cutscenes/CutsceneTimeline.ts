import type { CutsceneBeat } from "./types";

export type CutsceneBeatHandler = (beat: CutsceneBeat, index: number) => void;

export class CutsceneTimeline {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private resolve?: () => void;
  private token = 0;
  private nextBeat?: () => void;
  private allowManualAdvance = false;
  private lastBeatAt = 0;

  public play(beats: readonly CutsceneBeat[], onBeat: CutsceneBeatHandler, allowManualAdvance = false): Promise<void> {
    this.cancel();
    const token = ++this.token;
    this.allowManualAdvance = allowManualAdvance;
    return new Promise((resolve) => {
      this.resolve = resolve;
      let index = 0;
      const next = (): void => {
        if (token !== this.token) return;
        if (index >= beats.length) { this.finish(); return; }
        const beat = beats[index];
        onBeat(beat, index);
        this.lastBeatAt = Date.now();
        index += 1;
        this.nextBeat = next;
        this.timer = setTimeout(next, beat.durationMs);
      };
      next();
    });
  }

  public advance(): void {
    if (!this.allowManualAdvance || !this.nextBeat || Date.now() - this.lastBeatAt < 120) return;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.nextBeat();
  }

  public skip(): void {
    this.finish();
  }

  public cancel(): void {
    this.token += 1;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.resolve = undefined;
    this.nextBeat = undefined;
    this.allowManualAdvance = false;
  }

  private finish(): void {
    this.token += 1;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.nextBeat = undefined;
    this.allowManualAdvance = false;
    const resolve = this.resolve;
    this.resolve = undefined;
    resolve?.();
  }
}
