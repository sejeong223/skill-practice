import type { CosmeticId, MarketCategory, ProgressState, ToolId } from "../core/types";
import { MARKET_CATEGORIES, MARKET_PRODUCTS, getMarketProduct } from "./marketCatalog";
import { TOOL_DEFINITIONS } from "./tools";
import { getToolPresentation } from "./toolPresentation";

export type OwnedCatalogEntry = Readonly<{
  id: string;
  nameKo: string;
  descriptionKo: string;
  iconUrl: string | null;
} & (
  { category: "weapon" | "shield"; toolId: ToolId; cosmeticId?: never } |
  { category: "outfit" | "accessory"; cosmeticId: CosmeticId; toolId?: never }
)>;

export function getOwnedCatalogEntries(
  progress: Pick<ProgressState, "ownedToolIds" | "ownedCosmeticIds">,
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
  const entries = [...tools, ...cosmetics];
  const categoryOrder = new Map<MarketCategory, number>(MARKET_CATEGORIES.map((category, index) => [category, index]));
  return entries.sort((a, b) => (categoryOrder.get(a.category) ?? 0) - (categoryOrder.get(b.category) ?? 0));
}
