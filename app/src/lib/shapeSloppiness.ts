// The hand-drawn stroke engine, mirrored by hand from `src/drawing.rs`
// (`shape_wobble_seed`, `hair_noise`, `sloppy_polyline_points`,
// `draw_sloppy_circle`, `pseudo_rand`, `diamond_vertices`, `star_vertices`).
//
// EVERY function here exists so the canvas rubber-band preview and the SVG
// edit overlay draw EXACTLY the path Rust commits to pixels — deterministic,
// seeded from the drag endpoints, because the two layers must agree
// pixel-for-pixel and WASM has no Math.random. If this module changes, change
// the Rust twin too (or the preview and the committed shape drift apart).

export type Point = { x: number; y: number };

/** Deterministic seed — derived from the drag endpoints so the same shape
 *  always redraws identically. Mirrors `shape_wobble_seed` (drawing.rs). */
export function shapeWobbleSeed(x0: number, y0: number, x1: number, y1: number): number {
  return x0 * 31.17 + y0 * 47.53 + x1 * 13.91 + y1 * 67.37;
}

/** Smooth pseudo-random "hair" noise in ≈[-1, 1] — a sum of sines with
 *  incommensurate frequencies. Mirrors `hair_noise` (drawing.rs). */
function hairNoise(p: number, seed: number): number {
  return (
    Math.sin(p * 2.3 + seed) * 0.5 +
    Math.sin(p * 1.1 + seed * 0.7) * 0.3 +
    Math.cos(p * 3.7 + seed * 1.3) * 0.2
  );
}

/** Simple pseudo-random number in [0, 1) from a seed — the f64-bits hash Rust
 *  uses (`pseudo_rand`, drawing.rs), so the preview shares its noise. */
function pseudoRand(seed: number): number {
  const buf = new Float64Array(1);
  const bits = new BigUint64Array(buf.buffer);
  buf[0] = seed * 1000 + 0.5;
  let mixed = (bits[0] * 6364136223846793005n) & 0xffffffffffffffffn;
  mixed = (mixed + 1442695040888963407n) & 0xffffffffffffffffn;
  return Number(mixed >> 33n) / 2147483648;
}

/* --- the sloppiness curve ------------------------------------------------ */
/* Mirrors the constant block in drawing.rs. Every feature scales from EXACTLY
 * zero, so sloppiness 1 draws the firm shape and `sloppiness > 0` is an
 * optimization rather than a change of behavior. */

/** Full-strength wobble as a fraction of the shape's bbox diagonal. */
const WOBBLE_FRAC = 0.02;
/** Floor on the wobble, in stroke widths — a wobble narrower than the pen
 *  cannot be seen. */
const WOBBLE_MIN_STROKES = 1.1;
/** Ceiling on the wobble, as a fraction of the diagonal. */
const WOBBLE_MAX_FRAC = 0.075;
/** Per-edge bow at full strength, as a fraction of the edge's length. */
const BOW_FRAC = 0.05;
/** How far past its corner an edge may run, in wobble-amplitudes. */
const CORNER_RUN = 3.0;
/** …but never more than this fraction of the edge. */
const CORNER_RUN_MAX = 0.12;
/** Share of the wobble that survives at a vertex. */
const CORNER_HOLD = 0.35;

/** The 0-100 slider as a 0-1 sketch strength, eased so the middle of the
 *  travel is a visibly intermediate amount of hand-drawn-ness: 25 -> 0.35,
 *  50 -> 0.59, 100 -> 1.
 *
 *  The ease is `s ** 0.75`, written as `sqrt(s) * sqrt(sqrt(s))` on purpose:
 *  IEEE-754 requires `sqrt` to be correctly rounded, so this and Rust's
 *  `f64::sqrt` agree bit-for-bit. `Math.pow` and `f64::powf` carry no such
 *  guarantee and would let the preview drift from the committed pixels.
 *  Mirrors `sketch_strength` (drawing.rs). */
function sketchStrength(sloppiness: number): number {
  const s = Math.min(Math.max(sloppiness / 100, 0), 1);
  const r = Math.sqrt(s);
  return r * Math.sqrt(r);
}

/** How far, in image pixels, a full-strength wobble moves the pen. Relative
 *  to the SHAPE, not an absolute pixel count — the engine draws in image
 *  pixels while the user sees the image scaled to fit, so a fixed count looks
 *  firm on a big photo and frantic on a thumbnail. Mirrors `wobble_amp`. */
function wobbleAmp(diag: number, strokeWidth: number, strength: number): number {
  const base = Math.max(diag * WOBBLE_FRAC, strokeWidth * WOBBLE_MIN_STROKES);
  return Math.min(base, diag * WOBBLE_MAX_FRAC) * strength;
}

/** Bounding-box diagonal of a point list. Mirrors `points_diag`. */
function pointsDiag(pts: Point[]): number {
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const p of pts) {
    minx = Math.min(minx, p.x);
    maxx = Math.max(maxx, p.x);
    miny = Math.min(miny, p.y);
    maxy = Math.max(maxy, p.y);
  }
  const dx = maxx - minx;
  const dy = maxy - miny;
  return Math.max(Math.sqrt(dx * dx + dy * dy), 1e-6);
}

/** Turn the clean vertices of a shape's outline into a sketchy polyline.
 *  Per-edge subdivision pushed sideways by `hairNoise`, plus a gentle bow,
 *  plus a signed overrun so the pen slides past some corners and stops short
 *  of others. `closed` wraps the last edge back to the first vertex.
 *  `sloppiness` is 0-100; every term is multiplied by the strength, so at 0
 *  the vertices pass through untouched. `strokeWidth` is in IMAGE pixels
 *  (the same units as `pts`). Mirrors `sloppy_polyline_points` (drawing.rs). */
export function sloppyPolylinePoints(
  pts: Point[],
  seed: number,
  sloppiness: number,
  strokeWidth: number,
  closed: boolean,
): Point[] {
  const strength = sketchStrength(sloppiness);
  if (strength <= 0 || pts.length < 2) return pts;
  const amp = wobbleAmp(pointsDiag(pts), strokeWidth, strength);
  const bow = BOW_FRAC * strength;
  const n = closed ? pts.length : pts.length - 1;
  const out: Point[] = [];
  let phase = seed * 0.31;
  for (let e = 0; e < n; e++) {
    const ax = pts[e].x;
    const ay = pts[e].y;
    const bx = pts[(e + 1) % pts.length].x;
    const by = pts[(e + 1) % pts.length].y;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.max(Math.sqrt(dx * dx + dy * dy), 1e-6);
    const steps = Math.max(6, Math.min(24, Math.ceil(len / 6)));
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;
    const bowAmt = bow * len * hairNoise(phase, seed);
    const run = (amp * CORNER_RUN) / len;
    const clampRun = (v: number) => Math.min(Math.max(v, -CORNER_RUN_MAX), CORNER_RUN_MAX);
    const t0 = -clampRun(run * hairNoise(phase + 0.7, seed));
    const t1 = 1 + clampRun(run * hairNoise(phase + 2.9, seed));
    for (let i = 0; i <= steps; i++) {
      const t = t0 + (t1 - t0) * (i / steps);
      const fade = Math.max(t * (1 - t) * 4, 0);
      const nv = hairNoise(phase * 1.7 + t * 3.1, seed);
      const off = nv * amp * (CORNER_HOLD + (1 - CORNER_HOLD) * fade) + bowAmt * fade;
      out.push({ x: ax + dx * t + px * off, y: ay + dy * t + py * off });
    }
    phase += 1.3;
  }
  if (out.length === 0) out.push(pts[0]);
  return out;
}

/** A shapes's closed diamond outline, filling the drag bbox. The exact
 *  vertex list Rust rasterises (`diamond_vertices`), NOT the commit-time
 *  rendering — width/thickness only affects the stroke itself. */
function diamondVertices(x0: number, y0: number, x1: number, y1: number): Point[] {
  const minx = Math.min(x0, x1);
  const maxx = Math.max(x0, x1);
  const miny = Math.min(y0, y1);
  const maxy = Math.max(y0, y1);
  const cx = (minx + maxx) * 0.5;
  const cy = (miny + maxy) * 0.5;
  return [
    { x: cx, y: miny },
    { x: maxx, y: cy },
    { x: cx, y: maxy },
    { x: minx, y: cy },
  ];
}

/** The Star's point count the engine actually draws: 0 (every shape saved
 *  before the count existed) means the classic 5, anything else clamps to
 *  3–12. Mirrors the engine's reading of `star_points`. */
export function effectiveStarPoints(n: number | undefined): number {
  if (!n) return 5;
  return Math.min(12, Math.max(3, Math.round(n)));
}

/** An n-pointed star filling the drag bbox: n outer tips at even indices, n
 *  inner valleys at odd indices, 180/n° apart, starting at 12 o'clock. Outer
 *  radii are the bbox half-extents; inner is 0.5×. Mirrors `star_vertices_n`
 *  (n = 5 is the classic star and `star_vertices`). */
export function starVertices(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  points = 5,
): Point[] {
  const n = effectiveStarPoints(points);
  const minx = Math.min(x0, x1);
  const maxx = Math.max(x0, x1);
  const miny = Math.min(y0, y1);
  const maxy = Math.max(y0, y1);
  const cx = (minx + maxx) * 0.5;
  const cy = (miny + maxy) * 0.5;
  const orx = (maxx - minx) * 0.5;
  const ory = (maxy - miny) * 0.5;
  const irx = orx * 0.5;
  const iry = ory * 0.5;
  const verts: Point[] = [];
  for (let i = 0; i < 2 * n; i++) {
    const rx = i % 2 === 0 ? orx : irx;
    const ry = i % 2 === 0 ? ory : iry;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    verts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return verts;
}

/** An isosceles triangle filling the drag bbox, apex up: (cx, top),
 *  (right, bottom), (left, bottom). Mirrors `triangle_vertices`. */
export function triangleVertices(x0: number, y0: number, x1: number, y1: number): Point[] {
  const minx = Math.min(x0, x1);
  const maxx = Math.max(x0, x1);
  const miny = Math.min(y0, y1);
  const maxy = Math.max(y0, y1);
  return [
    { x: (minx + maxx) * 0.5, y: miny },
    { x: maxx, y: maxy },
    { x: minx, y: maxy },
  ];
}

/** The CLOSED outline the engine strokes for a polygon shape — rect, diamond,
 *  star, triangle — or `null` for the two that are not polygons (circle,
 *  line). One switch for both previews (the canvas rubber band and the SVG
 *  edit overlay), so a new shape is one case here rather than one in each. */
export function closedOutline(
  shape: string,
  from: Point,
  to: Point,
  starPoints?: number,
): Point[] | null {
  switch (shape) {
    case "rect": {
      const x = Math.min(from.x, to.x);
      const y = Math.min(from.y, to.y);
      const x1 = Math.max(from.x, to.x);
      const y1 = Math.max(from.y, to.y);
      return [
        { x, y },
        { x: x1, y },
        { x: x1, y: y1 },
        { x, y: y1 },
      ];
    }
    case "diamond":
      return diamondVertices(from.x, from.y, to.x, to.y);
    case "star":
      return starVertices(from.x, from.y, to.x, to.y, starPoints);
    case "triangle":
      return triangleVertices(from.x, from.y, to.x, to.y);
    default:
      return null;
  }
}

/** Widest the ends may miss each other by, at full strength. */
const CIRCLE_GAP = 0.3;
/** Lead-in tail at full strength: a fixed part plus a seeded part, in turns. */
const CIRCLE_TAIL = 0.18;
const CIRCLE_TAIL_RAND = 0.24;
/** How far the whole circle may lean at full strength, in radians. */
const CIRCLE_TILT = 0.22;
/** How far out of round the circle may go at full strength. */
const CIRCLE_SQUEEZE = 0.05;

/** The sketchy circle path — the "fin documents" look: a wobbly ring whose
 *  ends do NOT quite meet, plus a short lead-in tail. Amplitude, gap, tail,
 *  tilt and squeeze all scale from zero with `sloppiness` (0-100), so at the
 *  bottom of the range this converges on the clean circle.
 *
 *  Note the RADIUS: half the SHORTER bbox side, the same circle the firm
 *  branch, the interior fill and `draw_shape` all use. This used to draw the
 *  bbox ellipse, so a non-square drag changed shape the instant the slider
 *  left 0 and the fill no longer sat under the outline.
 *
 *  Mirrors `draw_sloppy_circle` (drawing.rs). */
export function sloppyCirclePoints(
  from: Point,
  to: Point,
  sloppiness: number,
  strokeWidth: number,
): Point[] {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const bw = Math.abs(to.x - from.x);
  const bh = Math.abs(to.y - from.y);
  const cx = x + bw / 2;
  const cy = y + bh / 2;
  const r = Math.min(bw, bh) / 2;
  if (r < 2) return [];
  const seed = shapeWobbleSeed(from.x, from.y, to.x, to.y);
  const strength = sketchStrength(sloppiness);
  const diag = Math.max(Math.sqrt(bw * bw + bh * bh), 1e-6);
  const amp = wobbleAmp(diag, strokeWidth, strength);
  const startOffset = pseudoRand(seed) * 2 * Math.PI;
  const gap = Math.PI * CIRCLE_GAP * strength;
  const mainArc = 2 * Math.PI - gap;
  const tilt = (pseudoRand(seed + 2) - 0.5) * CIRCLE_TILT * strength;
  const tailLen =
    Math.PI * (CIRCLE_TAIL + pseudoRand(seed + 3) * CIRCLE_TAIL_RAND) * strength;
  const squeezeAmt = CIRCLE_SQUEEZE * strength;

  // hairNoise is the same three frequencies the old inline closure used,
  // normalised to a peak of 1 so `amp` means what it says.
  const noise = (angle: number): number => hairNoise(angle, seed) * amp;

  // Segment count tracks the radius the way the firm branch does; a fixed 60
  // showed its corners on a big circle.
  const numPoints = Math.max(60, Math.min(480, Math.ceil(r * 4)));
  const path: Point[] = [];
  // Lead-in tail (fades to a point at its tip).
  const tailSteps = 10;
  for (let i = 0; i <= tailSteps; i++) {
    const t = i / tailSteps;
    const angle = startOffset - tailLen * (1 - t);
    const n = noise(angle) * t;
    const squeeze = 1 + Math.sin(angle * 2 + seed) * squeezeAmt;
    const inward = (1 - t) * (r * 0.15) * strength;
    path.push({
      x: cx + (r * squeeze - inward + n) * Math.cos(angle + tilt),
      y: cy + (r / squeeze - inward + n) * Math.sin(angle + tilt),
    });
  }
  // Main arc — stops shy of a full turn so the ends visibly miss each other.
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const angle = startOffset + t * mainArc;
    const n = noise(angle);
    const squeeze = 1 + Math.sin(angle * 2 + seed) * squeezeAmt;
    path.push({
      x: cx + (r * squeeze + n) * Math.cos(angle + tilt),
      y: cy + (r / squeeze + n) * Math.sin(angle + tilt),
    });
  }
  return path;
}