import { useEffect, useState } from "react";
import { useDelayedFlag } from "@/hooks/usePhotoSwitching";

/**
 * How long a decode may take before a tile admits it is waiting.
 *
 * Cached thumbnails come back in single-digit milliseconds, well inside this,
 * so a normal gallery shows no placeholder at all — it is for a big gallery's
 * first open or a large import, not for every tile on every mount. Shared with
 * the photo-import placeholder, which waits on the same kind of decode.
 */
export const THUMB_SKELETON_DELAY_MS = 300;

export interface ThumbImage {
  /** Put on the `<img>`. Empty string means there is nothing to paint yet. */
  src: string;
  /** Render the placeholder: nothing has ever loaded and the grace period is up. */
  showSkeleton: boolean;
  /** The current thumbnail could not be decoded. */
  failed: boolean;
  /**
   * This tile has no picture yet. The gallery sums these for one `aria-busy`,
   * which is why it is separate from `showSkeleton` — a tile inside the grace
   * period is still pending even though it is drawing nothing.
   */
  pending: boolean;
}

export interface ThumbViewInput {
  /** The object URL for the CURRENT blob. "" before the first effect runs. */
  url: string;
  /** The last URL that finished decoding. Only ever moves forward. */
  shownUrl: string | null;
  /** The last URL that failed to decode. */
  failedUrl: string | null;
}

/**
 * The whole decision, as a pure function of three strings — extracted so the
 * truth table can be tested without a renderer, which this repo has no
 * dependency for.
 *
 * ⚠️ `shownUrl` is deliberately NOT compared against `url`. That is the point.
 * A tile mid-edit has `shownUrl` = the previous URL and `url` = the new one,
 * and it must keep painting the previous picture rather than fall back to a
 * placeholder — so "do I have something to paint?" asks only whether
 * `shownUrl` exists. Requiring the two to match is exactly the bug the old
 * develop had: it made a freshly-changed blob indistinguishable from a tile
 * that had never loaded at all.
 */
export function thumbViewState({ url, shownUrl, failedUrl }: ThumbViewInput): {
  src: string;
  failed: boolean;
  pending: boolean;
} {
  // Only the CURRENT url's failure counts. A stale failure from a blob that
  // has since been replaced must not condemn the tile for ever.
  const failed = failedUrl !== null && failedUrl === url;
  return {
    src: shownUrl ?? "",
    failed,
    pending: shownUrl === null && !failed,
  };
}

/**
 * WHICH pixels a thumbnail paints, and whether it has any yet.
 *
 * Replaces `useThumbDevelop`, which started every tile at `grayscale(1)` and
 * needed two independent facts to become true before it came into colour. The
 * two could not be made reliable: the effect that armed the turn also called
 * `setImgReady(false)` after mount, so a blob URL that decoded before the
 * effect ran had its load erased and `onLoad` never fired again — the tile
 * stayed gray for good. There is no gray state here to get stuck in.
 *
 * The invariant that makes the old race impossible rather than unlikely:
 * **`shownUrl` only ever moves forward.** Nothing sets it back to null, so a
 * load that already happened cannot be erased, and a load that belongs to an
 * old URL cannot be counted for a new one.
 */
export function useThumbImage(thumbBlob: Blob | string): ThumbImage {
  const [url, setUrl] = useState("");

  // Created and revoked in ONE effect. Creating in a memo and revoking in an
  // effect revokes a URL the next render is still using, which is its own
  // long-standing bug class in this repo.
  useEffect(() => {
    if (typeof thumbBlob === "string") {
      setUrl(thumbBlob);
      return;
    }
    const next = URL.createObjectURL(thumbBlob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [thumbBlob]);

  // The URL whose pixels are decoded and safe to paint — never reset.
  const [shownUrl, setShownUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    // Decode off-DOM, then swap. Pointing the live `<img>` straight at the new
    // URL blanks the tile until the decode lands, which is the gray step this
    // hook exists to remove; this way the element keeps painting the previous
    // thumbnail right up to the frame the new one is ready.
    //
    // Revoking the previous URL while the element still names it is safe: a
    // revoke only drops the mapping for future fetches, and an image already
    // decoded keeps painting.
    const probe = new Image();
    let live = true;
    probe.decoding = "async";
    let settled = false;
    const finish = (failed: boolean) => {
      if (!live || settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (failed) setFailedUrl(url);
      else setShownUrl(url);
    };
    const timeout = window.setTimeout(() => finish(true), 15_000);
    probe.onload = () => {
      // A load event can precede decode. Keep the previous pixels until the
      // browser can paint the replacement; older engines lack decode().
      if (typeof probe.decode === "function") probe.decode().then(() => finish(false), () => finish(true));
      else finish(false);
    };
    probe.onerror = () => finish(true);
    probe.src = url;
    return () => {
      live = false;
      window.clearTimeout(timeout);
      probe.onload = null;
      probe.onerror = null;
    };
  }, [url]);

  const view = thumbViewState({ url, shownUrl, failedUrl });

  // Armed only while there is nothing to show, and never re-armed for a later
  // edit — the previous thumbnail covers that wait, so an edit must not be
  // able to flash a placeholder over a picture that is already on screen.
  const graceOver = useDelayedFlag(view.pending, THUMB_SKELETON_DELAY_MS);

  return { ...view, showSkeleton: view.pending && graceOver };
}
