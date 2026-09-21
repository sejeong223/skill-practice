"use client";
import type { ReactElement } from "react";
import type { ProgressState, SkillDefinition } from "@/game/core/types";

export interface SkillListProps {
  readonly progress: ProgressState;
  readonly definitions: readonly SkillDefinition[];
}

export function SkillList({ progress, definitions }: SkillListProps): ReactElement {
  return (
    <section className="panel-section">
      <h3>배운 기술</h3>
      <div className="record-list">
        {definitions.map((skill) => {
          const unlocked = progress.unlockedSkills.includes(skill.id);
          return (
            <div className={"record-row " + (unlocked ? "is-unlocked" : "is-locked")} key={skill.id}>
              <span className="record-icon">{unlocked ? "●" : "?"}</span>
              <span><strong>{skill.id}</strong><small>{unlocked ? skill.description : "아직 잠겨 있습니다."}</small></span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
