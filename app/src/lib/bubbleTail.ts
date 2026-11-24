// The speech-bubble tail's geometry for the open textarea's preview — the
// Rust path's (`build_annotation_tile`, src/layer.rs), so the preview is what
// gets committed: TAIL_LEN 46, TAIL_HALF 16, sunk `overlap` into the body.
// Shared by CanvasArea's fill preview and the box border (TextBorderPreview).

/** The bubble tail as three points in the preview wrapper's coordinates, the
 *  Rust path's geometry: project a ray from the rect center at `angleDeg` onto
 *  the rect's bounding edge; the base runs ALONG that edge (so both corners
 *  stay flush), clamped off the rounded corners and sunk into the body; the
 *  apex sits `tailLen` past the edge. */
export function bubbleTailPoints(o: {
  /** The rect, in wrapper px. */
  x0: number; y0: number; x1: number; y1: number;
  angleDeg: number;
  radius: number;
  tailLen: number;
  tailHalf: number;
  overlap: number;
}): [number, number][] {
  const { x0, y0, x1, y1, radius, tailLen, tailHalf, overlap } = o;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const hw = (x1 - x0) / 2;
  const hh = (y1 - y0) / 2;
  const theta = (o.angleDeg * Math.PI) / 180;
  const dx = Math.cos(theta);
  const dy = Math.sin(theta);
  const tx = Math.abs(dx) > 1e-6 ? hw / Math.abs(dx) : Infinity;
  const ty = Math.abs(dy) > 1e-6 ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  const ex = cx + dx * t;
  const ey = cy + dy * t;
  const radEff = Math.min(radius, Math.min(hw, hh));
  if (tx <= ty) {
    const lo = y0 + radEff + tailHalf;
    const hi = y1 - radEff - tailHalf;
    const yc = lo <= hi ? Math.max(lo, Math.min(hi, ey)) : cy;
    const bx = ex + (dx >= 0 ? -overlap : overlap);
    return [[bx, yc - tailHalf], [bx, yc + tailHalf], [ex + dx * tailLen, yc + dy * tailLen]];
  }
  const lo = x0 + radEff + tailHalf;
  const hi = x1 - radEff - tailHalf;
  const xc = lo <= hi ? Math.max(lo, Math.min(hi, ex)) : cx;
  const by = ey + (dy >= 0 ? -overlap : overlap);
  return [[xc - tailHalf, by], [xc + tailHalf, by], [xc + dx * tailLen, ey + dy * tailLen]];
}

/** Three points as an SVG `points` attribute. */
export function svgPoints(pts: readonly (readonly [number, number])[]): string {
  return pts.map(([x, y]) => `${x},${y}`).join(" ");
}
