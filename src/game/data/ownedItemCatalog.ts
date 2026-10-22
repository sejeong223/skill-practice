import type { CosmeticId, CustomOutfitId, MarketCategory, ProgressState, ToolId } from "../core/types";
import { MARKET_CATEGORIES, MARKET_PRODUCTS, getMarketProduct } from "./marketCatalog";
import { TOOL_DEFINITIONS } from "./tools";
import { getToolPresentation } from "./toolPresentation";

export type OwnedCatalogEntry = Readonly<{
  id: string;
  nameKo: string;
  descriptionKo: string;
  iconUrl: string | null;
} & (
  { category: "weapon" | "shield"; toolId: ToolId; cosmeticId?: never; customOutfitId?: never } |
  { category: "outfit" | "accessory"; cosmeticId: CosmeticId; toolId?: never; customOutfitId?: never } |
  { category: "outfit"; customOutfitId: CustomOutfitId; cosmeticId?: never; toolId?: never }
)>;

export function getOwnedCatalogEntries(
  progress: Pick<ProgressState, "ownedToolIds" | "ownedCosmeticIds" | "customOutfits">,
): readonly OwnedCatalogEntry[] {
  const ownedTools = new Set(progress.ownedToolIds);
  const ownedCosmetics = new Set(progress.ownedCosmeticIds);
  const tools: OwnedCatalogEntry[] = TOOL_DEFINITIONS.filter((tool) => ownedTools.has(tool.id)).map((tool) => {
    const product = getMarketProduct(tool.id);
    const presentation = getToolPresentation(tool.id);
    return {
      id: tool.id,
      category: tool.slot === "attack" ? "weapon" : "shield",
      toolId: tool.id,
      nameKo: product?.nameKo ?? presentation.nameKo,
      descriptionKo: product?.advantageKo ?? presentation.effectKo,
      iconUrl: product?.iconUrl ?? null,
    };
  });
  const cosmetics: OwnedCatalogEntry[] = MARKET_PRODUCTS.filter((product) =>
    product.cosmeticId !== undefined && ownedCosmetics.has(product.cosmeticId),
  ).map((product) => {
    if (product.category !== "outfit" && product.category !== "accessory") {
      throw new Error(`Invalid cosmetic category: ${product.category}`);
    }
    return {
      id: product.id,
      category: product.category,
      cosmeticId: product.cosmeticId,
      nameKo: product.nameKo,
      descriptionKo: product.advantageKo,
      iconUrl: product.iconUrl,
    };
  });
  const custom: OwnedCatalogEntry[] = progress.customOutfits.map((design) => ({
    id: design.id,
    category: "outfit",
    customOutfitId: design.id,
    nameKo: `내가 그린 옷 ${design.id.slice(-1)}`,
    descriptionKo: "직접 디자인한 흰 옷 · 언제든 다시 입을 수 있어요",
    iconUrl: null,
  }));
  const entries = [...tools, ...cosmetics, ...custom];
  const categoryOrder = new Map<MarketCategory, number>(MARKET_CATEGORIES.map((category, index) => [category, index]));
  return entries.sort((a, b) => (categoryOrder.get(a.category) ?? 0) - (categoryOrder.get(b.category) ?? 0));
}
