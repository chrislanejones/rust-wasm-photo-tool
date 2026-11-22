// Batch › Redact (Night 11-21, 230, ADR-108): boxes drawn once on the open
// photo, applied to the same place on every photo in the batch.
//
// WHERE "THE SAME PLACE" IS
//   A box is stored as a rectangle in the drawn-on photo's ORIGINAL pixels,
//   together with that photo's original size. Two ways to carry it to another
//   photo, chosen per group:
//
//   • relative (the default) — the same fractions of width and height. A
//     1440 × 900 and a 2880 × 1800 screenshot of the same screen are the same
//     picture at two pixel densities, and the email in the nav bar sits at
//     the same fraction of both. This is the common screenshot-set case, and
//     the one where pixels would be wrong by exactly 2×.
//   • anchored — the box keeps its size in pixels and its distance from a
//     corner or edge (the Placement grid's nine cells). For screenshots of
//     windows of different sizes at the SAME density, where a header does not
//     scale: the account number stays 24 px from the top-right however wide
//     the window was.
//
// Original pixels, not the canvas's: the open photo is a working copy of at
// most 2048 px, and an anchored "24 px" must mean the same thing on it as on
// a full-size photo decoded from its stored file.
//
// HOW EACH STYLE IS DONE (reusing the engine, no new op; ADR-108)
//   • Pixelate — a rectangle shape with the mosaic fill (fill kind 3), the
//     same "redaction box" Shapes › Fill › Pixelate draws. Op: ShapeAdd.
//   • Solid    — the same rectangle with a solid fill. Op: ShapeAdd.
//   • Blur     — the Blur brush's own stroke (effect_down/move/up) walked
//     over the box in rows close enough that the dabs overlap everywhere.
//     The engine has no rectangle blur; this is the brush, not a copy of it.
//     Op: Blur. The outermost dabs are centered ON the box edge, so the blur
//     reaches every corner and feathers at most one dab radius past it.
import type { PlacementCell } from "@/components/PlacementGrid";

export type RedactStyle = "pixelate" | "blur" | "solid";
export type RedactPlacement = "relative" | "anchored";

/** A box in the ORIGINAL pixels of the photo it was drawn on. */
export interface RedactBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The drawn-on photo's original size. */
  srcW: number;
  srcH: number;
}

export interface RedactLook {
  boxes: RedactBox[];
  style: RedactStyle;
  /** Pixelate: block size in px. */
  block: number;
  /** Blur: the brush's intensity (its kernel radius, 1..30 in the engine). */
  blur: number;
  /** Solid: a palette color (lib/colors TEXT_COLORS). */
  color: string;
  placement: RedactPlacement;
  anchor: PlacementCell;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MAX_BOXES = 10;

// The floors are what makes it a REDACTION and not a soft-focus: measured by
// lib/batchRedact.test.ts and e2e/batch-redact.spec.ts on 12 px text, where at
// these settings no glyph pixel survives and the box is near-flat.
//   • A mosaic block at least as tall as the text averages a whole line of
//     glyph into each cell; 12 px is the floor, 16 the default.
//   • The Blur brush tops out at intensity 30; below 20 a 12 px word still
//     reads as a word shape, so the slider starts there.
export const BLOCK_MIN = 12;
export const BLOCK_MAX = 64;
export const BLUR_MIN = 20;
export const BLUR_MAX = 30;

export const DEFAULT_REDACT_LOOK: RedactLook = {
  boxes: [],
  style: "pixelate",
  block: 16,
  blur: BLUR_MAX,
  color: "#000000",
  placement: "relative",
  anchor: "top-left",
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The look's strength, held inside its floors whatever was stored. */
export function safeStrength(look: Pick<RedactLook, "block" | "blur">): { block: number; blur: number } {
  return {
    block: Math.round(clamp(look.block, BLOCK_MIN, BLOCK_MAX)),
    blur: Math.round(clamp(look.blur, BLUR_MIN, BLUR_MAX)),
  };
}

function axis(pos: number, size: number, src: number, dst: number, side: "start" | "center" | "end"): number {
  if (side === "start") return pos;
  if (side === "end") return dst - (src - pos - size) - size;
  return (dst - size) / 2 + (pos + size / 2 - src / 2);
}

function sides(anchor: PlacementCell): { h: "start" | "center" | "end"; v: "start" | "center" | "end" } {
  const [vert, horiz] = anchor === "center" ? ["middle", "center"] : anchor.split("-");
  return {
    v: vert === "top" ? "start" : vert === "bottom" ? "end" : "center",
    h: horiz === "left" ? "start" : horiz === "right" ? "end" : "center",
  };
}

/**
 * Where `box` lands on a photo of `w` × `h` ORIGINAL pixels, clipped to it.
 * Null when nothing of it is left on that photo (an anchored box past the
 * edge of a smaller one).
 */
export function boxOnPhoto(
  box: RedactBox,
  look: Pick<RedactLook, "placement" | "anchor">,
  w: number,
  h: number,
): Rect | null {
  let r: Rect;
  if (look.placement === "relative") {
    r = {
      x: (box.x / box.srcW) * w,
      y: (box.y / box.srcH) * h,
      w: (box.w / box.srcW) * w,
      h: (box.h / box.srcH) * h,
    };
  } else {
    const s = sides(look.anchor);
    r = { x: axis(box.x, box.w, box.srcW, w, s.h), y: axis(box.y, box.h, box.srcH, h, s.v), w: box.w, h: box.h };
  }
  const x0 = clamp(r.x, 0, w);
  const y0 = clamp(r.y, 0, h);
  const x1 = clamp(r.x + r.w, 0, w);
  const y1 = clamp(r.y + r.h, 0, h);
  if (x1 - x0 < 1 || y1 - y0 < 1) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Scale a rect by `k` (original px → working-copy px, or back). */
export function scaleRect(r: Rect, k: number): Rect {
  return { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k };
}

/** The blur dab radius for a box: small enough that the feather past the edge
 *  stays a few pixels, big enough that a large box is not thousands of rows. */
function blurRadius(r: Rect): number {
  return clamp(Math.round(Math.min(r.w, r.h) / 4), 4, 12);
}

/**
 * The Blur brush's path over a box: rows from the top edge to the bottom edge,
 * 0.9 × radius apart (a row of dabs every half radius covers a band 0.97 × r
 * either side, so rows that close leave no gap), walked as a serpentine so
 * the brush's own interpolation between points only ever runs inside the box.
 */
export function blurPath(r: Rect): { radius: number; points: Array<[number, number]> } {
  const radius = blurRadius(r);
  const step = radius * 0.9;
  const rows = Math.max(1, Math.ceil(r.h / step));
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= rows; i++) {
    const y = r.y + (r.h * i) / rows;
    const ltr = i % 2 === 0;
    points.push([ltr ? r.x : r.x + r.w, y], [ltr ? r.x + r.w : r.x, y]);
  }
  return { radius, points };
}

/** "Pixelate 3 boxes", for the apply button. */
export function lookLabel(look: RedactLook): string {
  const n = look.boxes.length;
  const style = look.style === "pixelate" ? "Pixelate" : look.style === "blur" ? "Blur" : "Solid";
  return `${style} ${n} box${n === 1 ? "" : "es"}`;
}
