// Screenshot comparison (Night 10-23): reading the engine's packed diff and
// the few numbers the Compare bar shows. The diff itself is Rust
// (src/image_diff.rs, `compare_photo`); this file never looks at pixels
// except to paint the mask it was handed.

export interface DiffRegion {
  /** Box in DOCUMENT pixels (ready for `mark_regions`). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** How many pixels in it changed. */
  px: number;
}

export interface ScreenshotDiff {
  /** The compared area: the top-left overlap of the two photos. */
  w: number;
  h: number;
  regions: DiffRegion[];
  /** One bit per overlap pixel, row-major, low bit first. */
  mask: Uint32Array;
}

/** Changes closer than this join into one (a label's letters, a moved
 *  button's old and new place). */
export const MERGE_PX = 16;
/** Fewer changed pixels than this is a speck, not a change. */
export const MIN_AREA = 24;
export const DEFAULT_SENSITIVITY = 50;

/** Sensitivity 0..100 (higher finds smaller differences) to the engine's
 *  per-channel tolerance. 50 → 28, which ignores a JPEG re-save at quality
 *  85 and anti-aliasing while a one-pixel text stroke still counts. */
export function toleranceFor(sensitivity: number): number {
  const s = Math.max(0, Math.min(100, sensitivity));
  return Math.round(4 + (100 - s) * 0.48);
}

/** `[w, h, n, (x, y, w, h, px) × n, mask…]` → a {@link ScreenshotDiff}. */
export function unpackDiff(packed: ArrayLike<number>): ScreenshotDiff {
  const w = packed[0] ?? 0;
  const h = packed[1] ?? 0;
  const n = packed[2] ?? 0;
  const regions: DiffRegion[] = [];
  for (let i = 0; i < n; i++) {
    const o = 3 + i * 5;
    regions.push({ x: packed[o], y: packed[o + 1], w: packed[o + 2], h: packed[o + 3], px: packed[o + 4] });
  }
  const start = 3 + n * 5;
  const mask = new Uint32Array(Math.max(0, packed.length - start));
  for (let i = 0; i < mask.length; i++) mask[i] = packed[start + i];
  return { w, h, regions, mask };
}

/** The regions as the flat x, y, w, h quads `mark_regions` takes. */
export function regionQuads(regions: DiffRegion[]): Uint32Array {
  const out = new Uint32Array(regions.length * 4);
  regions.forEach((r, i) => out.set([r.x, r.y, r.w, r.h], i * 4));
  return out;
}

/** What a screen reader hears for one row of the list. */
export function regionLabel(i: number, n: number, r: DiffRegion): string {
  return `Change ${i + 1} of ${n}, ${r.w} by ${r.h} at ${r.x}, ${r.y}`;
}

/** "7 changes", "1 change", "No changes". */
export function changesCount(n: number): string {
  return n === 0 ? "No changes" : n === 1 ? "1 change" : `${n} changes`;
}

/** The line shown when A and B are not the same size, or null when they are. */
export function sizesDifferLine(a: { w: number; h: number }, b: { w: number; h: number }): string | null {
  if (a.w === b.w && a.h === b.h) return null;
  return `Sizes differ: comparing the ${Math.min(a.w, b.w)}×${Math.min(a.h, b.h)} they share`;
}

/** Paint the mask into `img` (same w × h): `rgba` where a pixel changed,
 *  transparent elsewhere. */
export function paintMask(diff: ScreenshotDiff, img: ImageData, rgba: [number, number, number, number]): void {
  const { data } = img;
  data.fill(0);
  const total = diff.w * diff.h;
  for (let word = 0; word < diff.mask.length; word++) {
    let bits = diff.mask[word];
    while (bits) {
      const bit = 31 - Math.clz32(bits & -bits);
      bits &= bits - 1;
      const p = word * 32 + bit;
      if (p >= total) break;
      const o = p * 4;
      data[o] = rgba[0];
      data[o + 1] = rgba[1];
      data[o + 2] = rgba[2];
      data[o + 3] = rgba[3];
    }
  }
}

/** Mark sizes for a photo: stroke and pin grow with the picture so a 4K
 *  screenshot's marks are as readable as a laptop one's. */
export function markStyle(photoW: number, photoH: number) {
  const short = Math.min(photoW, photoH);
  return {
    stroke: Math.max(2, Math.round(short / 300)),
    pad: Math.max(3, Math.round(short / 200)),
    pin: Math.max(22, Math.round(short / 30)),
  };
}

/** Zoom and pan that center change `r` (document px) on a canvas of `docW`
 *  × `docH` px laid out `cssW` × `cssH`, filling about half the view (1× to
 *  8×). The canvas scales about its center, so a point `c` px from the center
 *  lands at `c * zoom + pan`. null when there is nothing to center. */
export function focusOn(
  r: { x: number; y: number; w: number; h: number },
  docW: number,
  docH: number,
  cssW: number,
  cssH: number,
): { zoom: number; pan: { x: number; y: number } } | null {
  if (!docW || !docH || !cssW || !cssH || !r.w || !r.h) return null;
  const zoom = Math.min(8, Math.max(1, 0.5 * Math.min(docW / r.w, docH / r.h)));
  const kx = cssW / docW;
  const ky = cssH / docH;
  return {
    zoom,
    pan: { x: -((r.x + r.w / 2) * kx - cssW / 2) * zoom, y: -((r.y + r.h / 2) * ky - cssH / 2) * zoom },
  };
}
