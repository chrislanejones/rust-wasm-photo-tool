// What document size makes the PHOTO land on the size the user typed.
//
// The Resize field shows the photo's dimensions (`photo_bounds`), but
// `resize_with_filter` scales the whole DOCUMENT — artboard border included —
// and maps each layer's opaque rect through the same scale. Passing the typed
// size straight through therefore shrank the photo by the border's share:
// 256×256 with a 10 px border (276 document) asked for 128 and got 118.
//
// This inverts the engine's own mapping (src/lib.rs `resize_with_filter`):
//   nx0 = min(round(x · s), nw − 1)
//   nx1 = clamp(round((x + w) · s), nx0 + 1, nw)      s = nw / ow
// and searches the few document sizes around the ideal for one whose mapped
// photo is exactly the typed size. The border scales with the photo; the
// saved file excludes it either way.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The photo's mapped extent on one axis, exactly as the engine computes it. */
export function mappedExtent(offset: number, extent: number, docOld: number, docNew: number): number {
  const s = docNew / docOld;
  const a = Math.min(Math.round(offset * s), docNew - 1);
  const b = Math.min(Math.max(Math.round((offset + extent) * s), a + 1), docNew);
  return b - a;
}

function axis(offset: number, extent: number, docOld: number, want: number): number {
  if (extent <= 0 || docOld <= 0) return want;
  if (offset === 0 && extent === docOld) return want; // no border on this axis
  const ideal = Math.round((docOld * want) / extent);
  let best = Math.max(1, ideal);
  let bestErr = Infinity;
  for (let d = -4; d <= 4; d++) {
    const n = ideal + d;
    if (n < 1) continue;
    const err = Math.abs(mappedExtent(offset, extent, docOld, n) - want);
    if (err < bestErr || (err === bestErr && Math.abs(d) < Math.abs(best - ideal))) {
      best = n;
      bestErr = err;
    }
  }
  return best;
}

/** The document size to pass to `resize_with_filter` so the photo comes out
 *  `want.w × want.h`. With no photo bounds (or no border) it is `want`. */
export function documentSizeForPhoto(
  doc: { w: number; h: number },
  photo: Rect | null | undefined,
  want: { w: number; h: number },
): { w: number; h: number } {
  if (!photo) return want;
  return {
    w: axis(photo.x, photo.width, doc.w, want.w),
    h: axis(photo.y, photo.height, doc.h, want.h),
  };
}

/** Why an Apply did not change the stored file, in one sentence. */
export function keptOriginalMessage(newBytes: number, oldBytes: number): string {
  const kb = (b: number) => `${Math.max(1, Math.round(b / 1024))} KB`;
  return `Not applied: the new file would be ${kb(newBytes)}, bigger than the ${kb(oldBytes)} it is now.`;
}
