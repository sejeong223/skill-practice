"use client";
import type { ReactElement } from "react";
import type { ProgressState, SkillDefinition, ToolDefinition } from "@/game/core/types";
import { EquipmentSlot } from "./EquipmentSlot";
import { SkillList } from "./SkillList";
import { ToolRecord } from "./ToolRecord";

export interface CharacterStatusPanelProps {
  readonly progress: ProgressState;
  readonly skills: readonly SkillDefinition[];
  readonly tools: readonly ToolDefinition[];
  readonly alive: boolean;
  readonly onEquip: (tool: ToolDefinition) => void;
}

export function CharacterStatusPanel({ progress, skills, tools, alive, onEquip }: CharacterStatusPanelProps): ReactElement {
  const attackTool = tools.find((tool) => tool.id === progress.equippedAttackToolId);
  const defenseTool = tools.find((tool) => tool.id === progress.equippedDefenseToolId);
  return (
    <section className="overlay-panel status-panel">
      <div className="panel-heading"><div><span className="panel-kicker">PROFILE / STATUS</span><h2>{progress.playerName}</h2></div><span className={alive ? "live-badge" : "dead-badge"}>{alive ? "PLAY" : "DOWN"}</span></div>
      <div className="equipment-grid">
        <EquipmentSlot slot="attack" tool={attackTool} options={tools.filter((tool) => tool.slot === "attack" && progress.ownedToolIds.includes(tool.id))} onChange={onEquip} />
        <EquipmentSlot slot="defense" tool={defenseTool} options={tools.filter((tool) => tool.slot === "defense" && progress.ownedToolIds.includes(tool.id))} onChange={onEquip} />
      </div>
      <div className="status-columns">
        <SkillList progress={progress} definitions={skills} />
        <section className="panel-section"><h3>장비 기록</h3><div className="record-list">{tools.map((tool) => <ToolRecord key={tool.id} progress={progress} tool={tool} onEquip={alive ? onEquip : undefined} />)}</div></section>
      </div>
      <div className="death-summary"><span>누적 사망 {progress.deathsTotal}</span><span>수집품 {progress.collectedItems.length}</span><span>발견한 부작용 {progress.discoveredDrawbackIds.length}</span></div>
    </section>
  );
}
