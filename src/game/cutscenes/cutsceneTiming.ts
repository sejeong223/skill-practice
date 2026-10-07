import type { CutsceneBeat } from "./types";

export function getCaptionPlaybackMs(baseDurationMs: number, text: string): number {
  const glyphCount = Array.from(text).length;
  return glyphCount === 0
    ? baseDurationMs
    : Math.max(baseDurationMs, 1200 + glyphCount * 65);
}

export function getBeatPlaybackMs(beat: CutsceneBeat): number {
  const text = [
    beat.narration,
    ...(beat.dialogue?.map((line) => line.text) ?? []),
    beat.itemCard?.title,
    beat.itemCard?.description,
  ].filter((part): part is string => Boolean(part)).join(" ");

  return getCaptionPlaybackMs(beat.durationMs, text);
}
