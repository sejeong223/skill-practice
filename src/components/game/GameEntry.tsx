"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AuthProvider, useGameAuth } from "@/auth/AuthProvider";
import { gameMode } from "@/auth/msal";
import { AccountCache } from "@/game/persistence/cloud/AccountCache";
import { CloudGameController } from "@/game/persistence/cloud/CloudGameController";
import { GameApiClient } from "@/game/persistence/cloud/GameApiClient";
import { DEVELOPMENT_STAGE_ID } from "@/game/systems/developmentStart";
import { LoginGate } from "./LoginGate";
import { GameShell } from "./GameShell";
import { CloudStatusOverlay } from "./CloudStatusOverlay";
export type { CloudGameSession } from "@/game/persistence/cloud/CloudGameController";

function ConnectedGame({ controller }: { controller: CloudGameController }) {
  const auth = useGameAuth();
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [logoutError, setLogoutError] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true); setLogoutError(false);
    try {
      await controller.logout();
      // Commit the unmount (including Phaser.destroy) before redirecting to Microsoft.
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      await auth.signOut();
    } catch { setLogoutError(true); }
    finally { setLoggingOut(false); }
  };
  if (!state.cloud) return <div className="cloud-entry" role="status"><section>
    <h1>{state.phase === "takeover" ? "다른 화면에서 플레이 중입니다" : state.phase === "error" ? "게임을 준비하지 못했습니다" : "저장 데이터를 확인하고 있습니다…"}</h1>
    {state.message && <p>{state.message}</p>}
    {state.phase === "takeover" && <button className="primary-button" type="button" onClick={() => void controller.start(true)}>여기서 이어하기</button>}
    {state.phase === "error" && <button className="primary-button" type="button" onClick={() => void controller.start()}>다시 시도</button>}
    {(state.phase === "takeover" || state.phase === "error") && <button className="tiny-button" type="button" onClick={() => void auth.signOut()}>로그아웃</button>}
  </section></div>;
  return <>
    <GameShell key={state.cloud.bootstrap.current.runId} mode="cloud" cloud={state.cloud}
      initialStageId={state.cloud.bootstrap.current.resume.stageId} onCloudObservation={controller.observe} onCloudReset={controller.reset} />
    <button className="cloud-logout tiny-button" disabled={loggingOut} type="button" onClick={() => void logout()}>{loggingOut ? "저장 후 로그아웃 중…" : "로그아웃"}</button>
    <CloudStatusOverlay status={state.status} saved={state.saved} onRetry={() => void controller.retry().catch(() => {})}
      onReload={() => window.location.reload()} onSignIn={() => void auth.signIn()} />
    {logoutError && <div className="cloud-blocker" role="alertdialog" aria-modal="true" aria-label="로그아웃 확인"><section>
      <p>저장과 연결 종료를 확인하지 못했습니다.</p><button type="button" className="primary-button" onClick={() => void logout()}>저장 후 로그아웃 다시 시도</button>
      <button type="button" className="tiny-button" onClick={() => window.location.reload()}>저장 데이터 다시 불러오기</button>
    </section></div>}
  </>;
}
/** Each account owns a fresh effect lifetime; callbacks from a previous account cannot publish here. */
export function CloudEntrySession() {
  const { getAccessToken, requireReauthentication } = useGameAuth();
  const [controller, setController] = useState<CloudGameController | null>(null);
  useEffect(() => {
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { /* Connection screen reports unavailable storage. */ }
    const next = new CloudGameController(new GameApiClient(getAccessToken, fetch, requireReauthentication), new AccountCache(storage));
    let active = true;
    queueMicrotask(() => { if (active) { setController(next); void next.start(); } });
    return () => { active = false; next.dispose(); };
  }, [getAccessToken, requireReauthentication]);
  return controller ? <ConnectedGame controller={controller} /> : <p role="status">게임 준비 중…</p>;
}
function AccountGame() {
  const { state } = useGameAuth();
  return <LoginGate><CloudEntrySession key={state.accountKey} /></LoginGate>;
}
export function GameEntry() {
  if (gameMode() === "local-dev") return <GameShell mode="local" initialStageId={DEVELOPMENT_STAGE_ID} />;
  return <AuthProvider><AccountGame /></AuthProvider>;
}
