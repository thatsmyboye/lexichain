import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

// Tweens a displayed number toward `target` with requestAnimationFrame so
// score changes tick up instead of jumping. Decreases (new game) snap.
export function useAnimatedNumber(target: number, durationMs = 600): number {
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);

  useEffect(() => {
    const from = displayRef.current;
    if (reducedMotion || target <= from) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (target - from) * eased);
      displayRef.current = value;
      setDisplay(value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, reducedMotion]);

  return display;
}
