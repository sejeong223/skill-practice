export type BossVictoryStageId = "world-01-stage-boss" | "world-02-stage-boss" | "world-03-stage-boss";

export interface BossVictoryPresentation {
  readonly nextStageId: "world-02-stage-1" | "world-03-stage-1" | "world-04-stage-1";
  readonly skillId: "bark" | "bite" | "dash";
  readonly skillName: string;
  readonly skillDescription: string;
  readonly skillEffectNote: string;
  readonly backgroundKey: string;
  readonly bossTextureKey: string;
  readonly defeatedFrame: 2 | 3;
  readonly defeatedFlipX: boolean;
  readonly clearButtonLabel: string;
}

export const BOSS_VICTORY_PRESENTATION: Readonly<Record<BossVictoryStageId, BossVictoryPresentation>> = {
  "world-01-stage-boss": {
    nextStageId: "world-02-stage-1",
    skillId: "bark",
    skillName: "짖기",
    skillDescription: "맹렬한 멍멍 소리로 보스 고양이를 순간 당황시킵니다",
    skillEffectNote: "(※ 보스 공격 패턴을 잠시 멈출 수 있습니다.)",
    backgroundKey: "world-01-roof-day-mid",
    bossTextureKey: "world-01-calico-boss",
    defeatedFrame: 2,
    defeatedFlipX: false,
    clearButtonLabel: "NEXT STAGE ->",
  },
  "world-02-stage-boss": {
    nextStageId: "world-03-stage-1",
    skillId: "bite",
    skillName: "물기",
    skillDescription: "코기의 날카로운 이빨로 적을 앙숙처럼 물어뜯어 큰 피해를 줍니다.",
    skillEffectNote: "(※ 보스의 체력이 2만큼 감소합니다.)",
    backgroundKey: "world-02-background-mid",
    bossTextureKey: "world-02-cheese-tabby-boss",
    defeatedFrame: 3,
    defeatedFlipX: true,
    clearButtonLabel: "계속 ->",
  },
  "world-03-stage-boss": {
    nextStageId: "world-04-stage-1",
    skillId: "dash",
    skillName: "대시",
    skillDescription: "숫자 1을 누르면 바라보는 방향으로 짧고 빠르게 돌진합니다.",
    skillEffectNote: "(※ 0.25초 동안 공격 피해를 무시합니다. 재사용 대기 1.4초.)",
    backgroundKey: "world-03-background-mid-boss",
    bossTextureKey: "world-03-mackerel-boss",
    defeatedFrame: 3,
    defeatedFlipX: true,
    clearButtonLabel: "계속 ->",
  },
};

export function getBossVictoryPresentation(stageId: string | undefined): BossVictoryPresentation | null {
  return stageId && Object.prototype.hasOwnProperty.call(BOSS_VICTORY_PRESENTATION, stageId)
    ? BOSS_VICTORY_PRESENTATION[stageId as BossVictoryStageId] : null;
}
