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
}

export function Hud({
  stageTitle,
  runtime,
  progress,
  attackTool,
  defenseTool,
  cooldowns,
}: HudProps): ReactElement {
  const activeCooldowns = Object.entries(cooldowns)
    .filter(([, value]) => (value ?? 0) > 0)
    .map(([id, value]) => id + " " + Math.ceil((value ?? 0) / 100) / 10 + "s")
    .join(", ");
  return (
    <div className="game-hud" aria-label="게임 HUD">
      <div>
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
    </div>
  );
}
