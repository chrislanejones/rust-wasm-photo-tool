// ===== FILE: app/src/lib/perspective.ts =====
// Pure geometry for the Perspective tool: the corner quad, the three drag
// rules that distinguish Distort / Perspective / Skew, and the forward
// homography the overlay uses to draw its own preview grid.
//
// WHY THE DRAG RULES ARE HERE AND NOT IN RUST, when "the engine owns pixels"
// is a project invariant. They are not pixels. A drag rule maps one pointer
// position to four corner positions — no image data is read or written — and
// it has to run on every `pointermove`. Since ADR-024 the engine lives in a
// worker, so putting this behind the port would put a `postMessage` round trip
// in the middle of a 120-420 Hz gesture: exactly the banked-lag failure the
// brush arc spent five releases removing. The RESAMPLING is in Rust
// (`src/perspective.rs`), which is where the pixels actually are.
//
// The winding is fixed and shared with the crate: index 0 = top-left, 1 =
// top-right, 2 = bottom-right, 3 = bottom-left, clockwise in screen coords
// (y-down). `src/perspective.rs`'s `Quad` states the same convention; if these
// two ever disagree the warp comes out mirrored.

/** A corner of the quad, in whatever space the caller is working in. */
export interface Pt {
  x: number;
  y: number;
}

/** Four corners: TL, TR, BR, BL. */
export type Quad = [Pt, Pt, Pt, Pt];

/** Corner indices, named — `q[BR]` beats `q[2]` at every call site. */
export const TL = 0;
export const TR = 1;
export const BR = 2;
export const BL = 3;

/** The three drag rules. This is the axis the SubtoolRow switches between —
 *  one quad, three rules about what happens to the OTHER corners when you drag
 *  one of them. */
export type PerspectiveMode = "distort" | "perspective" | "skew";

/** The identity quad in normalised (0..1) space — matches the crate's
 *  `IDENTITY_QUAD` exactly, and means "no perspective applied". */
export const IDENTITY_QUAD: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

/** Flat `[x0,y0,…,x3,y3]` — the form that crosses the wasm boundary, the op
 *  log and the annotation JSON. One shape everywhere, so there is no re-nesting
 *  step to get wrong. */
export function toFlat(q: Quad): Float32Array {
  return new Float32Array([
    q[0].x, q[0].y,
    q[1].x, q[1].y,
    q[2].x, q[2].y,
    q[3].x, q[3].y,
  ]);
}

/** Inverse of {@link toFlat}. Returns null for anything that isn't 8 finite
 *  numbers — an engine that answers `[]` for "no such annotation" must not be
 *  mistaken for one that answered with a collapsed quad. */
export function fromFlat(v: ArrayLike<number> | null | undefined): Quad | null {
  if (!v || v.length !== 8) return null;
  for (let i = 0; i < 8; i++) if (!Number.isFinite(v[i])) return null;
  return [
    { x: v[0], y: v[1] },
    { x: v[2], y: v[3] },
    { x: v[4], y: v[5] },
    { x: v[6], y: v[7] },
  ];
}

/** True when the quad is (within epsilon) the identity. Epsilon rather than
 *  `===` for the same reason the crate uses one: the value round-trips through
 *  f32, so a handle dragged back to its corner would otherwise keep a no-op
 *  warp alive forever. */
export function isIdentity(q: Quad): boolean {
  return q.every(
    (p, i) =>
      Math.abs(p.x - IDENTITY_QUAD[i].x) < 1e-4 &&
      Math.abs(p.y - IDENTITY_QUAD[i].y) < 1e-4,
  );
}

/** Convex and correctly wound — the same test the crate runs before warping.
 *  Duplicated deliberately: the overlay needs the answer DURING the drag to
 *  refuse the move and paint the quad as rejected, and asking the worker would
 *  reintroduce the round trip this module exists to avoid. The crate's copy
 *  stays the authority (it is what actually guards the pixels); this one is the
 *  preview. `quadValidityAgrees` in the tests pins them together. */
export function isValidQuad(q: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    const e1x = b.x - a.x;
    const e1y = b.y - a.y;
    const e2x = c.x - b.x;
    const e2y = c.y - b.y;
    const l1 = Math.hypot(e1x, e1y);
    const l2 = Math.hypot(e2x, e2y);
    // A collapsed edge or a straight vertex is REJECTED, not skipped — see the
    // long note on the crate's `is_valid_quad`, which this mirrors line for
    // line. Skipping them let a fully collapsed quad read as convex.
    if (l1 < 1e-12 || l2 < 1e-12) return false;
    // Normalised by both edge lengths, so this is sin(angle): dimensionless,
    // and therefore the same threshold works for a 0..1 normalised quad and a
    // pixel-space one thousands of units across.
    const sin = (e1x * e2y - e1y * e2x) / (l1 * l2);
    if (Math.abs(sin) < 1e-6) return false;
    const s = sin > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (sign !== s) return false;
  }
  return sign !== 0;
}

/** The corner sharing `i`'s top-or-bottom edge. */
const EDGE_PARTNER = [TR, TL, BL, BR] as const;

/**
 * Move corner `index` to `to`, and return the quad the ACTIVE MODE implies.
 *
 * This is the whole difference between the three sub-tools, in one function:
 *
 * | mode          | dragging one corner does                                  |
 * |---------------|-----------------------------------------------------------|
 * | `distort`     | moves only that corner — full projective freedom          |
 * | `perspective` | mirrors its edge partner, so the shape stays a symmetric   |
 * |               | trapezoid (a keystone) about the vertical centre line     |
 * | `skew`        | slides the corner ALONG its own edge, and its partner with |
 * |               | it — a shear, so opposite edges stay parallel              |
 *
 * `base` is the quad as it was when the drag STARTED, not the last frame's
 * result. Applying each rule to the live quad instead would compound it —
 * `perspective` would mirror the mirror, and a slow drag would travel twice as
 * far as a fast one over the same distance. Every rule here is a pure function
 * of (drag start, pointer now).
 */
export function dragCorner(
  base: Quad,
  index: number,
  to: Pt,
  mode: PerspectiveMode,
): Quad {
  const q: Quad = base.map((p) => ({ x: p.x, y: p.y })) as Quad;

  if (mode === "distort") {
    q[index] = { x: to.x, y: to.y };
    return q;
  }

  if (mode === "perspective") {
    // Keystone: the dragged corner and its edge partner move symmetrically
    // about the quad's vertical centre line, so the edge shortens or widens
    // while staying centred. This is Photoshop's Perspective handle, and the
    // reason it exists is that free-dragging four corners into a believable
    // keystone by eye is fiddly.
    const partner = EDGE_PARTNER[index];
    const cx = (base[index].x + base[partner].x) / 2;
    const dx = to.x - base[index].x;
    q[index] = { x: to.x, y: to.y };
    // Mirror the horizontal move; the partner keeps the dragged corner's new
    // vertical so the edge stays straight.
    q[partner] = { x: base[partner].x - dx, y: to.y };
    // Keep the mirror honest even if the base edge was already off-centre.
    const newCx = (q[index].x + q[partner].x) / 2;
    const shift = cx - newCx;
    q[index].x += shift;
    q[partner].x += shift;
    return q;
  }

  // skew — shear along the edge the corner sits on. The corner slides
  // horizontally, its edge partner slides the SAME way (not mirrored), and
  // nothing moves vertically. Opposite edges therefore stay parallel, which is
  // what makes it a shear rather than a perspective.
  const partner = EDGE_PARTNER[index];
  const dx = to.x - base[index].x;
  q[index] = { x: base[index].x + dx, y: base[index].y };
  q[partner] = { x: base[partner].x + dx, y: base[partner].y };
  return q;
}

/**
 * Move an EDGE midpoint handle. Both corners of that edge translate together.
 *
 * The screenshot shows midpoint handles on every edge, and they are the reason
 * Skew is usable at all: shearing by dragging a corner moves the corner you
 * grabbed, whereas shearing by dragging the top edge moves the whole edge,
 * which is what "skew" means to anyone who has used the tool elsewhere.
 *
 * `edge` is indexed by its FIRST corner: 0 = top (TL→TR), 1 = right (TR→BR),
 * 2 = bottom (BR→BL), 3 = left (BL→TL).
 */
export function dragEdge(
  base: Quad,
  edge: number,
  delta: Pt,
  mode: PerspectiveMode,
): Quad {
  const q: Quad = base.map((p) => ({ x: p.x, y: p.y })) as Quad;
  const a = edge;
  const b = (edge + 1) % 4;
  const horizontal = edge === 0 || edge === 2;

  if (mode === "skew") {
    // A shear constrains the edge to slide along its own direction only:
    // horizontal edges move in x, vertical edges move in y. Letting a skew
    // handle move both axes would just be Distort with fewer handles.
    const dx = horizontal ? delta.x : 0;
    const dy = horizontal ? 0 : delta.y;
    q[a] = { x: base[a].x + dx, y: base[a].y + dy };
    q[b] = { x: base[b].x + dx, y: base[b].y + dy };
    return q;
  }

  if (mode === "perspective") {
    // Widen or narrow the edge about its own centre — the keystone gesture
    // driven from the edge instead of a corner.
    const spread = horizontal ? delta.x : delta.y;
    const sa = base[a];
    const sb = base[b];
    const dir = horizontal ? (sb.x >= sa.x ? 1 : -1) : sb.y >= sa.y ? 1 : -1;
    if (horizontal) {
      q[a] = { x: sa.x - spread * dir, y: sa.y };
      q[b] = { x: sb.x + spread * dir, y: sb.y };
    } else {
      q[a] = { x: sa.x, y: sa.y - spread * dir };
      q[b] = { x: sb.x, y: sb.y + spread * dir };
    }
    return q;
  }

  // distort — the edge translates freely, both axes.
  q[a] = { x: base[a].x + delta.x, y: base[a].y + delta.y };
  q[b] = { x: base[b].x + delta.x, y: base[b].y + delta.y };
  return q;
}

/** Midpoint of edge `i` (indexed by its first corner). */
export function edgeMidpoint(q: Quad, edge: number): Pt {
  const a = q[edge];
  const b = q[(edge + 1) % 4];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Solve the forward homography mapping the unit square to `quad`.
 *
 * The OVERLAY's copy of the solver — used to draw the preview grid and to place
 * a caption inside the quad while dragging. The crate solves the same system in
 * the other direction for resampling; this one is forward because the overlay
 * asks "where does this grid line go?", not "where did this pixel come from?".
 *
 * Returns null for a degenerate quad, which the overlay renders as the rejected
 * state rather than drawing garbage.
 */
export function unitSquareTo(quad: Quad): ((u: number, v: number) => Pt) | null {
  const src: Quad = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const m = solve(src, quad);
  if (!m) return null;
  return (u: number, v: number) => {
    const d = m[6] * u + m[7] * v + 1;
    if (Math.abs(d) < 1e-12) return { x: 0, y: 0 };
    return {
      x: (m[0] * u + m[1] * v + m[2]) / d,
      y: (m[3] * u + m[4] * v + m[5]) / d,
    };
  };
}

/** 8×8 Gaussian elimination with partial pivoting — the same DLT arrangement
 *  and the same pivoting rationale as `Homography::from_correspondences` in the
 *  crate. Kept in step with it by `homographyMatchesTheCrate` in the tests. */
function solve(src: Quad, dst: Quad): number[] | null {
  const a: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u]);
    a.push([0, 0, 0, x, y, 1, -x * v, -y * v, v]);
  }
  for (let col = 0; col < 8; col++) {
    let piv = col;
    for (let r = col + 1; r < 8; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    }
    if (Math.abs(a[piv][col]) < 1e-12) return null;
    [a[col], a[piv]] = [a[piv], a[col]];
    const d = a[col][col];
    for (let c = col; c < 9; c++) a[col][c] /= d;
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = a[r][col];
      if (f === 0) continue;
      for (let c = col; c < 9; c++) a[r][c] -= f * a[col][c];
    }
  }
  const m = a.map((row) => row[8]);
  return m.every(Number.isFinite) ? m : null;
}

/** Map a quad expressed in one box's local pixel space into normalised 0..1
 *  coordinates across that box — the form the engine stores. */
export function normalise(q: Quad, w: number, h: number): Quad {
  if (w <= 0 || h <= 0) return IDENTITY_QUAD;
  return q.map((p) => ({ x: p.x / w, y: p.y / h })) as Quad;
}

/** Inverse of {@link normalise}. */
export function denormalise(q: Quad, w: number, h: number): Quad {
  return q.map((p) => ({ x: p.x * w, y: p.y * h })) as Quad;
}
