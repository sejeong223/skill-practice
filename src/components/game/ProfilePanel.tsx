"use client";
import { useState, type ReactElement } from "react";

export interface ProfilePanelProps {
  readonly playerName: string;
  readonly onConfirm: (playerName: string) => void;
}

export function ProfilePanel({ playerName, onConfirm }: ProfilePanelProps): ReactElement {
  const [draft, setDraft] = useState(playerName);
  return (
    <section className="overlay-panel compact-panel">
      <span className="panel-kicker">PLAYER PROFILE</span>
      <h2>이름을 정해줘</h2>
      <p>엔딩에서 주인이 이 이름을 부릅니다.</p>
      <form onSubmit={(event) => { event.preventDefault(); onConfirm(draft); }}>
        <label><span className="sr-only">강아지 이름</span><input maxLength={20} value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
        <button className="primary-button" type="submit">저장</button>
      </form>
    </section>
  );
}
