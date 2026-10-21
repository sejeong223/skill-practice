import type { MarketCategory } from "../core/types";

export const SHOP_CATEGORY_LABELS: Readonly<Record<MarketCategory, string>> = {
  weapon: "무기류",
  shield: "방패류",
  outfit: "의상류",
  accessory: "장신구류",
};

export const SHOP_DIALOGUE = {
  entry: [
    "어서 오개, 손님! 천사 같은 미소와 신상 장비로 모신다개~!",
    "냥아치 잡으러 가냐개? 내 장비면 15cm 다리로도 문제없다개!",
  ],
  selection: [
    "오~ 손님 안목 미쳤다개! 그거 가성비 대박 상품이다개!",
    "이거 끼면 동네 강아지들이 다 부러워할 걸개!",
  ],
  purchase: [
    "탁월한 선택이라개! 살아서 꼭 왕갈비뼈를 찾아오라개~!",
    "감사하다개! 영수증은 갈비뼈 찾고 챙겨주겠다개!",
  ],
  insufficient: "손님, 자본주의는 냉정한 법이라개~",
} as const;

export function pickShopDialogue(kind: "entry" | "selection" | "purchase", random = Math.random): string {
  const candidates = SHOP_DIALOGUE[kind];
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}

export function wrapShopIndex(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return ((index + delta) % count + count) % count;
}
