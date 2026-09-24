"use client";
import type { ReactElement } from "react";
import type { ToolDefinition } from "@/game/core/types";
import { getToolPresentation } from "@/game/data/toolPresentation";

export interface ShopPanelProps {
  readonly bankedCoins: number;
  readonly ownedToolIds: readonly string[];
  readonly tools: readonly ToolDefinition[];
  readonly onPurchase: (tool: ToolDefinition) => void;
}

export function ShopPanel({ bankedCoins, ownedToolIds, tools, onPurchase }: ShopPanelProps): ReactElement {
  return (
    <section className="overlay-panel shop-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">안전 구역 상점</span>
          <h2>도구 상점</h2>
        </div>
        <strong className="coin-price">{bankedCoins} 코인</strong>
      </div>
      <div className="shop-grid">
        {tools.map((tool) => {
          const owned = ownedToolIds.includes(tool.id);
          const affordable = bankedCoins >= tool.price;
          const presentation = getToolPresentation(tool.id);
          return (
            <article className="shop-card" key={tool.id}>
              <span className="shop-slot">{presentation.slotKo}</span>
              <h3>{presentation.nameKo}</h3>
              <p>{presentation.effectKo}</p>
              <small>{tool.price === 0 ? "기본 장비" : `${tool.price} 코인`}</small>
              <button
                className="primary-button"
                type="button"
                disabled={owned || !affordable}
                onClick={() => onPurchase(tool)}
              >
                {owned ? "보유 중" : affordable ? "구매" : "코인 부족"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
