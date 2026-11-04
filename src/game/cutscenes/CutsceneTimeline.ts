import type { CutsceneBeat } from "./types";

export type CutsceneBeatHandler = (beat: CutsceneBeat, index: number) => void;

export class CutsceneTimeline {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private resolve?: () => void;
  private token = 0;
  private nextBeat?: () => void;
  private allowManualAdvance = false;
  private lastBeatAt = 0;
  private paused = false;
  private deadline = 0;
  private remaining = 0;

  public pause(): void {
    if (this.paused) return;
    this.paused = true;
    if (this.timer !== undefined) this.remaining = Math.max(0, this.deadline - Date.now());
    clearTimeout(this.timer); this.timer = undefined;
  }
  public resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.nextBeat) this.schedule(this.remaining);
  }
  private schedule(duration: number): void {
    this.remaining = duration;
    if (this.paused) return;
    this.deadline = Date.now() + duration;
    this.timer = setTimeout(() => { this.timer = undefined; this.nextBeat?.(); }, duration);
  }

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
        this.schedule(beat.durationMs);
      };
      this.nextBeat = next;
      if (this.paused) this.remaining = 0; else next();
    });
  }

  public advance(): void {
    if (this.paused || !this.allowManualAdvance || !this.nextBeat || Date.now() - this.lastBeatAt < 120) return;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.nextBeat();
  }

  public skip(): void {
    if (this.paused) return;
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
