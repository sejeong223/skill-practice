"use client";

import { useEffect, useState, type ReactElement } from "react";

export interface TypewriterTextProps {
  readonly text: string;
  readonly durationMs: number;
  readonly resetKey: string;
  readonly className?: string;
}

export function TypewriterText({
  text,
  durationMs,
  resetKey,
  className,
}: TypewriterTextProps): ReactElement {
  const [progress, setProgress] = useState<{ readonly key: string; readonly count: number }>({ key: "", count: 0 });
  const renderKey = resetKey + "\u0000" + text;

  useEffect(() => {
    const glyphs = Array.from(text);
    if (glyphs.length === 0) return undefined;

    const revealDuration = Math.max(80, durationMs * 0.8);
    const startAt = window.performance.now();
    let frame = 0;
    let lastCount = 0;
    const reveal = (now: number): void => {
      const progress = Math.min(1, (now - startAt) / revealDuration);
      const nextCount = Math.min(glyphs.length, Math.floor(progress * glyphs.length));
      if (nextCount !== lastCount) {
        lastCount = nextCount;
        setProgress({ key: renderKey, count: nextCount });
      }
      if (nextCount < glyphs.length) frame = window.requestAnimationFrame(reveal);
    };

    frame = window.requestAnimationFrame(reveal);
    return () => window.cancelAnimationFrame(frame);
  }, [durationMs, renderKey, text]);

  const visibleGlyphCount = progress.key === renderKey ? progress.count : 0;
  return <span className={className}>{Array.from(text).slice(0, visibleGlyphCount).join("")}</span>;
}
