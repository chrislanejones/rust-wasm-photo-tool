import { useCallback, useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "touchstart",
] as const;

/**
 * Reports `idle = true` after `timeoutMin` minutes with no user activity
 * (0 disables it). While idle, further activity is ignored — only the explicit
 * `wake()` (the "Continue" button) dismisses it and restarts the countdown.
 */
export function useIdleTimeout(timeoutMin: number) {
  const [idle, setIdle] = useState(false);
  const idleRef = useRef(false);
  const armRef = useRef<() => void>(() => {});

  useEffect(() => {
    idleRef.current = idle;
  }, [idle]);

  useEffect(() => {
    if (timeoutMin <= 0) {
      idleRef.current = false;
      setIdle(false);
      return;
    }
    const ms = timeoutMin * 60_000;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        idleRef.current = true;
        setIdle(true);
      }, ms);
    };
    armRef.current = arm;
    const onActivity = () => {
      if (idleRef.current) return; // idle screen up — ignore until explicit wake
      arm();
    };
    arm();
    for (const e of ACTIVITY_EVENTS) {
      window.addEventListener(e, onActivity, { passive: true });
    }
    return () => {
      if (timer) clearTimeout(timer);
      for (const e of ACTIVITY_EVENTS) {
        window.removeEventListener(e, onActivity);
      }
      armRef.current = () => {};
    };
  }, [timeoutMin]);

  const wake = useCallback(() => {
    idleRef.current = false;
    setIdle(false);
    armRef.current(); // restart the countdown
  }, []);

  return { idle, wake };
}
