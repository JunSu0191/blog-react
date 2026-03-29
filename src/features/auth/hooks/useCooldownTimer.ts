import { useCallback, useEffect, useMemo, useState } from "react";

export function calculateRemainingSeconds(targetTimestampMs: number, nowMs: number) {
  const delta = targetTimestampMs - nowMs;
  if (delta <= 0) return 0;
  return Math.ceil(delta / 1000);
}

export function useCooldownTimer() {
  const [targetTimestampMs, setTargetTimestampMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!targetTimestampMs) return;

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [targetTimestampMs]);

  const remainingSeconds = useMemo(() => {
    if (!targetTimestampMs) return 0;
    return calculateRemainingSeconds(targetTimestampMs, nowMs);
  }, [nowMs, targetTimestampMs]);

  const start = useCallback((seconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    if (safeSeconds <= 0) {
      setTargetTimestampMs(null);
      setNowMs(Date.now());
      return;
    }

    const nextTarget = Date.now() + safeSeconds * 1000;
    setTargetTimestampMs(nextTarget);
    setNowMs(Date.now());
  }, []);

  const clear = useCallback(() => {
    setTargetTimestampMs(null);
    setNowMs(Date.now());
  }, []);

  return {
    remainingSeconds,
    isRunning: remainingSeconds > 0,
    start,
    clear,
  };
}
