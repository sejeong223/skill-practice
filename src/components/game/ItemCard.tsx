"use client";
import type { ReactElement } from "react";
import type { ItemCardData } from "@/game/cutscenes/types";
export function ItemCard({ item }: { readonly item: ItemCardData }): ReactElement {
  return <article className="item-card"><span className="panel-kicker">ITEM DISCOVERED</span><h2>{item.title}</h2><p>{item.description}</p></article>;
}
