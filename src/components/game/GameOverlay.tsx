"use client";
import type { ReactElement } from "react";
import type { InputAction, ProgressState, RuntimeStageState, SkillDefinition, ToolDefinition } from "@/game/core/types";
import { CharacterStatusPanel } from "./CharacterStatusPanel";
import { Hud } from "./Hud";
import { KeybindPanel } from "./KeybindPanel";

export interface GameOverlayProps {
  readonly stageTitle: string;
  readonly runtime: RuntimeStageState;
  readonly progress: ProgressState;
  readonly skills: readonly SkillDefinition[];
  readonly tools: readonly ToolDefinition[];
  readonly cooldowns: Partial<Record<string, number>>;
  readonly bossHearts?: 0 | 1 | 2 | 3;
  readonly alive: boolean;
  readonly statusOpen: boolean;
  readonly paused: boolean;
  readonly onTogglePause: () => void;
  readonly onResetProgress: () => void;
  readonly worldSelectUnlocked: boolean;
  readonly onOpenWorldSelect: () => void;
  readonly onOpenShop: () => void;
  readonly onOpenCatalog: () => void;
  readonly onEquip: (tool: ToolDefinition) => void;
  readonly onKeybindChange: (action: InputAction, key: string) => void;
  readonly onToggleStatus: () => void;
}

export function GameOverlay({ stageTitle, runtime, progress, skills, tools, cooldowns, bossHearts, alive, statusOpen, paused, onTogglePause, onResetProgress, worldSelectUnlocked, onOpenWorldSelect, onOpenShop, onOpenCatalog, onEquip, onKeybindChange, onToggleStatus }: GameOverlayProps): ReactElement {
  const attackTool = tools.find((tool) => tool.id === progress.equippedAttackToolId);
  const defenseTool = tools.find((tool) => tool.id === progress.equippedDefenseToolId);
  return (
    <div className={`game-overlay${bossHearts !== undefined ? " has-boss-hearts" : ""}${worldSelectUnlocked ? " has-world-select" : ""}`} inert={paused}>
      <Hud
        stageTitle={stageTitle}
        runtime={runtime}
        progress={progress}
        attackTool={attackTool}
        defenseTool={defenseTool}
        cooldowns={cooldowns}
        bossHearts={bossHearts}
        statusOpen={statusOpen}
        onToggleStatus={onToggleStatus}
        paused={paused}
        onTogglePause={onTogglePause}
        onResetProgress={onResetProgress}
        worldSelectUnlocked={worldSelectUnlocked}
        onOpenWorldSelect={onOpenWorldSelect}
        onOpenShop={onOpenShop}
        onOpenCatalog={onOpenCatalog}
      />
      {statusOpen && (
        <div className="overlay-columns">
          <div className="overlay-stack">
            <KeybindPanel keybinds={progress.keybinds} onChange={onKeybindChange} />
          </div>
          <div className="overlay-stack">
            <CharacterStatusPanel
              progress={progress}
              skills={skills}
              tools={tools}
              alive={alive}
              onEquip={onEquip}
            />
          </div>
        </div>
      )}
    </div>
  );
}
