// The Compare overlay's original, decoded before it is painted. Its own file so
// CompareSlider.tsx exports only a component (react-refresh).
import { useEffect, useState } from "react";
import { useDelayedFlag } from "@/hooks/usePhotoSwitching";

/** How long the original may take to arrive and decode before compare admits
 *  it is not coming. Same deadline as `DecodedImage`. */
export const ORIGINAL_TIMEOUT_MS = 15_000;

/**
 * Is the original ready to paint? Read from IndexedDB, then decoded OFF-SCREEN:
 * a CSS background that is still decoding paints nothing, so the Original half
 * used to show blank until it caught up. Failure always ends the wait — a
 * decode error, or no URL at all within the deadline (the original is missing
 * from storage), so a skeleton never pulses for ever.
 */
export function useOriginalImage(url: string | null, active: boolean) {
  const [decoded, setDecoded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!url) return;
    let live = true;
    const probe = new Image();
    probe.decoding = "async";
    probe.src = url;
    const timeout = window.setTimeout(() => live && setFailed(url), ORIGINAL_TIMEOUT_MS);
    probe.decode().then(
      () => live && setDecoded(url),
      () => live && setFailed(url),
    );
    return () => {
      live = false;
      window.clearTimeout(timeout);
    };
  }, [url]);

  useEffect(() => {
    if (!active || url) return;
    const t = window.setTimeout(() => setMissing(true), ORIGINAL_TIMEOUT_MS);
    // Reset on the way OUT (compare closed, or the URL arrived), so reopening
    // compare starts a fresh wait instead of failing at once.
    return () => {
      window.clearTimeout(t);
      setMissing(false);
    };
  }, [active, url]);

  // Keyed by URL: a decode or failure that belongs to another photo's original
  // never counts for this one.
  const ready = url !== null && decoded === url;
  const isFailed = url !== null ? failed === url && !ready : missing;
  const pending = active && !ready && !isFailed;
  const showSkeleton = useDelayedFlag(pending);
  return { ready, failed: active && isFailed, pending, showSkeleton };
}
