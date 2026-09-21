"use client";
import type { ReactElement } from "react";
import type { ToolDefinition, ToolSlot } from "@/game/core/types";

export interface EquipmentSlotProps {
  readonly slot: ToolSlot;
  readonly tool?: ToolDefinition;
  readonly options: readonly ToolDefinition[];
  readonly onChange: (tool: ToolDefinition) => void;
}

export function EquipmentSlot({ slot, tool, options, onChange }: EquipmentSlotProps): ReactElement {
  return (
    <div className="equipment-slot">
      <span><small>{slot === "attack" ? "공격 도구" : "방어 도구"}</small><strong>{tool?.id ?? "없음"}</strong></span>
      <select aria-label={slot === "attack" ? "공격 도구 변경" : "방어 도구 변경"} value={tool?.id ?? ""} onChange={(event) => { const next = options.find((candidate) => candidate.id === event.target.value); if (next) onChange(next); }}>
        {options.map((option) => <option key={option.id} value={option.id}>{option.id}</option>)}
      </select>
    </div>
  );
}
