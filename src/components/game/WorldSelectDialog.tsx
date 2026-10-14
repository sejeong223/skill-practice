"use client";

import { useEffect, useRef, type ReactElement } from "react";
import type { SelectableWorldId } from "@/game/core/types";

export interface WorldSelectDialogProps {
  readonly currentWorldId: SelectableWorldId;
  readonly onSelect: (worldId: SelectableWorldId) => void;
  readonly onCancel: () => void;
}

const WORLD_OPTIONS: readonly { id: SelectableWorldId; label: string }[] = [
  { id: "world-01", label: "월드 1" },
  { id: "world-02", label: "월드 2" },
];

export function WorldSelectDialog({ currentWorldId, onSelect, onCancel }: WorldSelectDialogProps): ReactElement {
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    firstOptionRef.current?.focus({ preventScroll: true });
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

  return (
    <div className="world-select-overlay">
      <section className="world-select-dialog" role="dialog" aria-modal="true" aria-labelledby="world-select-title" aria-describedby="world-select-description">
        <p className="intro-title-kicker">WORLD SELECT</p>
        <h2 id="world-select-title">월드 선택</h2>
        <p id="world-select-description">이동할 월드를 선택해 주세요. 선택한 월드는 첫 스테이지부터 시작합니다.</p>
        <div className="world-select-options">
          {WORLD_OPTIONS.map(({ id, label }, index) => (
            <button
              key={id}
              ref={index === 0 ? firstOptionRef : undefined}
              className={`world-select-option${currentWorldId === id ? " is-current" : ""}`}
              type="button"
              onClick={() => onSelect(id)}
            >
              <span>{label}</span>
              <small>{currentWorldId === id ? "현재 월드 · 처음부터" : "처음부터 시작"}</small>
            </button>
          ))}
        </div>
        <button className="world-select-cancel" type="button" onClick={onCancel}>취소</button>
      </section>
    </div>
  );
}
