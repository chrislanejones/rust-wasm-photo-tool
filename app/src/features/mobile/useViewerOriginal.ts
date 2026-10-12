import { useEffect, useState, type CSSProperties } from "react";
import { useDelayedFlag } from "@/hooks/usePhotoSwitching";
import { getOriginalAsBlobUrl } from "@/lib/dexie/originalsAdapter";

/** A full-resolution original that has neither painted nor failed by now is not coming. */
export const VIEWER_ORIGINAL_TIMEOUT_MS = 15_000;

export interface ViewerOriginal {
  /** Decoded and safe to paint. Null until then. */
  src: string | null;
  /** Missing from IndexedDB, undecodable, or past the timeout. */
  failed: boolean;
  /** Nothing to paint and no failure yet. */
  pending: boolean;
  /** `pending` once the 300 ms grace is up. */
  showSkeleton: boolean;
}

interface Settled {
  key: string;
  src: string | null;
  failed: boolean;
}

/**
 * The phone viewer's full-resolution original: read from IndexedDB, decoded
 * off-screen, then handed over, so the `<img>` never paints half a photo.
 *
 * What this replaced, and why each was a bug:
 *
 *   · A spinner from the first frame, so an original that arrives in 50 ms
 *     still flashed one. The grace period now covers that.
 *   · No failure path. A missing original (`getOriginalAsBlobUrl` → null) left
 *     the spinner turning for good.
 *   · The URL state was not keyed to the photo. On a swipe the first render
 *     paired the NEW name with the OLD picture until the effect cleared it.
 *     Here a result counts only for the key it was read for.
 */
export function useViewerOriginal(key: string | null): ViewerOriginal {
  const [settled, setSettled] = useState<Settled | null>(null);

  // Created and revoked in this ONE effect: a split between a memo and an
  // effect is what broke gallery thumbnails under StrictMode once.
  useEffect(() => {
    if (!key) return;
    let live = true;
    let done = false;
    let created: string | null = null;
    const finish = (src: string | null, failed: boolean) => {
      if (!live || done) return;
      done = true;
      window.clearTimeout(timeout);
      setSettled({ key, src, failed });
    };
    const timeout = window.setTimeout(() => finish(null, true), VIEWER_ORIGINAL_TIMEOUT_MS);
    void (async () => {
      try {
        const url = await getOriginalAsBlobUrl(key);
        if (!url) return finish(null, true);
        if (!live) {
          URL.revokeObjectURL(url);
          return;
        }
        created = url;
        const probe = new Image();
        probe.decoding = "async";
        probe.src = url;
        await probe.decode();
        finish(url, false);
      } catch {
        finish(null, true);
      }
    })();
    return () => {
      live = false;
      window.clearTimeout(timeout);
      if (created) URL.revokeObjectURL(created);
    };
  }, [key]);

  const current = key && settled?.key === key ? settled : null;
  const pending = key !== null && current === null;
  const graceOver = useDelayedFlag(pending);
  return {
    src: current?.src ?? null,
    failed: current?.failed ?? false,
    pending,
    showSkeleton: pending && graceOver,
  };
}

/** The box an `<img className="max-h-full max-w-full object-contain">` of
 *  this size settles into: the largest fit inside the stage (`cq*` units, the
 *  stage is a size container) and never larger than the photo itself. Unknown
 *  dimensions get a square. */
export function viewerBox(w: number, h: number): CSSProperties {
  if (!(w > 0 && h > 0)) return { width: "min(100cqw, 100cqh)", aspectRatio: "1 / 1" };
  return {
    width: `min(100cqw, calc(100cqh * ${w / h}), ${w}px)`,
    aspectRatio: `${w} / ${h}`,
  };
}
