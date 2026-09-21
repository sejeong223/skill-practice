"use client";
import type { ReactElement } from "react";
import type { DialogueLine } from "@/game/cutscenes/types";
export function DialogueBox({ lines }: { readonly lines: readonly DialogueLine[] }): ReactElement {
  return <div className="dialogue-box">{lines.map((line) => <p className={"dialogue-line speaker-" + line.speaker} key={line.speaker + line.text}><strong>{line.speaker}</strong><span>{line.text}</span></p>)}</div>;
}
