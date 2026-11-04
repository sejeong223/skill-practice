"use client";
import type { SaveStatus } from "@/game/persistence/cloud/CloudSaveCoordinator";
const descriptions: Record<SaveStatus, string> = {
  idle: "서버에 저장했습니다.", saving: "저장 중…", reconnecting: "연결을 확인하고 있습니다. 저장이 끝나면 다시 시작합니다.",
  "reauth-required": "계속하려면 다시 로그인해 주세요.", "session-lost": "다른 화면으로 플레이가 전환되었습니다.",
  conflict: "서버의 진행 정보가 달라졌습니다. 저장 데이터를 다시 불러와 주세요.",
  "storage-error": "기기 저장 공간을 확인해 주세요. 진행을 보호하기 위해 잠시 멈췄습니다.",
};
export function CloudStatusOverlay({ status, saved, onRetry, onReload, onSignIn }: {
  status: SaveStatus; saved: boolean; onRetry(): void; onReload(): void; onSignIn(): void;
}) {
  const blocking = status !== "idle" && status !== "saving";
  if (status === "idle" && !saved) return null;
  return <div className={blocking ? "cloud-blocker" : "cloud-save-status"} role={blocking ? "alertdialog" : "status"}
    aria-modal={blocking || undefined} aria-label={blocking ? "게임 연결 확인" : undefined}>
    <section><p>{descriptions[status]}</p>
      {(status === "reconnecting" || status === "storage-error") && <button className="primary-button" type="button" onClick={onRetry}>연결 다시 확인</button>}
      {(status === "session-lost" || status === "conflict") && <button className="primary-button" type="button" onClick={onReload}>저장 데이터 다시 불러오기</button>}
      {status === "reauth-required" && <button className="primary-button" type="button" onClick={onSignIn}>다시 로그인</button>}
    </section>
  </div>;
}
