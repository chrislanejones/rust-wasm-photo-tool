// Batch › Crop — the geometry behind "crop every photo the same", for
// carousels: one aspect ratio, one anchor, and (optionally) one output width,
// so every slide comes out the same shape AND the same pixel size.
//
// Pure functions only — no engine, no DOM — so the math is pinned by
// batchCrop.test.ts without a wasm build.
import type { PlacementCell } from "@/components/PlacementGrid";

export type BatchCropRatioId = "1:1" | "4:5" | "3:4" | "4:3" | "3:2" | "16:9" | "9:16";

/** Carousel-first order: square and 4:5 portrait are what the feeds use. */
export const BATCH_CROP_RATIOS: readonly {
  id: BatchCropRatioId;
  label: string;
  dims: [number, number];
}[] = [
  { id: "1:1", label: "1:1", dims: [1, 1] },
  { id: "4:5", label: "4:5", dims: [4, 5] },
  { id: "3:4", label: "3:4", dims: [3, 4] },
  { id: "4:3", label: "4:3", dims: [4, 3] },
  { id: "3:2", label: "3:2", dims: [3, 2] },
  { id: "16:9", label: "16:9", dims: [16, 9] },
  { id: "9:16", label: "9:16", dims: [9, 16] },
];

/** `null` = keep each crop at its own resolution (shapes match, sizes may not). */
export type BatchCropWidth = number | null;

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The largest `rw:rh` rectangle that fits in `w × h`, pushed toward `anchor`
 * (the part of the photo to KEEP): "top-center" keeps the top of a tall photo,
 * "center" trims evenly. Never larger than the image, never smaller than 1px.
 */
export function anchoredCropRect(
  w: number,
  h: number,
  rw: number,
  rh: number,
  anchor: PlacementCell,
): CropRect {
  let cw = w;
  let ch = Math.round((w * rh) / rw);
  if (ch > h) {
    ch = h;
    cw = Math.round((h * rw) / rh);
  }
  cw = Math.max(1, Math.min(w, cw));
  ch = Math.max(1, Math.min(h, ch));

  const [row, col] = anchor === "center" ? ["middle", "center"] : anchor.split("-");
  const spareX = w - cw;
  const spareY = h - ch;
  const x = col === "left" ? 0 : col === "right" ? spareX : Math.round(spareX / 2);
  const y = row === "top" ? 0 : row === "bottom" ? spareY : Math.round(spareY / 2);
  return { x, y, width: cw, height: ch };
}

/**
 * Final pixel size of a crop. With a target width every photo lands on the
 * SAME size — the height comes from the ratio, not from the crop, so rounding
 * differences between photos can't leave one slide a pixel off. Without one,
 * the crop keeps its own size.
 */
export function batchCropOutputSize(
  crop: { width: number; height: number },
  ratio: [number, number],
  targetWidth: BatchCropWidth,
): { width: number; height: number } {
  if (targetWidth === null) return { width: crop.width, height: crop.height };
  const width = Math.max(1, Math.round(targetWidth));
  const height = Math.max(1, Math.round((width * ratio[1]) / ratio[0]));
  return { width, height };
}

/** Copy `rect` out of an RGBA buffer that is `srcW` pixels wide. */
export function cropRgba(
  pixels: Uint8Array | Uint8ClampedArray,
  srcW: number,
  rect: CropRect,
): Uint8Array {
  const out = new Uint8Array(rect.width * rect.height * 4);
  const rowBytes = rect.width * 4;
  for (let row = 0; row < rect.height; row++) {
    const start = ((rect.y + row) * srcW + rect.x) * 4;
    out.set(pixels.subarray(start, start + rowBytes), row * rowBytes);
  }
  return out;
}

/**
 * A hand-set framing from the preview: the crop's CENTER as a fraction of the
 * photo, and its size as a fraction of the largest crop that fits (`scale` 1 =
 * as big as the ratio allows). Fractions, not pixels, because the same framing
 * is replayed on two different resolutions — the live photo in the preview and
 * the ≤2048px working copy the non-active pass decodes — and because it
 * survives a ratio change: switch 1:1 → 4:5 and the frame stays where you put
 * it, just reshaped.
 */
export interface CropFraming {
  cx: number;
  cy: number;
  scale: number;
}

/** Smallest frame the preview lets you drag down to, as a `scale`. */
const MIN_FRAMING_SCALE = 0.1;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The pixel crop a framing means on a `w × h` photo at `rw:rh`. */
export function framedCropRect(
  w: number,
  h: number,
  rw: number,
  rh: number,
  f: CropFraming,
): CropRect {
  const base = anchoredCropRect(w, h, rw, rh, "center");
  const s = clamp(f.scale, MIN_FRAMING_SCALE, 1);
  // Width from the scale, height from the RATIO — so rounding can't bend the
  // shape — then shrink both if the height rounded past the photo.
  let cw = Math.max(1, Math.round(base.width * s));
  let ch = Math.max(1, Math.round((cw * rh) / rw));
  if (ch > h) {
    ch = h;
    cw = Math.max(1, Math.min(w, Math.round((h * rw) / rh)));
  }
  const x = clamp(Math.round(f.cx * w - cw / 2), 0, w - cw);
  const y = clamp(Math.round(f.cy * h - ch / 2), 0, h - ch);
  return { x, y, width: cw, height: ch };
}

/** The framing that reproduces `rect` — what a drag writes back. */
export function framingFromRect(
  w: number,
  h: number,
  rw: number,
  rh: number,
  rect: CropRect,
): CropFraming {
  const base = anchoredCropRect(w, h, rw, rh, "center");
  return {
    cx: (rect.x + rect.width / 2) / w,
    cy: (rect.y + rect.height / 2) / h,
    scale: clamp(rect.width / base.width, MIN_FRAMING_SCALE, 1),
  };
}

/** Slide `rect` by (dx, dy) photo px, stopping at the photo's edges. */
export function moveCropRect(
  w: number,
  h: number,
  rect: CropRect,
  dx: number,
  dy: number,
): CropRect {
  return {
    ...rect,
    x: Math.round(clamp(rect.x + dx, 0, w - rect.width)),
    y: Math.round(clamp(rect.y + dy, 0, h - rect.height)),
  };
}

export type CropCorner = "nw" | "ne" | "sw" | "se";

/**
 * Resize `rect` by dragging one CORNER to (px, py) photo px, the opposite
 * corner pinned and the ratio locked. The frame follows whichever axis the
 * pointer pulled further, and stops at the photo's edge on either axis.
 */
export function resizeCropRectFromCorner(
  w: number,
  h: number,
  rw: number,
  rh: number,
  rect: CropRect,
  corner: CropCorner,
  px: number,
  py: number,
): CropRect {
  const west = corner === "nw" || corner === "sw";
  const north = corner === "nw" || corner === "ne";
  // The pinned corner.
  const ox = west ? rect.x + rect.width : rect.x;
  const oy = north ? rect.y + rect.height : rect.y;
  // Room from the pinned corner to the photo edge the drag is heading for.
  const roomX = west ? ox : w - ox;
  const roomY = north ? oy : h - oy;
  const maxW = Math.min(roomX, (roomY * rw) / rh);
  const minW = anchoredCropRect(w, h, rw, rh, "center").width * MIN_FRAMING_SCALE;
  const wanted = Math.max(Math.abs(px - ox), (Math.abs(py - oy) * rw) / rh);
  const cw = Math.max(1, Math.round(clamp(wanted, Math.min(minW, maxW), maxW)));
  const ch = Math.max(1, Math.round((cw * rh) / rw));
  return {
    x: west ? ox - cw : ox,
    y: north ? oy - ch : oy,
    width: cw,
    height: ch,
  };
}

/** Smallest side a Shift (free-ratio) drag can make, in photo px. */
const MIN_FREE_SIDE = 8;

/**
 * Shift-drag: resize `rect` by moving one CORNER to (px, py) with the ratio
 * UNLOCKED — the opposite corner pinned, the moving one clamped to the photo.
 * The shape this leaves becomes the batch's custom ratio (see
 * `useBatchCropStore.customRatio`), so every photo is still cropped the same.
 */
export function freeCropRectFromCorner(
  w: number,
  h: number,
  rect: CropRect,
  corner: CropCorner,
  px: number,
  py: number,
): CropRect {
  const west = corner === "nw" || corner === "sw";
  const north = corner === "nw" || corner === "ne";
  const ox = west ? rect.x + rect.width : rect.x;
  const oy = north ? rect.y + rect.height : rect.y;
  const side = (o: number, p: number, max: number, back: boolean) => {
    const min = Math.min(MIN_FREE_SIDE, back ? o : max - o);
    return Math.round(clamp(back ? o - p : p - o, min, back ? o : max - o));
  };
  const cw = Math.max(1, side(ox, px, w, west));
  const ch = Math.max(1, side(oy, py, h, north));
  return {
    x: west ? ox - cw : ox,
    y: north ? oy - ch : oy,
    width: cw,
    height: ch,
  };
}

/** The corner a fresh drag from (x0, y0) toward (x1, y1) is pulling. */
export function cornerToward(x0: number, y0: number, x1: number, y1: number): CropCorner {
  return y1 < y0 ? (x1 < x0 ? "nw" : "ne") : x1 < x0 ? "sw" : "se";
}

/** A ratio for display: presets by name, a custom one as "1.28:1". */
export function ratioLabel(dims: [number, number]): string {
  const preset = BATCH_CROP_RATIOS.find(
    (r) => r.dims[0] * dims[1] === r.dims[1] * dims[0],
  );
  if (preset) return preset.label;
  const r = dims[0] / dims[1];
  return r >= 1 ? `${r.toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`;
}
