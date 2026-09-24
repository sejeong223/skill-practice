"use client";
import type { ReactElement } from "react";
import type { ToolDefinition, ToolSlot } from "@/game/core/types";
import { getToolPresentation } from "@/game/data/toolPresentation";

export interface EquipmentSlotProps {
  readonly slot: ToolSlot;
  readonly tool?: ToolDefinition;
  readonly options: readonly ToolDefinition[];
  readonly onChange: (tool: ToolDefinition) => void;
}

export function EquipmentSlot({ slot, tool, options, onChange }: EquipmentSlotProps): ReactElement {
  const slotLabel = slot === "attack" ? "공격 도구" : "방어 도구";
  return (
    <div className="equipment-slot">
      <span>
        <small>{slotLabel}</small>
        <strong>{tool ? getToolPresentation(tool.id).nameKo : "없음"}</strong>
      </span>
      <select
        aria-label={slotLabel + " 변경"}
        value={tool?.id ?? ""}
        onChange={(event) => {
          const next = options.find((candidate) => candidate.id === event.target.value);
          if (next) onChange(next);
        }}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>{getToolPresentation(option.id).nameKo}</option>
        ))}
      </select>
    </div>
  );
}
