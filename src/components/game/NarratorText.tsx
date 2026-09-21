"use client";
import type { ReactElement } from "react";
export function NarratorText({ text }: { readonly text: string }): ReactElement {
  return <p className="cutscene-narration">{text}</p>;
}
