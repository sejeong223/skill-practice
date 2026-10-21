"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import Image from "next/image";
import type { MarketCategory, MarketProduct, ProgressState } from "@/game/core/types";
import type { PurchaseResult } from "@/game/systems/EconomySystem";
import { MARKET_CATEGORIES } from "@/game/data/marketCatalog";
import { pickShopDialogue, SHOP_CATEGORY_LABELS, SHOP_DIALOGUE, wrapShopIndex } from "@/game/data/shopDialogue";

export interface ShopPanelProps {
  readonly bankedCoins: number;
  readonly products: readonly MarketProduct[];
  readonly progress: ProgressState;
  readonly onPurchase: (id: string) => PurchaseResult;
  readonly onEquip: (id: string) => void;
  readonly onClose: (source: "button" | "keyboard") => void;
}

export function ShopPanel({ bankedCoins, products, progress, onPurchase, onEquip, onClose }: ShopPanelProps): ReactElement {
  const [category, setCategory] = useState<MarketCategory>("weapon");
  const [index, setIndex] = useState(0);
  const [dialogue, setDialogue] = useState(() => pickShopDialogue("entry"));
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const categoryProducts = products.filter((product) => product.category === category);
  const product = categoryProducts[index] ?? categoryProducts[0];
  const owned = product?.cosmeticId
    ? progress.ownedCosmeticIds.includes(product.cosmeticId)
    : product ? progress.ownedToolIds.includes(product.toolId) : false;
  const equipped = product?.category === "weapon" ? progress.equippedAttackToolId === product.toolId
    : product?.category === "shield" ? progress.equippedDefenseToolId === product.toolId
      : product?.category === "outfit" ? progress.equippedOutfitId === product.cosmeticId
        : product?.category === "accessory" ? progress.equippedAccessoryId === product.cosmeticId : false;

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose("keyboard");
        return;
      }
      if (event.key !== "Tab") return;
      const buttons = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
      if (!buttons.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  const chooseCategory = (next: MarketCategory): void => {
    setCategory(next);
    setIndex(0);
    setDialogue(pickShopDialogue("selection"));
  };
  const move = (delta: number): void => {
    setIndex((current) => wrapShopIndex(current, delta, categoryProducts.length));
    setDialogue(pickShopDialogue("selection"));
  };
  const purchase = (): void => {
    if (!product) return;
    const result = onPurchase(product.id);
    if (result.ok) setDialogue(pickShopDialogue("purchase"));
    else if (result.reason === "insufficient-coins") setDialogue(SHOP_DIALOGUE.insufficient);
  };

  return (
    <div className="goodboy-shop-overlay">
      <div className="goodboy-shop-dialog" role="dialog" aria-modal="true" aria-label="리트리버의 굿보이 마켓" ref={dialogRef}>
        <header className="goodboy-shop-header">
          <div><span className="goodboy-shop-kicker">GOOD BOY MARKET</span><h2>리트리버의 굿보이 마켓</h2></div>
          <div className="goodboy-shop-header-actions">
            <strong aria-label={`보유 뼈다귀 코인 ${bankedCoins}개`}>🦴 {bankedCoins}</strong>
            <button ref={closeRef} className="goodboy-shop-close" type="button" aria-label="상점 닫기" onClick={() => onClose("button")}>×</button>
          </div>
        </header>
        <div className="goodboy-shop-body">
          <aside className="goodboy-shop-vendor">
            <div className="goodboy-shop-vendor-portrait">
              <Image src="/assets/pixel/shop/goodboy-retriever.png" alt="연두색 조끼를 입고 웃는 골든 리트리버 상점 주인" width={256} height={256} unoptimized />
            </div>
            <p className="goodboy-shop-vendor-name">친절한 리트리버 주인</p>
            <p className="goodboy-shop-dialogue" role="status" aria-live="polite">“{dialogue}”</p>
          </aside>
          <section className="goodboy-shop-products" aria-label="판매 상품">
            <nav className="goodboy-shop-categories" aria-label="상품 분류">
              {MARKET_CATEGORIES.map((next) => (
                <button key={next} type="button" className={next === category ? "is-active" : ""}
                  aria-pressed={next === category} onClick={() => chooseCategory(next)}>{SHOP_CATEGORY_LABELS[next]}</button>
              ))}
            </nav>
            {product && (
              <div className="goodboy-shop-product">
                <span className="goodboy-shop-category-label">{SHOP_CATEGORY_LABELS[category]} · {index + 1} / {categoryProducts.length}</span>
                <div className="goodboy-shop-product-stage">
                  <button className="goodboy-shop-arrow" type="button" aria-label="이전 상품" onClick={() => move(-1)}><span aria-hidden="true">◀</span></button>
                  <div className="goodboy-shop-item-portrait">
                    <Image src={product.iconUrl} alt={product.nameKo} width={64} height={64} unoptimized />
                  </div>
                  <button className="goodboy-shop-arrow" type="button" aria-label="다음 상품" onClick={() => move(1)}><span aria-hidden="true">▶</span></button>
                </div>
                <div className="goodboy-shop-product-info">
                  <h3>{product.nameKo}</h3>
                  <p>{product.advantageKo}</p>
                  <strong>{product.price} 코인</strong>
                  <span>{owned ? equipped ? "착용 중" : "구매 완료" : "미보유"}</span>
                </div>
                <button className="goodboy-shop-action" type="button" disabled={equipped}
                  onClick={() => owned ? onEquip(product.id) : purchase()}>
                  {equipped ? "장착 중" : owned ? "장착" : "구매"}
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
