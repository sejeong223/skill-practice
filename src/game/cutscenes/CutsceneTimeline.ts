import type { CutsceneBeat } from "./types";

export type CutsceneBeatHandler = (beat: CutsceneBeat, index: number) => void;

export class CutsceneTimeline {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private resolve?: () => void;
  private token = 0;

  public play(beats: readonly CutsceneBeat[], onBeat: CutsceneBeatHandler): Promise<void> {
    this.cancel();
    const token = ++this.token;
    return new Promise((resolve) => {
      this.resolve = resolve;
      let index = 0;
      const next = (): void => {
        if (token !== this.token) return;
        if (index >= beats.length) { this.finish(); return; }
        const beat = beats[index];
        onBeat(beat, index);
        index += 1;
        this.timer = setTimeout(next, beat.durationMs);
      };
      next();
    });
  }

  public skip(): void {
    this.finish();
  }

  public cancel(): void {
    this.token += 1;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.resolve = undefined;
  }

  private finish(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    const resolve = this.resolve;
    this.resolve = undefined;
    resolve?.();
  }
}
