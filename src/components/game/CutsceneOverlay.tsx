"use client";
import { useCallback, useEffect, useState, type ReactElement } from "react";
import type { GameEventBus } from "@/game/bridge/GameEventBus";
import type { CutsceneBeat } from "@/game/cutscenes/types";
import { DialogueBox } from "./DialogueBox";
import { ItemCard } from "./ItemCard";
import { NarratorText } from "./NarratorText";

export interface CutsceneOverlayProps {
  readonly eventBus: GameEventBus;
  readonly onSkip: () => void;
}

interface CutsceneOverlayState {
  readonly beat: CutsceneBeat;
  readonly index: number;
  readonly skipAllowed: boolean;
  readonly manualAdvance: boolean;
  readonly captionIndex: number;
  readonly captionCount: number;
  readonly textComplete: boolean;
  readonly forceReveal: boolean;
}

export function CutsceneOverlay({ eventBus, onSkip }: CutsceneOverlayProps): ReactElement | null {
  const [state, setState] = useState<CutsceneOverlayState | null>(null);
  useEffect(() => {
    const removeStart = eventBus.on("cutscene-started", () => setState(null));
    const removeBeat = eventBus.on("cutscene-beat", (payload) => {
      const hasText = Boolean(payload.beat.narration || payload.beat.dialogue?.length);
      setState({
        beat: payload.beat,
        index: payload.index,
        skipAllowed: payload.skipAllowed,
        manualAdvance: payload.manualAdvance ?? false,
        captionIndex: payload.captionIndex ?? 0,
        captionCount: payload.captionCount ?? 1,
        textComplete: !hasText,
        forceReveal: false,
      });
    });
    const removeFinish = eventBus.on("cutscene-finished", () => setState(null));
    return () => { removeStart(); removeBeat(); removeFinish(); };
  }, [eventBus]);

  const markTextComplete = useCallback((): void => {
    setState((current) => current ? { ...current, textComplete: true } : current);
  }, []);

  const handleAdvance = useCallback((): void => {
    if (!state?.manualAdvance) return;
    const hasText = Boolean(state.beat.narration || state.beat.dialogue?.length);
    if (hasText && !state.textComplete) {
      setState((current) => current ? { ...current, forceReveal: true, textComplete: true } : current);
      return;
    }
    eventBus.emit("cutscene-advance-requested", {});
  }, [eventBus, state]);

  useEffect(() => {
    if (!state) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (state.manualAdvance && (event.code === "Space" || event.key === "Enter")) {
        if (event.repeat) return;
        event.preventDefault();
        handleAdvance();
      } else if (event.key === "Escape" && state.skipAllowed) {
        event.preventDefault();
        onSkip();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleAdvance, onSkip, state]);
  if (!state) return null;
  const { beat, index, skipAllowed, manualAdvance, captionIndex, captionCount, textComplete, forceReveal } = state;
  const hasText = Boolean(beat.narration || beat.dialogue?.length);
  const advanceLabel = hasText && !textComplete
    ? "문장 끝까지 보기"
    : captionIndex + 1 < captionCount ? "다음 대사" : index === 10 ? "인트로 마치기" : "다음 장면";
  return (
    <div className="cutscene-overlay">
      <div className="cutscene-vignette" />
      {beat.itemCard && <ItemCard item={beat.itemCard} />}
      {(beat.narration || beat.dialogue) && (
        <section className="cutscene-caption-frame" aria-label="컷신 자막" aria-live="polite">
          {beat.narration && (
            <NarratorText
              text={beat.narration}
              durationMs={beat.durationMs}
              resetKey={beat.id + ":" + captionIndex}
              forceReveal={forceReveal}
              onComplete={manualAdvance ? markTextComplete : undefined}
            />
          )}
          {beat.dialogue && (
            <DialogueBox
              lines={beat.dialogue}
              durationMs={beat.durationMs}
              resetKey={beat.id + ":" + captionIndex}
              forceReveal={forceReveal}
              onComplete={manualAdvance ? markTextComplete : undefined}
            />
          )}
        </section>
      )}
      <div className="cutscene-footer">
        <span>
          장면 {String(index + 1).padStart(2, "0")} / 11
          {captionCount > 1 && ` · 문장 ${captionIndex + 1} / ${captionCount}`}
        </span>
        {manualAdvance && (
          <button className="primary-button" type="button" onClick={handleAdvance}>
            {advanceLabel} · 클릭 / Space / Enter
          </button>
        )}
        {skipAllowed && <button className="primary-button" type="button" onClick={onSkip}>건너뛰기 · ESC</button>}
      </div>
    </div>
  );
}
