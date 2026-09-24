"use client";
import type { ReactElement } from "react";
import type { DialogueLine } from "@/game/cutscenes/types";
import { TypewriterText } from "./TypewriterText";

export interface DialogueBoxProps {
  readonly lines: readonly DialogueLine[];
  readonly durationMs: number;
  readonly resetKey: string;
  readonly forceReveal?: boolean;
  readonly onComplete?: () => void;
}

const SPEAKER_LABELS: Readonly<Record<DialogueLine["speaker"], string>> = {
  narrator: "나레이션",
  owner: "주인",
  corgi: "코기",
  cat: "턱시도",
};

export function DialogueBox({ lines, durationMs, resetKey, forceReveal, onComplete }: DialogueBoxProps): ReactElement {
  return (
    <div className="dialogue-box">
      {lines.map((line) => (
        <p className={"dialogue-line speaker-" + line.speaker} key={line.speaker + line.text}>
          <strong className="dialogue-speaker">{SPEAKER_LABELS[line.speaker]}</strong>
          <TypewriterText
            className="dialogue-line-text"
            text={line.text}
            durationMs={durationMs}
            resetKey={resetKey + ":" + line.speaker + ":" + line.text}
            forceReveal={forceReveal}
            onComplete={onComplete}
          />
        </p>
      ))}
    </div>
  );
}
