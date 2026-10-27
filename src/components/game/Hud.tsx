"use client";
import Image from "next/image";
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
        <Image className="hud-menu-icon" src="/assets/pixel/ui/menu-palette.png" width={20} height={20} alt="" aria-hidden="true" draggable={false} unoptimized />
      </button>
      <button
        className="catalog-open-button"
        type="button"
        aria-label="보유 아이템 카탈로그 열기"
        title="카탈로그"
        onClick={onOpenCatalog}
      >
        <Image className="hud-menu-icon" src="/assets/pixel/ui/menu-bag.png" width={20} height={20} alt="" aria-hidden="true" draggable={false} unoptimized />
      </button>
      <button
        className="shop-open-button"
        type="button"
        aria-label="상점 열기"
        title="리트리버의 굿보이 마켓"
        onClick={onOpenShop}
      >
        <Image className="hud-menu-icon" src="/assets/pixel/ui/menu-shop.png" width={20} height={20} alt="" aria-hidden="true" draggable={false} unoptimized />
      </button>
      <button
        className="pause-button"
        type="button"
        aria-label={paused ? "계속하기" : "일시정지"}
        title={paused ? "계속하기" : "일시정지"}
        onClick={onTogglePause}
      >
        <Image className="hud-menu-icon" src={paused ? "/assets/pixel/ui/menu-play.png" : "/assets/pixel/ui/menu-pause.png"} width={20} height={20} alt="" aria-hidden="true" draggable={false} unoptimized />
      </button>
      <button
        className="reset-progress-button"
        type="button"
        aria-label="저장된 진행 초기화"
        title="저장된 진행 초기화"
        onClick={onResetProgress}
      >
        <Image className="hud-menu-icon" src="/assets/pixel/ui/menu-reset-clockwise.png" width={20} height={20} alt="" aria-hidden="true" draggable={false} unoptimized />
      </button>
      {worldSelectUnlocked && (
        <button
          className="world-select-button"
          type="button"
          aria-label="월드 선택"
          title="월드 선택"
          onClick={onOpenWorldSelect}
        >
          <Image className="hud-menu-icon" src="/assets/pixel/ui/menu-map.png" width={20} height={20} alt="" aria-hidden="true" draggable={false} unoptimized />
        </button>
      )}
    </div>
  );
}
