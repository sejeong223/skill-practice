"use client";

import { useEffect, useState, type ReactElement } from "react";
import type { GameEventBus } from "@/game/bridge/GameEventBus";
import type { StageId } from "@/game/core/types";
import { formatKeybindLabel } from "@/game/input/keybindPresentation";
import type { BossFeedbackSnapshot } from "@/game/systems/bossFeedback";

export interface BossCombatOverlayProps {
  readonly eventBus: GameEventBus;
  readonly stageId: StageId;
  readonly visible: boolean;
  readonly barkKeybind: string;
}

const WARNINGS = {
  "bark-third": ["3연속 짖기 발동!", "너무 세게 짖은 나머지 사레에 들리고 말았습니다!"],
  "bowl-alarm": ["밥그릇 소리 경보!", "밥 소리인 줄 알고 동네 강아지들이 정모하러 왔습니다!"],
} as const;

export function BossCombatOverlay({ eventBus, stageId, visible, barkKeybind }: BossCombatOverlayProps): ReactElement | null {
  const [snapshot, setSnapshot] = useState<BossFeedbackSnapshot | null>(null);
  useEffect(() => {
    const offFeedback = eventBus.on("boss-feedback-changed", setSnapshot);
    const offStage = eventBus.on("stage-started", () => setSnapshot(null));
    return () => { offFeedback(); offStage(); };
  }, [eventBus]);

  if (!visible || !snapshot?.active || snapshot.stageId !== stageId) return null;
  const warning = snapshot.warning && WARNINGS[snapshot.warning.kind];
  const readyRatio = Math.max(0, Math.min(1, 1 - snapshot.barkRemainingMs / snapshot.barkCooldownMs));
  return (
    <div className="boss-combat-overlay">
      {warning && (
        <div className="boss-warning" key={snapshot.warning!.sequence}>
          <div className="boss-warning-text" role="status" aria-live="polite" aria-atomic="true">
            <strong><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 23 21H1Z" fill="currentColor" /><path d="M12 8v6m0 3v1" stroke="#683337" strokeWidth="2.5" /></svg>{warning[0]}</strong>
            <p>{warning[1]}</p>
          </div>
        </div>
      )}
      {snapshot.barkUnlocked && (
        <div className="boss-bark-cooldown" aria-label="짖기 쿨타임">
          <div><strong>짖기</strong><kbd>{formatKeybindLabel(barkKeybind)}</kbd></div>
          <span>{snapshot.barkRemainingMs > 0 ? (Math.ceil(snapshot.barkRemainingMs / 100) / 10).toFixed(1) + "초" : "준비"}</span>
          <div className="boss-bark-track" aria-hidden="true"><div style={{ width: `${readyRatio * 100}%` }} /></div>
        </div>
      )}
    </div>
  );
}
