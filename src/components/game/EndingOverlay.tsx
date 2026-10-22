"use client";

import { useEffect, useRef, type ReactElement } from "react";

export interface EndingOverlayProps {
  readonly onReplayWorld01: () => void;
}

export function EndingOverlay({ onReplayWorld01 }: EndingOverlayProps): ReactElement {
  const replayButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { replayButton.current?.focus({ preventScroll: true }); }, []);

  return (
    <div className="ending-overlay" role="dialog" aria-modal="true" aria-labelledby="ending-title">
      <section className="ending-card">
        <p className="intro-title-kicker">왕갈비뼈 원정 완료</p>
        <h2 id="ending-title">TO BE CONTINUED...?</h2>
        <p>메인쿤을 이기고 집으로 돌아온 코기. 하지만 모험은 아직 끝나지 않았습니다.</p>
        <button ref={replayButton} className="pause-resume-button" type="button" onClick={onReplayWorld01}>
          월드 1부터 다시 플레이
        </button>
      </section>
    </div>
  );
}
