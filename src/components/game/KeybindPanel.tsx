"use client";
import { useEffect, useState, type ReactElement } from "react";
import type { InputAction } from "@/game/core/types";
import { formatKeybindLabel } from "@/game/input/keybindPresentation";

const ACTION_LABELS: Record<InputAction, string> = {
  left: "왼쪽",
  right: "오른쪽",
  up: "위",
  down: "아래",
  jump: "점프",
  attack: "공격",
  dash: "대시",
  bark: "짖기",
  pause: "일시정지",
};
const ACTIONS = Object.keys(ACTION_LABELS) as InputAction[];

export interface KeybindPanelProps {
  readonly keybinds: Record<InputAction, string>;
  readonly onChange: (action: InputAction, key: string) => void;
}

export function KeybindPanel({ keybinds, onChange }: KeybindPanelProps): ReactElement {
  const [listening, setListening] = useState<InputAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!listening) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      event.preventDefault();
      const key = event.code || event.key;
      const duplicate = Object.entries(keybinds).some(([action, value]) => action !== listening && value === key);
      if (duplicate) { setError("이미 사용 중인 키입니다."); return; }
      setError(null);
      onChange(listening, key);
      setListening(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [keybinds, listening, onChange]);
  return (
    <section className="overlay-panel compact-panel keybind-panel">
      <div className="panel-heading">
        <div><span className="panel-kicker">조작 설정</span><h2>조작 설정</h2></div>
      </div>
      <div className="keybind-list">
        {ACTIONS.map((action) => (
          <div className="keybind-row" key={action}>
            <span>{ACTION_LABELS[action]}</span>
            <code>{listening === action ? "입력 대기..." : formatKeybindLabel(keybinds[action])}</code>
            <button className="tiny-button" type="button" onClick={() => { setError(null); setListening(action); }}>변경</button>
          </div>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
