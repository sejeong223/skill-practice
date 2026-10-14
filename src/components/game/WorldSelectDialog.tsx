"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import type { SelectableWorldId, World01ReplayPoint, WorldSelectionRequest } from "@/game/core/types";

export interface WorldSelectDialogProps {
  readonly currentWorldId: SelectableWorldId;
  readonly onSelect: (selection: WorldSelectionRequest) => void;
  readonly onCancel: () => void;
}

const WORLD_OPTIONS: readonly { id: SelectableWorldId; label: string }[] = [
  { id: "world-01", label: "월드 1" },
  { id: "world-02", label: "월드 2" },
];

const WORLD01_REPLAY_OPTIONS: readonly { point: World01ReplayPoint; label: string; detail: string }[] = [
  { point: "start", label: "처음부터", detail: "1스테이지 시작" },
  { point: "checkpoint-1", label: "체크포인트 1", detail: "2스테이지 깃발" },
  { point: "checkpoint-2", label: "체크포인트 2", detail: "4스테이지 깃발" },
  { point: "boss", label: "보스전", detail: "삼색이와 바로 대결" },
];

export function WorldSelectDialog({ currentWorldId, onSelect, onCancel }: WorldSelectDialogProps): ReactElement {
  const [view, setView] = useState<"worlds" | "world-01">("worlds");
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  const firstReplayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onCancel();
    };
    window.addEventListener("keydown", handleEscape, true);
    return () => {
      window.removeEventListener("keydown", handleEscape, true);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [onCancel]);

  useEffect(() => {
    (view === "worlds" ? firstOptionRef : firstReplayRef).current?.focus({ preventScroll: true });
  }, [view]);

  return (
    <div className="world-select-overlay">
      <section className={`world-select-dialog${view === "world-01" ? " is-entry-list" : ""}`} role="dialog" aria-modal="true" aria-labelledby="world-select-title" aria-describedby="world-select-description">
        <p className="intro-title-kicker">WORLD SELECT</p>
        <h2 id="world-select-title">{view === "worlds" ? "월드 선택" : "월드 1"}</h2>
        <p id="world-select-description">
          {view === "worlds" ? "이동할 월드를 선택해 주세요." : "시작 지점을 선택해 주세요."}
        </p>
        {view === "worlds" ? (
          <div className="world-select-options">
            {WORLD_OPTIONS.map(({ id, label }, index) => (
              <button
                key={id}
                ref={index === 0 ? firstOptionRef : undefined}
                className={`world-select-option${currentWorldId === id ? " is-current" : ""}`}
                type="button"
                onClick={() => id === "world-01" ? setView("world-01") : onSelect({ worldId: "world-02" })}
              >
                <span>{label}</span>
                <small>{id === "world-01" ? "시작 지점 선택" : "처음부터 시작"}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="world-select-checkpoints">
            {WORLD01_REPLAY_OPTIONS.map(({ point, label, detail }, index) => (
              <button
                key={point}
                ref={index === 0 ? firstReplayRef : undefined}
                className="world-select-checkpoint-option"
                type="button"
                onClick={() => onSelect({ worldId: "world-01", point })}
              >
                <span>{label}</span>
                <small>{detail}</small>
              </button>
            ))}
          </div>
        )}
        <div className="world-select-actions">
          {view === "world-01" && (
            <button className="world-select-cancel" type="button" onClick={() => setView("worlds")}>
              월드 목록으로
            </button>
          )}
          <button className="world-select-cancel" type="button" onClick={onCancel}>취소</button>
        </div>
      </section>
    </div>
  );
}
