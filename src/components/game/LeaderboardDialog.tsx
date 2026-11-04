"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LeaderboardResponse, LeaderboardRow } from "@/game/cloud/contracts";
import { parseLeaderboardResponse } from "@/game/cloud/validation";
import { ApiClientError } from "@/game/persistence/cloud/GameApiClient";
export type LeaderboardState = { status: "loading"; rows: []; error: null } |
  { status: "ready"; rows: LeaderboardRow[]; error: null } | { status: "error"; rows: []; error: string };
export interface LeaderboardDialogProps {
  load(signal: AbortSignal): Promise<LeaderboardResponse>; onClose(): void; blocked?: boolean;
}
const initial: LeaderboardState = { status: "loading", rows: [], error: null };
export function LeaderboardDialog({ load, onClose, blocked = false }: LeaderboardDialogProps) {
  const [state, setState] = useState<LeaderboardState>(initial);
  const [attempt, setAttempt] = useState(0);
  const dialog = useRef<HTMLElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  const callbacks = useRef({ onClose, blocked });
  const focusEpoch = useRef({ epoch: 0 });
  useEffect(() => { callbacks.current = { onClose, blocked }; }, [onClose, blocked]);
  useEffect(() => {
    const controller = new AbortController();
    void load(AbortSignal.any([controller.signal, AbortSignal.timeout(35000)])).then(response => {
      if (!controller.signal.aborted) setState({ status: "ready", rows: parseLeaderboardResponse(response).rows, error: null });
    }).catch(error => {
      if (controller.signal.aborted) return;
      const message = error instanceof ApiClientError && error.status === 401 ? "다시 로그인한 뒤 랭킹을 확인해 주세요." :
        error instanceof ApiClientError && error.status === 403 ? "랭킹을 조회할 권한이 없습니다." :
        error instanceof ApiClientError && error.status === 429 ? "요청이 많습니다. 잠시 후 다시 시도해 주세요." : "랭킹을 불러오지 못했습니다. 다시 시도해 주세요.";
      setState({ status: "error", rows: [], error: message });
    });
    return () => controller.abort();
  }, [load, attempt]);
  useEffect(() => {
    const lifetime = focusEpoch.current, epoch = ++lifetime.epoch;
    const previous = document.querySelector<HTMLElement>(".leaderboard-open-button") ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (callbacks.current.blocked) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); callbacks.current.onClose(); return; }
      if (event.key !== "Tab") return;
      const buttons = [...(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
      const first = buttons[0], last = buttons.at(-1);
      if (!first || !last) return;
      if (!dialog.current?.contains(document.activeElement) || !event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => {
      window.removeEventListener("keydown", handleKey, true);
      queueMicrotask(() => {
        if (lifetime.epoch !== epoch) return;
        if (previous?.isConnected && !previous.closest("[inert]")) previous.focus();
        else document.querySelector<HTMLElement>(".cloud-blocker button")?.focus();
      });
    };
  }, []);
  return createPortal(<div className="leaderboard-overlay" inert={blocked}>
    <section ref={dialog} className="leaderboard-dialog" role="dialog" aria-modal="true" aria-labelledby="leaderboard-title" aria-describedby="leaderboard-description">
      <header><div><p className="intro-title-kicker">명예의 전당</p><h2 id="leaderboard-title">TOP 10 랭킹</h2></div>
        <button ref={closeButton} className="tiny-button" type="button" onClick={onClose} aria-label="랭킹 닫기">닫기</button></header>
      <p id="leaderboard-description">가장 멀리 도달한 기록 · 데스가 적은 순 · 이름순</p>
      {state.status === "loading" && <p className="leaderboard-message" role="status">랭킹을 불러오는 중…</p>}
      {state.status === "error" && <div className="leaderboard-message"><p role="alert">{state.error}</p><button className="primary-button" type="button"
        onClick={() => { setState(initial); setAttempt(value => value + 1); }}>다시 시도</button></div>}
      {state.status === "ready" && (state.rows.length === 0 ? <p className="leaderboard-message" role="status">아직 등록된 기록이 없어요.</p> :
        <table><caption className="sr-only">플레이어 역대 최고 기록 10위</caption><colgroup><col className="rank-column" /><col /><col className="deaths-column" /><col className="location-column" /></colgroup>
          <thead><tr><th scope="col">순위</th><th scope="col">닉네임</th><th scope="col">데스 수</th><th scope="col">클리어 위치</th></tr></thead>
          <tbody>{state.rows.map(row => <tr key={row.rank}><td>{row.rank}</td><th scope="row">{row.nickname}</th><td>{row.deaths}</td><td>{row.location}</td></tr>)}</tbody>
        </table>)}
    </section>
  </div>, document.body);
}
