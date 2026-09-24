import type { ToolId } from "../core/types";

export interface ToolPresentation {
  readonly nameKo: string;
  readonly effectKo: string;
  readonly drawbackKo: string;
  readonly slotKo: string;
}

export const TOOL_PRESENTATIONS: Readonly<Record<ToolId, ToolPresentation>> = {
  "rabbit-slipper": {
    nameKo: "토끼 슬리퍼",
    effectKo: "근접 3연타와 물어뜯기 기회",
    drawbackKo: "재채기 반동",
    slotKo: "공격 도구",
  },
  "squeaky-ball": {
    nameKo: "삑삑이 공",
    effectKo: "튕기는 투사체",
    drawbackKo: "삑 소리에 고양이들이 몰려옴",
    slotKo: "공격 도구",
  },
  "cardboard-tube": {
    nameKo: "종이관",
    effectKo: "근접 공격 사거리 증가",
    drawbackKo: "시야 사각이 생김",
    slotKo: "공격 도구",
  },
  "upside-down-bowl": {
    nameKo: "뒤집힌 밥그릇",
    effectKo: "약한 공격 3회 방어, 떠돌이 개를 부름",
    drawbackKo: "떠돌이 개가 길을 막음",
    slotKo: "방어 도구",
  },
  "cushion-pad": {
    nameKo: "쿠션 패드",
    effectKo: "낙하 피해 감소",
    drawbackKo: "옆으로 튕겨남",
    slotKo: "방어 도구",
  },
  "cardboard-box": {
    nameKo: "종이 상자",
    effectKo: "한 번의 공격을 숨겨 넘김",
    drawbackKo: "시야를 가림",
    slotKo: "방어 도구",
  },
};

export function getToolPresentation(toolId: ToolId): ToolPresentation {
  return TOOL_PRESENTATIONS[toolId];
}
