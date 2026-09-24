"use client";
import type { ReactElement } from "react";
import { TypewriterText } from "./TypewriterText";

export interface NarratorTextProps {
  readonly text: string;
  readonly durationMs: number;
  readonly resetKey: string;
}

export function NarratorText({ text, durationMs, resetKey }: NarratorTextProps): ReactElement {
  return (
    <div className="cutscene-narration">
      <span className="cutscene-speaker-label">나레이션</span>
      <TypewriterText text={text} durationMs={durationMs} resetKey={resetKey} />
    </div>
  );
}
