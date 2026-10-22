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
  readonly worldSelectUnlocked: boolean;
  readonly onOpenWorldSelect: () => void;
  readonly onOpenShop: () => void;
  readonly onOpenCatalog: () => void;
  readonly onOpenPaint: () => void;
}

export function Hud({
  stageTitle,
  runtime,
  attackTool,
  defenseTool,
  bossHearts,
  statusOpen,
  onToggleStatus,
  paused,
  onTogglePause,
  onResetProgress,
  worldSelectUnlocked,
  onOpenWorldSelect,
  onOpenShop,
  onOpenCatalog,
  onOpenPaint,
}: HudProps): ReactElement {
  return (
    <div className="game-hud" aria-label="게임 HUD">
      <div className="hud-stage">
        <span className="hud-label">STAGE</span>
        <strong>{stageTitle}</strong>
        <span className="hud-subtitle">{runtime.checkpointId ? "CHECKPOINT" : "SPAWN"}</span>
      </div>
      <div className="hud-stats">
        <span>
          <b>장비</b> {attackTool ? getToolPresentation(attackTool.id).nameKo : "없음"} / {defenseTool ? getToolPresentation(defenseTool.id).nameKo : "없음"}
        </span>
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
        className="paint-open-button"
        type="button"
        aria-label="코기 옷 그림판 열기"
        title="코기 옷 그림판"
        onClick={onOpenPaint}
      >
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
          <path d="M2 1h2v2H2zM4 3h2v2H4zM6 5h2v2H6zM8 7h2v2H8zM10 9h2v2h-2zM12 11h2v2h-2zM1 13h7v2H1zM3 9h4v3H3z" />
        </svg>
      </button>
      <button
        className="catalog-open-button"
        type="button"
        aria-label="보유 아이템 카탈로그 열기"
        title="카탈로그"
        onClick={onOpenCatalog}
      >
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
          <path d="M2 2h12v12H2zM4 4h3v3H4zM9 4h3v1H9zM9 6h3v1H9zM4 9h3v3H4zM9 9h3v1H9zM9 11h3v1H9z" fillRule="evenodd" />
        </svg>
      </button>
      <button
        className="shop-open-button"
        type="button"
        aria-label="상점 열기"
        title="리트리버의 굿보이 마켓"
        onClick={onOpenShop}
      >
        <svg viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
          <path d="M2 2h12v3H2zM1 5h14v3H1zM3 8h10v6H3zM6 9h4v5H6zM4 1h8v1H4z" />
        </svg>
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
      {worldSelectUnlocked && (
        <button
          className="world-select-button"
          type="button"
          aria-label="월드 선택"
          title="월드 선택"
          onClick={onOpenWorldSelect}
        >
          <svg viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
            <path d="M1 3 5 1l5 2 5-2v12l-5 2-5-2-4 2V3Zm2 1v8l2-1V3L3 4Zm4-1v8l2 1V4L7 3Zm4 1v8l2-1V3l-2 1Z" />
          </svg>
        </button>
      )}
    </div>
  );
}
