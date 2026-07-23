/**
 * Count-up for KPI numbers (glow-up brief v2 §2): the figure sweeps from 0 to
 * its value on load in under 200ms — motion that communicates "this number
 * just arrived", not decoration. Respects prefers-reduced-motion by jumping
 * straight to the final value, and re-runs when the value changes.
 *
 * Plain rAF — no animation library. Only meaningful for finite numbers;
 * callers pass formatted strings straight through.
 */
import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 200;

export default function useCountUp(target) {
  const numeric = typeof target === 'number' && Number.isFinite(target);
  // Reduced-motion users (and the test environment) get the final value at
  // mount — no animation, no intermediate frames.
  const [shown, setShown] = useState(() => {
    if (!numeric) return target;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? target : 0;
  });
  const frame = useRef();

  useEffect(() => {
    if (!numeric) return undefined;
    // All updates ride rAF (never synchronously inside the effect); reduced
    // motion just lands on the final value in the first frame.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    function tick(now) {
      if (reduce) {
        setShown(target);
        return;
      }
      const progress = Math.min((now - start) / DURATION_MS, 1);
      // ease-out: fast start, settled finish.
      const eased = 1 - (1 - progress) ** 2;
      setShown(Math.round(target * eased));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    }
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, numeric]);

  return numeric ? shown : target;
}
