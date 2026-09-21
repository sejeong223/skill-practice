"use client";
import type { ReactElement } from "react";
import type { ProgressState, ToolDefinition } from "@/game/core/types";

export interface ToolRecordProps {
  readonly progress: ProgressState;
  readonly tool: ToolDefinition;
  readonly onEquip?: (tool: ToolDefinition) => void;
}

export function ToolRecord({ progress, tool, onEquip }: ToolRecordProps): ReactElement {
  const owned = progress.ownedToolIds.includes(tool.id);
  const equipped = progress.equippedAttackToolId === tool.id || progress.equippedDefenseToolId === tool.id;
  const discovered = progress.discoveredDrawbackIds.includes(tool.hiddenDrawbackId);
  return (
    <div className={"record-row " + (owned ? "is-owned" : "is-locked")}>
      <span className="record-icon">{tool.slot === "attack" ? "A" : "D"}</span>
      <span><strong>{tool.id}</strong><small>{tool.passiveEffect}</small>{discovered && <small className="record-warning">부작용: {tool.hiddenDrawbackId}</small>}</span>
      {owned && <button className="tiny-button" type="button" disabled={equipped} onClick={() => onEquip?.(tool)}>{equipped ? "장착 중" : "장착"}</button>}
    </div>
  );
}
