// The hand-drawn stroke engine, mirrored by hand from `src/drawing.rs`
// (`shape_wobble_seed`, `hair_noise`, `sloppy_polyline_points`,
// `draw_sloppy_ellipse`, `pseudo_rand`, `diamond_vertices`, `star_vertices`).
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

/** Turn the clean vertices of a shape's outline into a sketchy polyline.
 *  Per-edge subdivision pushed sideways by `hairNoise`, plus a gentle bow;
 *  edges end with a small residual offset so corners just miss. `closed`
 *  wraps the last edge back to the first vertex. `sloppiness` is 0-100;
 *  at 0 the vertices pass through untouched. Mirrors
 *  `sloppy_polyline_points` (drawing.rs). */
export function sloppyPolylinePoints(
  pts: Point[],
  seed: number,
  sloppiness: number,
  closed: boolean,
): Point[] {
  if (sloppiness <= 0 || pts.length < 2) return pts;
  const s = sloppiness / 10;
  const amp = Math.min(s * 0.55, 7.0);
  const bow = Math.min(s * 0.04, 2.6);
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
    const bowAmt = bow * len * 0.22 * hairNoise(phase, seed);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const fade = t * (1 - t) * 4;
      const nv = hairNoise(phase * 1.7 + t * 3.1, seed);
      const off = nv * amp * (0.35 + 0.65 * fade) + bowAmt * fade;
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
export function diamondVertices(x0: number, y0: number, x1: number, y1: number): Point[] {
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

/** A five-pointed star filling the drag bbox: 5 outer tips at even indices,
 *  5 inner valleys at odd indices, 36° apart, starting at 12 o'clock. Outer
 *  radii are the bbox half-extents; inner is 0.5×. Mirrors `star_vertices`. */
export function starVertices(x0: number, y0: number, x1: number, y1: number): Point[] {
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
  for (let i = 0; i < 10; i++) {
    const rx = i % 2 === 0 ? orx : irx;
    const ry = i % 2 === 0 ? ory : iry;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    verts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return verts;
}

/** The sketchy ellipse path — the "fin documents" look: a wobbly ellipse
 *  whose ends do NOT quite meet, plus a short lead-in tail. Amplitude, gap
 *  and tail length all scale with `sloppiness` (0-100). Mirrors the point
 *  generation in `draw_sloppy_ellipse` (drawing.rs). */
export function sloppyEllipsePoints(
  from: Point,
  to: Point,
  sloppiness: number,
): Point[] {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const bw = Math.abs(to.x - from.x);
  const bh = Math.abs(to.y - from.y);
  if (bw < 4 || bh < 4) return [];
  const cx = x + bw / 2;
  const cy = y + bh / 2;
  const rx = bw / 2;
  const ry = bh / 2;
  const seed = shapeWobbleSeed(from.x, from.y, to.x, to.y);
  const strength = Math.max(0, Math.min(1, sloppiness / 100));
  const amp = 0.4 + sloppiness * 0.062;
  const startOffset = pseudoRand(seed) * 2 * Math.PI;
  const gap = Math.PI * (0.05 + strength * 0.22);
  const mainArc = 2 * Math.PI - gap;
  const tilt = (pseudoRand(seed + 2) - 0.5) * 0.15;
  const tailLen = Math.PI * (0.12 + 0.12 * strength + pseudoRand(seed + 3) * 0.15);

  const noise = (angle: number): number =>
    Math.sin(angle * 2.3 + seed) * amp +
    Math.sin(angle * 1.1 + seed * 0.7) * amp * 0.7 +
    Math.cos(angle * 3.7 + seed * 1.3) * amp * 0.5;

  const path: Point[] = [];
  // Lead-in tail (fades to a point at its tip).
  const tailSteps = 10;
  for (let i = 0; i <= tailSteps; i++) {
    const t = i / tailSteps;
    const angle = startOffset - tailLen * (1 - t);
    const n = noise(angle) * t;
    const squeeze = 1 + Math.sin(angle * 2 + seed) * 0.03;
    const inward = (1 - t) * (rx * 0.15);
    path.push({
      x: cx + (rx * squeeze - inward + n) * Math.cos(angle + tilt),
      y: cy + (ry / squeeze - inward + n) * Math.sin(angle + tilt),
    });
  }
  // Main arc — stops shy of a full turn so the ends visibly miss each other.
  const numPoints = 60;
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const angle = startOffset + t * mainArc;
    const n = noise(angle);
    const squeeze = 1 + Math.sin(angle * 2 + seed) * 0.03;
    path.push({
      x: cx + (rx * squeeze + n) * Math.cos(angle + tilt),
      y: cy + (ry / squeeze + n) * Math.sin(angle + tilt),
    });
  }
  return path;
}