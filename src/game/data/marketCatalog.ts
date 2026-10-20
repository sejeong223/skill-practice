import type { CosmeticId, MarketCategory, MarketProduct, ToolId } from "../core/types";

const iconUrl = (id: string): string => `/assets/pixel/shop/items/${id}.png`;
const tool = (category: "weapon" | "shield", id: ToolId, nameKo: string, price: number, advantageKo: string): MarketProduct =>
  ({ category, id, toolId: id, nameKo, price, advantageKo, iconUrl: iconUrl(id) });
const cosmetic = (category: "outfit" | "accessory", id: CosmeticId, nameKo: string, price: number, advantageKo: string): MarketProduct =>
  ({ category, id, cosmeticId: id, nameKo, price, advantageKo, iconUrl: iconUrl(id) });

export const MARKET_CATEGORIES: readonly MarketCategory[] = ["weapon", "shield", "outfit", "accessory"];

export const MARKET_PRODUCTS: readonly MarketProduct[] = [
  tool("weapon", "squeaky-ball", "삑삑이 공", 10, "한 번 튕기는 공으로 삼색이를 맞힙니다."),
  tool("weapon", "rolled-newspaper", "돌돌 말린 신문지", 13, "신문지를 휘둘러 더 멀리 공격합니다."),
  tool("weapon", "pink-backscratcher", "분홍색 효자손", 15, "위쪽까지 닿는 효자손으로 공격합니다."),
  tool("weapon", "drumstick-boomerang", "닭다리 뼈 부메랑", 18, "던지면 돌아오는 뼈 부메랑입니다."),
  tool("weapon", "plastic-frisbee", "플라스틱 원반", 20, "빠른 원반을 멀리 던집니다."),
  tool("shield", "cushion-pad", "쿠션 패드", 10, "정면의 약한 공격을 두 번 막습니다."),
  tool("shield", "greasy-pizza-box", "기름진 피자 박스", 13, "정면의 약한 공격을 두 번 막습니다."),
  tool("shield", "umbrella", "우산", 15, "정면의 약한 투사체를 두 번 막습니다."),
  tool("shield", "yellow-pot-lid", "노란 양은 냄비 뚜껑", 18, "정면의 약한 공격을 세 번 막고 다음 투척을 늦춥니다."),
  cosmetic("outfit", "pink-caterpillar-suit", "핑크 애벌레 수트", 12, "핑크 애벌레 모습으로 갈아입습니다."),
  cosmetic("outfit", "banana-peel-suit", "바나나 껍질 수트", 12, "바나나 껍질을 몸통에 둘러 입습니다."),
  cosmetic("outfit", "bee-bodysuit", "꿀벌 바디수트", 14, "줄무늬 꿀벌 수트를 입습니다."),
  cosmetic("outfit", "hotdog-outfit", "핫도그 옷", 14, "빵 사이의 핫도그 코기가 됩니다."),
  cosmetic("outfit", "diamond-armor", "다이아몬드 갑옷", 20, "반짝이는 각진 갑옷을 입습니다."),
  cosmetic("accessory", "shinchan-eyebrow-sticker", "숮검등이 짱구 눈썹 스티커", 14, "짱구 눈썹 스티커를 눈 위에 붙입니다."),
  cosmetic("accessory", "birthday-party-hat", "생일 고깔모자", 14, "생일 고깔모자를 머리에 씁니다."),
  cosmetic("accessory", "strawberry-headpiece", "딸기 탈", 16, "딸기 탈을 얼굴에 씁니다."),
  cosmetic("accessory", "propeller-hat", "어린이 프로펠러 모자", 18, "프로펠러 모자를 머리에 씁니다."),
  cosmetic("accessory", "prince-crown", "왕자님 왕관", 24, "왕자님 왕관을 머리에 씁니다."),
];

const productsById = new Map(MARKET_PRODUCTS.map((product) => [product.id, product]));
export function getMarketProduct(id: string): MarketProduct | undefined {
  return productsById.get(id);
}
