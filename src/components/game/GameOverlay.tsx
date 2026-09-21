"use client";
import type { ReactElement } from "react";
import type { InputAction, ProgressState, RuntimeStageState, SkillDefinition, ToolDefinition } from "@/game/core/types";
import { CharacterStatusPanel } from "./CharacterStatusPanel";
import { Hud } from "./Hud";
import { KeybindPanel } from "./KeybindPanel";
import { ProfilePanel } from "./ProfilePanel";
import { ShopPanel } from "./ShopPanel";

export interface GameOverlayProps {
  readonly stageTitle: string;
  readonly runtime: RuntimeStageState;
  readonly progress: ProgressState;
  readonly skills: readonly SkillDefinition[];
  readonly tools: readonly ToolDefinition[];
  readonly cooldowns: Partial<Record<string, number>>;
  readonly alive: boolean;
  readonly onNameConfirm: (name: string) => void;
  readonly onEquip: (tool: ToolDefinition) => void;
  readonly onPurchase: (tool: ToolDefinition) => void;
  readonly onKeybindChange: (action: InputAction, key: string) => void;
}

export function GameOverlay({ stageTitle, runtime, progress, skills, tools, cooldowns, alive, onNameConfirm, onEquip, onPurchase, onKeybindChange }: GameOverlayProps): ReactElement {
  const attackTool = tools.find((tool) => tool.id === progress.equippedAttackToolId);
  const defenseTool = tools.find((tool) => tool.id === progress.equippedDefenseToolId);
  return (
    <div className="game-overlay">
      <Hud stageTitle={stageTitle} runtime={runtime} progress={progress} attackTool={attackTool} defenseTool={defenseTool} cooldowns={cooldowns} />
      <div className="overlay-columns">
        <div className="overlay-stack"><ProfilePanel playerName={progress.playerName} onConfirm={onNameConfirm} /><KeybindPanel keybinds={progress.keybinds} onChange={onKeybindChange} /></div>
        <div className="overlay-stack"><ShopPanel bankedCoins={progress.bankedCoins} ownedToolIds={progress.ownedToolIds} tools={tools} onPurchase={onPurchase} /><CharacterStatusPanel progress={progress} skills={skills} tools={tools} alive={alive} onEquip={onEquip} /></div>
      </div>
    </div>
  );
}
