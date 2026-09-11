import { useEffect, useState } from "react";
import { THUMB_DEVELOP_LEAD, THUMB_DEVELOP_STAGGER_MS, thumbDevelop } from "@/lib/animations";

/**
 * Tiles take turns, left to right. Each asks for a start time and gets the
 * later of "a beat from now" and "the previous tile's start + STAGGER", so a
 * gallery-full develops in succession and a lone upload still waits the lead —
 * the panel is on screen before its pictures start.
 *
 * Module-level on purpose: the strip and the grid both mount their tiles in
 * DOM order, and DOM order IS left-to-right.
 */
let lastDevelopStart = 0;
function scheduleDevelop(): number {
  const start = Math.max(performance.now() + THUMB_DEVELOP_LEAD, lastDevelopStart + THUMB_DEVELOP_STAGGER_MS);
  lastDevelopStart = start;
  return start;
}

/**
 * ⚠️ ONCE PER PHOTO, PER SESSION — not once per mount.
 *
 * The gallery panel unmounts and remounts constantly: the dock swaps it per
 * tab, the drawer closes, the layout flips at a breakpoint. Keying the effect
 * to mount would replay the whole develop every one of those, which is noise.
 * Keying it to the photo id means a picture develops when it first appears —
 * on page load, or when you add it — and afterwards is simply there.
 *
 * Written from an EFFECT, never during render, so StrictMode's double render
 * cannot mark a photo as already seen before it has had its turn.
 */
const developed = new Set<string>();

export interface ThumbDevelop {
  /** Feed to `initial`. */
  initial: typeof thumbDevelop.mono;
  /** Feed to `animate`. */
  animate: typeof thumbDevelop.mono;
  /** Hand to the <img>'s onLoad AND onError, so a broken image cannot stay grey. */
  onImgReady: () => void;
}

/**
 * WHEN a thumbnail comes into colour. Two facts must both be true: the <img>
 * has decoded AND this tile's turn has come. Either alone is wrong — instant
 * pixels would flash past the hold, and a turn with no pixels would colour a
 * blank tile.
 *
 * What it looks like — the hold, the fade, the lead — lives in `thumbDevelop`
 * in lib/animations.ts. Nothing here is tuned.
 */
export function useThumbDevelop(photoId: string, thumbBlob: Blob): ThumbDevelop {
  // Decided once, at mount: a photo does not become "already seen" mid-develop.
  const [develops] = useState(() => !developed.has(photoId));
  const [imgReady, setImgReady] = useState(false);
  const [turn, setTurn] = useState(false);

  useEffect(() => {
    if (!develops) return;
    developed.add(photoId);
    setImgReady(false);
    setTurn(false);
    const wait = Math.max(0, scheduleDevelop() - performance.now());
    const t = window.setTimeout(() => setTurn(true), wait);
    return () => window.clearTimeout(t);
  }, [photoId, thumbBlob, develops]);

  const colour = !develops || (imgReady && turn);
  return {
    initial: develops ? thumbDevelop.mono : thumbDevelop.colour,
    animate: colour ? thumbDevelop.colour : thumbDevelop.mono,
    onImgReady: () => setImgReady(true),
  };
}
