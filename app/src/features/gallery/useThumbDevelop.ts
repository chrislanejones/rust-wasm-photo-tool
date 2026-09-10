import { useEffect, useState } from "react";
import { THUMB_DEVELOP_STAGGER_MS } from "@/lib/animations";

/**
 * Tiles that mount together take turns, left to right. Each new tile asks for
 * a start time and gets the later of "now" and "the previous tile's start +
 * STAGGER". A single photo added later starts at once, because the previous
 * start is long past. Module-level on purpose: the strip and the grid both
 * mount their tiles in DOM order, and DOM order IS left-to-right.
 */
let lastDevelopStart = 0;
function scheduleDevelop(): number {
  const start = Math.max(performance.now(), lastDevelopStart + THUMB_DEVELOP_STAGGER_MS);
  lastDevelopStart = start;
  return start;
}

/**
 * WHEN a thumbnail comes into colour. Two facts must both be true: the <img>
 * has decoded (`onImgReady`, also on error so a broken image does not stay
 * grey forever) AND the tile's turn has come. Either alone is wrong — instant
 * pixels would flash, a turn with no pixels would colour a blank tile.
 *
 * What it looks like — the grayscale targets and the fade's duration, which
 * is also the minimum — lives in `thumbDevelop` in lib/animations.ts.
 */
export function useThumbDevelop(thumbBlob: Blob): { colour: boolean; onImgReady: () => void } {
  const [imgReady, setImgReady] = useState(false);
  const [turn, setTurn] = useState(false);

  useEffect(() => {
    setImgReady(false);
    setTurn(false);
    const wait = Math.max(0, scheduleDevelop() - performance.now());
    const t = window.setTimeout(() => setTurn(true), wait);
    return () => window.clearTimeout(t);
  }, [thumbBlob]);

  return { colour: imgReady && turn, onImgReady: () => setImgReady(true) };
}
