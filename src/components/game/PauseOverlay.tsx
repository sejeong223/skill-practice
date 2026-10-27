"use client";

import Image from "next/image";
import { useEffect, useRef, type ReactElement } from "react";

interface PauseOverlayProps {
  readonly onResume: () => void;
}

export function PauseOverlay({ onResume }: PauseOverlayProps): ReactElement {
  const resumeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    resumeButton.current?.focus({ preventScroll: true });
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <div className="pause-overlay">
      <section className="pause-overlay-content" aria-labelledby="pause-title">
        <h2 id="pause-title" className="pause-overlay-title" role="status" aria-live="polite">
          일시정지
        </h2>
        <button ref={resumeButton} className="pause-resume-button" type="button" onClick={onResume}>
          <Image className="hud-menu-icon" src="/assets/pixel/ui/menu-play.png" width={20} height={20} alt="" aria-hidden="true" draggable={false} unoptimized />
          계속하기
        </button>
      </section>
    </div>
  );
}
