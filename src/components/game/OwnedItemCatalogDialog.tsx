"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import Image from "next/image";
import type { MarketCategory, ProgressState } from "@/game/core/types";
import { MARKET_CATEGORIES } from "@/game/data/marketCatalog";
import { SHOP_CATEGORY_LABELS } from "@/game/data/shopDialogue";
import type { OwnedCatalogEntry } from "@/game/data/ownedItemCatalog";
import { CustomOutfitPreview } from "./CustomOutfitPreview";

export interface OwnedItemCatalogDialogProps {
  readonly progress: ProgressState;
  readonly entries: readonly OwnedCatalogEntry[];
  readonly onEquip: (id: string) => void;
  readonly onUnequip: (category: "outfit" | "accessory") => void;
  readonly onClose: (source: "button" | "keyboard") => void;
}

export function OwnedItemCatalogDialog({ progress, entries, onEquip, onUnequip, onClose }: OwnedItemCatalogDialogProps): ReactElement {
  const [category, setCategory] = useState<MarketCategory>("weapon");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    previousFocusRef.current = document.querySelector<HTMLElement>(".catalog-open-button") ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCloseRef.current("keyboard");
        return;
      }
      if (event.key !== "Tab") return;
      const buttons = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
      if (!buttons.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      previousFocusRef.current?.focus();
    };
  }, []);

  const visibleEntries = entries.filter((entry) => entry.category === category);
  return (
    <div className="owned-catalog-overlay">
      <div className="owned-catalog-dialog" role="dialog" aria-modal="true" aria-labelledby="owned-catalog-title" ref={dialogRef}>
        <header className="owned-catalog-header">
          <div><span className="owned-catalog-kicker">CORGI COLLECTION</span><h2 id="owned-catalog-title">보유 아이템 카탈로그</h2></div>
          <button ref={closeRef} className="owned-catalog-close" type="button" aria-label="카탈로그 닫기" onClick={() => onClose("button")}>×</button>
        </header>
        <nav className="owned-catalog-categories" aria-label="보유품 분류">
          {MARKET_CATEGORIES.map((next) => (
            <button key={next} type="button" aria-pressed={category === next} className={category === next ? "is-active" : ""} onClick={() => setCategory(next)}>
              {SHOP_CATEGORY_LABELS[next]} <span>{entries.filter((entry) => entry.category === next).length}</span>
            </button>
          ))}
        </nav>
        <div className="owned-catalog-list" aria-label={`${SHOP_CATEGORY_LABELS[category]} 보유 목록`}>
          {visibleEntries.length === 0 && <p className="owned-catalog-empty">보유한 아이템이 없습니다.</p>}
          {visibleEntries.map((entry) => {
            const equipped = entry.category === "weapon" ? progress.equippedAttackToolId === entry.toolId
              : entry.category === "shield" ? progress.equippedDefenseToolId === entry.toolId
                : entry.category === "outfit" ? entry.customOutfitId
                  ? progress.equippedCustomOutfitId === entry.customOutfitId
                  : progress.equippedOutfitId === entry.cosmeticId
                  : progress.equippedAccessoryId === entry.cosmeticId;
            const canUnequip = equipped && (entry.category === "outfit" || entry.category === "accessory");
            return (
              <article className="owned-catalog-card" key={entry.id}>
                <div className="owned-catalog-icon">
                  {entry.customOutfitId && progress.customOutfits.find((design) => design.id === entry.customOutfitId)
                    ? <CustomOutfitPreview design={progress.customOutfits.find((design) => design.id === entry.customOutfitId)!} />
                    : entry.iconUrl ? <Image src={entry.iconUrl} alt="" width={64} height={64} unoptimized />
                    : <span>{entry.nameKo}</span>}
                </div>
                <div className="owned-catalog-copy"><h3>{entry.nameKo}</h3><p>{entry.descriptionKo}</p></div>
                <button type="button" className="owned-catalog-action" disabled={equipped && !canUnequip}
                  onClick={() => canUnequip ? onUnequip(entry.category as "outfit" | "accessory") : onEquip(entry.id)}>
                  {canUnequip ? "벗기" : equipped ? "장착 중" : entry.category === "weapon" || entry.category === "shield" ? "장착" : "착용"}
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
