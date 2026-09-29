"use client";
import type { ReactElement } from "react";
import type { ProgressState, RuntimeStageState, SkillId, ToolDefinition } from "@/game/core/types";
import { getToolPresentation } from "@/game/data/toolPresentation";

export interface HudProps {
  readonly stageTitle: string;
  readonly runtime: RuntimeStageState;
  readonly progress: ProgressState;
  readonly attackTool?: ToolDefinition;
  readonly defenseTool?: ToolDefinition;
  readonly cooldowns: Partial<Record<SkillId, number>>;
  readonly bossHearts?: 0 | 1 | 2 | 3;
  readonly statusOpen: boolean;
  readonly onToggleStatus: () => void;
  readonly paused: boolean;
  readonly onTogglePause: () => void;
  readonly onResetProgress: () => void;
}

export function Hud({
  stageTitle,
  runtime,
  progress,
  attackTool,
  defenseTool,
  cooldowns,
  bossHearts,
  statusOpen,
  onToggleStatus,
  paused,
  onTogglePause,
  onResetProgress,
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
        <span>
          <b>장비</b> {attackTool ? getToolPresentation(attackTool.id).nameKo : "없음"} / {defenseTool ? getToolPresentation(defenseTool.id).nameKo : "없음"}
        </span>
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
      {bossHearts !== undefined && (
        <div className="boss-hearts" role="status" aria-label={`코기 남은 하트 ${bossHearts}개`}>
          <span className="boss-hearts-face" aria-hidden="true" />
          {([0, 1, 2] as const).map((index) => (
            <span className={index < bossHearts ? "boss-heart" : "boss-heart is-empty"} aria-hidden="true" key={index}>♥</span>
          ))}
        </div>
      )}
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
      <button
        className="reset-progress-button"
        type="button"
        aria-label="저장된 진행 초기화"
        title="저장된 진행 초기화"
        onClick={onResetProgress}
      >
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
          <path d="M7 1h5v2H7zM5 3h2v2H5zM3 5h2v5H3zM5 10h2v2H5zM7 12h5v2H7zM12 10h2v2h-2zM14 7h2v3h-2zM12 4h2v3h-2zM10 2h3v2h-3zM8 5h3v2H8zM9 7h3v2H9z" />
        </svg>
      </button>
    </div>
  );
}
