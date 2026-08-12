// ===== FILE: app/src/features/canvas/penPath.ts =====
//
// The pen tool's PURE layer: the anchor/curve representation the overlay and
// the engine agree on, plus the two guards that keep its async state machine
// honest. No React, no DOM — everything here is a function of its arguments.
//
// Split out of `PenOverlay.tsx` when ADR-024 Stage 3.5's last two sites landed.
// Two reasons, in order of weight:
//
//   1. The guards needed tests. This repo has no component-render harness
//      (vitest runs `environment: "node"` and its include glob is `.ts` only),
//      so the a13 precedent applies — `readUiSnapshot` was lifted out of
//      `syncState` for exactly this, because a guard closed over a ref inside a
//      `useCallback` has nowhere to be proven.
//   2. Exporting non-components from a `.tsx` file trips
//      `react-refresh/only-export-components`, and this repo treats its lint
//      warnings as a backlog to work down rather than a number to add to.
//
// `serialize`/`deserialize` came along because they are inverses and documented
// as such; splitting the pair would be worse than moving both.
export type Pt = { x: number; y: number };
export interface Anchor {
  x: number;
  y: number;
  in: Pt | null;
  out: Pt | null;
}
/** anchors → Rust cubic control sequence [a0, a0.out, a1.in, a1, …] (+ closing). */
export function serialize(anchors: Anchor[], close: boolean): number[] {
  if (anchors.length === 0) return [];
  const out: number[] = [];
  const push = (p: Pt) => out.push(p.x, p.y);
  push(anchors[0]);
  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1];
    const cur = anchors[i];
    push(prev.out ?? prev);
    push(cur.in ?? cur);
    push(cur);
  }
  if (close && anchors.length > 1) {
    const last = anchors[anchors.length - 1];
    const first = anchors[0];
    push(last.out ?? last);
    push(first.in ?? first);
    push(first);
  }
  return out;
}

/** Inverse of serialize: a flat control sequence → anchors + closed flag. */
export function deserialize(flat: number[]): { anchors: Anchor[]; closed: boolean } {
  const P: Pt[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) P.push({ x: flat[i], y: flat[i + 1] });
  if (P.length === 0) return { anchors: [], closed: false };
  const k = Math.floor((P.length - 1) / 3) + 1;
  const eq = (a: Pt, b: Pt) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
  const anchors: Anchor[] = [];
  for (let i = 0; i < k; i++) {
    const ai = 3 * i;
    if (ai >= P.length) break;
    const anchor = P[ai];
    const inH = i > 0 ? P[ai - 1] : null;
    const outH = ai + 1 < P.length ? P[ai + 1] : null;
    anchors.push({
      x: anchor.x,
      y: anchor.y,
      in: inH && !eq(inH, anchor) ? inH : null,
      out: outH && !eq(outH, anchor) ? outH : null,
    });
  }
  let closed = false;
  if (anchors.length >= 3 && eq(anchors[anchors.length - 1], anchors[0])) {
    closed = true;
    const repeat = anchors.pop()!;
    anchors[0].in = repeat.in; // closing in-handle belongs to the first anchor
  }
  return { anchors, closed };
}

/**
 * Run `body` unless a previous run is still in flight.
 *
 * ADR-024 Stage 3.5, the pen redesign. Extracted for the same reason a13 lifted
 * `readUiSnapshot` out of `syncState`: this guard IS the risk of making
 * `finish()` async, and buried inside a `useCallback` closed over a ref it had
 * nowhere to be tested. Here it does.
 *
 * The flag is passed in as a ref rather than closed over, deliberately. `finish`
 * is a `useCallback` whose deps include `onCommit`, which changes identity every
 * time the Pen panel's colour or width changes — a flag owned by the wrapper
 * would be reset by that re-creation, and resetting it mid-flight is exactly the
 * overlap the guard exists to prevent. A `useRef` outlives the re-creation.
 *
 * `finally`, not a trailing assignment: a commit that throws must not leave the
 * pen permanently unable to finish a path.
 */
export async function runExclusive(
  flag: { current: boolean },
  body: () => Promise<void>,
): Promise<void> {
  if (flag.current) return;
  flag.current = true;
  try {
    await body();
  } finally {
    flag.current = false;
  }
}

/** What a resolved hit test should do, given the click that issued it. */
export type HitOutcome =
  | { kind: "stale" }
  | { kind: "keep-speculative" }
  | { kind: "open"; id: number; anchors: Anchor[]; closed: boolean };

/**
 * Decide what to do with a hit test that has come back.
 *
 * The staleness check comes FIRST, before the hit is even looked at: a good
 * answer to a superseded question is still the wrong answer. Once the pen's
 * canvas click is async, a hit test issued by click 1 can resolve after click 2
 * has already moved the overlay on, and applying it there would load a path the
 * user is no longer pointing at, over state they have since changed.
 *
 * `keep-speculative` is the miss case, and it is not a no-op: the caller has
 * already placed an anchor optimistically, and that anchor is the first point
 * of the new path. "Nothing was under the click" and "what was under the click
 * is not a usable path" both mean the same thing here — keep drawing.
 */
export function resolveHit(
  hit: { id: number; points: number[] } | null,
  issuedSeq: number,
  currentSeq: number,
): HitOutcome {
  if (issuedSeq !== currentSeq) return { kind: "stale" };
  if (!hit) return { kind: "keep-speculative" };
  const { anchors, closed } = deserialize(hit.points);
  if (anchors.length < 2) return { kind: "keep-speculative" };
  return { kind: "open", id: hit.id, anchors, closed };
}

