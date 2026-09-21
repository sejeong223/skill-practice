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
  const [state, setState] = useState<{ beat: CutsceneBeat; skipAllowed: boolean } | null>(null);
  useEffect(() => {
    const removeStart = eventBus.on("cutscene-started", () => setState(null));
    const removeBeat = eventBus.on("cutscene-beat", (payload) => setState({ beat: payload.beat, skipAllowed: payload.skipAllowed }));
    const removeFinish = eventBus.on("cutscene-finished", () => setState(null));
    return () => { removeStart(); removeBeat(); removeFinish(); };
  }, [eventBus]);
  useEffect(() => {
    if (!state?.skipAllowed) return undefined;
    const handleKey = (event: KeyboardEvent) => { if (event.key !== "Tab" && event.key !== "Shift") { event.preventDefault(); onSkip(); } };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onSkip, state?.skipAllowed]);
  if (!state) return null;
  const { beat, skipAllowed } = state;
  return <div className="cutscene-overlay"><div className="cutscene-vignette" />{beat.itemCard && <ItemCard item={beat.itemCard} />}{beat.narration && <NarratorText text={beat.narration} />}{beat.dialogue && <DialogueBox lines={beat.dialogue} />}<div className="cutscene-footer"><span>{beat.id}</span>{skipAllowed && <button className="primary-button" type="button" onClick={onSkip}>건너뛰기</button>}</div></div>;
}
