"use client";
import type { ReactElement } from "react";
import type { ProgressState, ToolDefinition } from "@/game/core/types";
import { getToolPresentation } from "@/game/data/toolPresentation";

export interface ToolRecordProps {
  readonly progress: ProgressState;
  readonly tool: ToolDefinition;
  readonly onEquip?: (tool: ToolDefinition) => void;
}

export function ToolRecord({ progress, tool, onEquip }: ToolRecordProps): ReactElement {
  const owned = progress.ownedToolIds.includes(tool.id);
  const equipped = progress.equippedAttackToolId === tool.id || progress.equippedDefenseToolId === tool.id;
  const discovered = progress.discoveredDrawbackIds.includes(tool.hiddenDrawbackId);
  const presentation = getToolPresentation(tool.id);
  return (
    <div className={"record-row " + (owned ? "is-owned" : "is-locked")}>
      <span className="record-icon">{tool.slot === "attack" ? "공격" : "방어"}</span>
      <span>
        <strong>{presentation.nameKo}</strong>
        <small>{presentation.effectKo}</small>
        {discovered && <small className="record-warning">부작용: {presentation.drawbackKo}</small>}
      </span>
      {owned && (
        <button className="tiny-button" type="button" disabled={equipped} onClick={() => onEquip?.(tool)}>
          {equipped ? "장착 중" : "장착"}
        </button>
      )}
    </div>
  );
}
