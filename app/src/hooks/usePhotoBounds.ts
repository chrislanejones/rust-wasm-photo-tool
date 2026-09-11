import { useEffect, useState } from "react";
import type { MutableRefObject } from "react";
import type { ImageHorseTool } from "stamp_tool";

export interface PhotoBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The PHOTO's bounds inside the document — what "how big is my picture" means
 * (#81).
 *
 * A default import is an artboard: a Canvas fill with the photo centred on it,
 * so the document is `photo + 2 * canvasPadding`. Reading `stamp.state.width`
 * therefore reported a number 20px larger than the file the user opened, and
 * the resize panel then locked its aspect ratio to that document — type 400 and
 * the height came from 820:620 instead of 800:600.
 *
 * The engine decides STRUCTURALLY, not by measuring pixels: a Canvas layer
 * present means the photo is mounted and its own bounds are the answer; no
 * Canvas means the document has been flattened (or the Canvas removed) and the
 * document IS the picture. See `photo_bounds` in `src/layer.rs` — the
 * pixel-based version gets the flatten case wrong, because the default canvas
 * fill is transparent.
 *
 * ⚠️ ONE QUESTION, RE-ASKED — not a cache keyed by id. Same rule as
 * `useLayerIsEmpty`: a derived map that goes stale is what caused the v7.81
 * batch-export data loss.
 *
 * ⚠️ The engine call is AWAITED. Behind the worker (ADR-024) it is a real round
 * trip, and an un-awaited Promise is a perfectly good truthy value that no type
 * check catches.
 *
 * `null` means "not known yet" — callers fall back to the document, which is
 * what they used to show anyway, so nothing flickers.
 */
export function usePhotoBounds(
  stampToolRef: MutableRefObject<ImageHorseTool | null>,
  /** Bump when the document may have changed. Must include the PIXEL counter:
   *  a resize, an undo or a flatten all move these bounds. */
  revision: number,
): PhotoBounds | null {
  const [bounds, setBounds] = useState<PhotoBounds | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tool = stampToolRef.current;
    if (!tool) {
      setBounds(null);
      return;
    }
    void (async () => {
      try {
        const b = await tool.photo_bounds();
        if (cancelled || !b || b.length < 4) return;
        setBounds({ x: b[0]!, y: b[1]!, width: b[2]!, height: b[3]! });
      } catch {
        // An engine that cannot answer leaves the caller on its document
        // fallback rather than showing a wrong number.
        if (!cancelled) setBounds(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stampToolRef, revision]);

  return bounds;
}
