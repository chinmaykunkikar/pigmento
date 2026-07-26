"use client";

import { useEffect, useRef, useState } from "react";

// rAF count-up from 0 to target, easeOutCubic. The one reserved signature beat
// (hero-only). JS-driven, so it plays regardless of prefers-reduced-motion per A8.
// When play is false it snaps to target (no animation) for the already-warm case.
export function useCountUp(
  target: number,
  opts: { durationMs?: number; play?: boolean } = {},
): number {
  const { durationMs = 900, play = true } = opts;
  const [value, setValue] = useState(play ? 0 : target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!play) {
      setValue(target);
      return;
    }
    let startTs: number | null = null;
    const tick = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / durationMs);
      const eased = 1 - (1 - p) ** 3;
      setValue(target * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs, play]);

  return value;
}
