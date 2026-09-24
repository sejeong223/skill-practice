"use client";
import { useEffect, useState, type ReactElement } from "react";
import type { GameEventBus } from "@/game/bridge/GameEventBus";
import type { CutsceneBeat } from "@/game/cutscenes/types";
import { DialogueBox } from "./DialogueBox";
import { ItemCard } from "./ItemCard";
import { NarratorText } from "./NarratorText";

export interface CutsceneOverlayProps {
  readonly eventBus: GameEventBus;
  readonly onSkip: () => void;
}

export function CutsceneOverlay({ eventBus, onSkip }: CutsceneOverlayProps): ReactElement | null {
  const [state, setState] = useState<{ beat: CutsceneBeat; index: number; skipAllowed: boolean } | null>(null);
  useEffect(() => {
    const removeStart = eventBus.on("cutscene-started", () => setState(null));
    const removeBeat = eventBus.on("cutscene-beat", (payload) => setState({ beat: payload.beat, index: payload.index, skipAllowed: payload.skipAllowed }));
    const removeFinish = eventBus.on("cutscene-finished", () => setState(null));
    return () => { removeStart(); removeBeat(); removeFinish(); };
  }, [eventBus]);
  useEffect(() => {
    if (!state?.skipAllowed) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onSkip();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onSkip, state?.skipAllowed]);
  if (!state) return null;
  const { beat, index, skipAllowed } = state;
  return (
    <div className="cutscene-overlay">
      <div className="cutscene-vignette" />
      {beat.itemCard && <ItemCard item={beat.itemCard} />}
      {(beat.narration || beat.dialogue) && (
        <section className="cutscene-caption-frame" aria-label="컷신 자막">
          {beat.narration && (
            <NarratorText text={beat.narration} durationMs={beat.durationMs} resetKey={beat.id} />
          )}
          {beat.dialogue && (
            <DialogueBox lines={beat.dialogue} durationMs={beat.durationMs} resetKey={beat.id} />
          )}
        </section>
      )}
      <div className="cutscene-footer">
        <span>{String(index + 1).padStart(2, "0")} / 11</span>
        {skipAllowed && <button className="primary-button" type="button" onClick={onSkip}>건너뛰기 · ESC</button>}
      </div>
    </div>
  );
}
