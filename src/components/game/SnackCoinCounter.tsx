"use client";
import type { ReactElement } from "react";

export interface SnackCoinCounterProps { readonly balance: number; }

export function SnackCoinCounter({ balance }: SnackCoinCounterProps): ReactElement {
  return (
    <div className="snack-coin-counter" role="status" aria-live="polite" aria-atomic="true"
      aria-label={`보유 간식 코인 ${balance}개`}>
      <span>간식 코인</span>
      <strong>{balance.toLocaleString("ko-KR")}</strong>
    </div>
  );
}
