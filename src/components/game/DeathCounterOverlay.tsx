import Image from "next/image";
import type { ReactElement } from "react";

export interface DeathCounterOverlayProps {
  readonly deathCount: number;
  readonly visible: boolean;
}

export function DeathCounterOverlay({
  deathCount,
  visible,
}: DeathCounterOverlayProps): ReactElement | null {
  if (!visible) return null;

  return (
    <div className="death-counter-overlay" role="alert" aria-live="assertive">
      <div className="death-counter-content">
        <Image
          src="/assets/pixel/characters/corgi/corgi-face-icon.svg"
          alt="코기 얼굴"
          width={64}
          height={64}
          unoptimized
        />
        <span>x -{deathCount}</span>
      </div>
    </div>
  );
}
