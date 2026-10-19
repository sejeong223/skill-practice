import type { SkillDefinition } from "../core/types";

export const BARK_COOLDOWN_MS = 10_000;

export const SKILL_DEFINITIONS: readonly SkillDefinition[] = [
  {
    id: "bark",
    displayName: "짖기",
    unlockAfterBossId: "world-01-boss",
    cooldownMs: BARK_COOLDOWN_MS,
    inputAction: "bark",
    description: "짧고 강한 짖음으로 가까운 적을 밀어낸다.",
    effect: "stun-and-knockback",
  },
  {
    id: "bite",
    displayName: "물기",
    unlockAfterBossId: "world-02-boss",
    cooldownMs: 600,
    inputAction: "attack",
    description: "눈앞의 적과 장애물을 앙 물어뜯는다.",
    effect: "close-range-bite",
  },
  {
    id: "dash",
    displayName: "대시",
    unlockAfterBossId: "world-03-boss",
    cooldownMs: 1400,
    inputAction: "dash",
    description: "짧은 순간 앞으로 돌진해 함정을 통과한다.",
    effect: "invulnerable-dash",
  },
  {
    id: "double-jump",
    displayName: "더블 점프",
    unlockAfterBossId: "world-04-boss",
    cooldownMs: 0,
    inputAction: "jump",
    description: "공중에서 한 번 더 도약한다.",
    effect: "air-jump",
  },
  {
    id: "tail-rotor",
    displayName: "꼬리 모터",
    unlockAfterBossId: "world-05-boss",
    cooldownMs: 2200,
    inputAction: "jump",
    description: "꼬리를 회전시켜 잠시 하늘을 난다.",
    effect: "slow-fall-and-hover",
  },
];
