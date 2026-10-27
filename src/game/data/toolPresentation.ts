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
    effectKo: "근접 3연타 후 재채기로 잠시 밀려남",
    drawbackKo: "재채기 반동",
    slotKo: "공격 도구",
  },
  "squeaky-ball": {
    nameKo: "삑삑이 공",
    effectKo: "튕기는 투사체",
    drawbackKo: "삑 소리에 고양이들이 몰려옴",
    slotKo: "공격 도구",
  },
  "rolled-newspaper": { nameKo: "돌돌 말린 신문지", effectKo: "더 긴 전방 근접 공격", drawbackKo: "휘두른 뒤 450ms 회복", slotKo: "공격 도구" },
  "pink-backscratcher": { nameKo: "분홍색 효자손", effectKo: "위쪽까지 닿는 곡선 공격", drawbackKo: "명중하면 18px 밀림", slotKo: "공격 도구" },
  "drumstick-boomerang": { nameKo: "닭다리 뼈 부메랑", effectKo: "왕복 투사체", drawbackKo: "돌아오기 전 재투척 불가", slotKo: "공격 도구" },
  "plastic-frisbee": { nameKo: "플라스틱 원반", effectKo: "빠른 장거리 직선 투척", drawbackKo: "빗나가면 900ms 대기", slotKo: "공격 도구" },
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
    effectKo: "정면의 약한 공격 두 번 방어",
    drawbackKo: "옆으로 튕겨남",
    slotKo: "방어 도구",
  },
  "greasy-pizza-box": { nameKo: "기름진 피자 박스", effectKo: "정면의 약한 공격 두 번 방어", drawbackKo: "방어 후 350ms 미끄러짐", slotKo: "방어 도구" },
  "umbrella": { nameKo: "우산", effectKo: "정면의 약한 투사체 두 번 방어", drawbackKo: "후방 공격에 취약", slotKo: "방어 도구" },
  "yellow-pot-lid": { nameKo: "노란 양은 냄비 뚜껑", effectKo: "세 번 방어하고 다음 투척 지연", drawbackKo: "세 번째 방어 후 귀울림", slotKo: "방어 도구" },
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
