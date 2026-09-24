"use client";
import type { ReactElement } from "react";
import type { ProgressState, RuntimeStageState, SkillId, ToolDefinition } from "@/game/core/types";

export interface HudProps {
  readonly stageTitle: string;
  readonly runtime: RuntimeStageState;
  readonly progress: ProgressState;
  readonly attackTool?: ToolDefinition;
  readonly defenseTool?: ToolDefinition;
  readonly cooldowns: Partial<Record<SkillId, number>>;
  readonly statusOpen: boolean;
  readonly onToggleStatus: () => void;
  readonly paused: boolean;
  readonly onTogglePause: () => void;
}

export function Hud({
  stageTitle,
  runtime,
  progress,
  attackTool,
  defenseTool,
  cooldowns,
  statusOpen,
  onToggleStatus,
  paused,
  onTogglePause,
}: HudProps): ReactElement {
  const activeCooldowns = Object.entries(cooldowns)
    .filter(([, value]) => (value ?? 0) > 0)
    .map(([id, value]) => id + " " + Math.ceil((value ?? 0) / 100) / 10 + "s")
    .join(", ");
  return (
    <div className="game-hud" aria-label="게임 HUD">
      <div className="hud-stage">
        <span className="hud-label">STAGE</span>
        <strong>{stageTitle}</strong>
        <span className="hud-subtitle">{runtime.checkpointId ? "CHECKPOINT" : "SPAWN"}</span>
      </div>
      <div className="hud-stats">
        <span><b>금고</b> {progress.bankedCoins}</span>
        <span><b>이번 스테이지</b> {runtime.currentStageCoins}</span>
        <span><b>장비</b> {attackTool?.id ?? "없음"} / {defenseTool?.id ?? "없음"}</span>
        <span><b>쿨다운</b> {activeCooldowns || "준비"}</span>
      </div>
      <button
        className="tiny-button status-menu-button"
        type="button"
        aria-expanded={statusOpen}
        onClick={onToggleStatus}
      >
        {statusOpen ? "닫기" : "상태 / 설정"}
      </button>
      <button
        className="pause-button"
        type="button"
        aria-label={paused ? "계속하기" : "일시정지"}
        onClick={onTogglePause}
      >
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
          {paused ? (
            <path d="M4 2h3v2h2v2h2v2h2v2h-2v2H9v2H7v2H4z" />
          ) : (
            <path d="M3 2h4v12H3zM9 2h4v12H9z" />
          )}
        </svg>
      </button>
    </div>
  );
}
