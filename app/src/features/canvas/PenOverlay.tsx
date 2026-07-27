import { useCallback, useEffect, useRef, useState } from "react";

// Pen-nib cursor (data-URI), mirroring CanvasArea's rotate-cursor pattern.
/** Screen-pixel radius around the first anchor that snaps a click into closing
 *  the path. The hit test and the on-canvas ring MUST read this same number —
 *  a ring that promises a close the click doesn't perform is worse than no ring
 *  at all. */
const CLOSE_RADIUS = 10;
const CLOSE_RADIUS_SQ = CLOSE_RADIUS * CLOSE_RADIUS;

const PEN_CURSOR =
  'url("data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='1' stroke-linejoin='round'>
      <path d='M3 21 L5.5 20.3 L17 8.8 L15.2 7 L3.7 18.5 Z'/>
      <path d='M15.5 6.7 L17.3 8.5 L19 6.8 L17.2 5 Z'/>
    </svg>`,
  ) +
  '") 3 21, crosshair';

type Pt = { x: number; y: number };
interface Anchor {
  x: number;
  y: number;
  in: Pt | null;
  out: Pt | null;
}
type Drag = { kind: "create" | "out" | "in" | "anchor"; index: number } | null;
type FinishMode = "commit-close" | "commit-open" | "cancel";

/** anchors → Rust cubic control sequence [a0, a0.out, a1.in, a1, …] (+ closing). */
function serialize(anchors: Anchor[], close: boolean): number[] {
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
function deserialize(flat: number[]): { anchors: Anchor[]; closed: boolean } {
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

interface PenOverlayProps {
  canvasEl: HTMLCanvasElement | null;
  color: string;
  strokeWidth: number;
  /** Live fill preview (Paint → Pen → Background). "none" = outline only.
   *  SVG auto-closes the fill, mirroring Rust's `fill_polygon` on commit. */
  fillMode?: "none" | "solid" | "gradient" | "pixelate";
  fillColor?: string;
  /** Commit a NEW path: flat control sequence + whether it closes. Returns the
   *  new annotation's id so the overlay can KEEP it selected — without that id
   *  a finished path went straight back to nothing selected, and the only route
   *  to its colour was the Reselect list. */
  onCommit: (flatPoints: number[], close: boolean) => number | void;
  /** Hit-test an image-space point against committed kind-7 paths. */
  onHitTest?: (imgX: number, imgY: number) => { id: number; points: number[] } | null;
  /** A committed path was picked for editing (hide the baked copy). */
  onEditStart?: (id: number) => void;
  /** Commit a reshape of a committed path. */
  onEditCommit?: (id: number, flatPoints: number[]) => void;
  /** Abandon an edit (un-hide, leave the original). */
  onEditCancel?: (id: number) => void;
  /** Open a committed path for editing from OUTSIDE the canvas — the Reselect
   *  list in Review. Without this, reselect had no way to reach the overlay, so
   *  a picked path was hidden (`set_editing_shape`) with nothing drawn in its
   *  place. Consumed once, then cleared via `onEditRequestHandled`. */
  editRequest?: { id: number; points: number[] } | null;
  onEditRequestHandled?: () => void;
}

/**
 * Photoshop-style Bézier pen overlay. Two modes:
 * - **Create**: click empty canvas = corner anchor, click-drag = smooth handles.
 * - **Edit**: click a committed path to re-open it; its anchors/handles load in.
 * In both modes any anchor or control handle can be grabbed and dragged. Finish
 * with Enter (close / commit) / Esc (open / cancel) / click-first-anchor / click
 * off-canvas; Backspace drops the last point.
 */
export function PenOverlay({
  canvasEl,
  color,
  strokeWidth,
  fillMode,
  fillColor,
  onCommit,
  onHitTest,
  onEditStart,
  onEditCommit,
  onEditCancel,
  editRequest,
  onEditRequestHandled,
}: PenOverlayProps) {
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [closed, setClosed] = useState(false);
  /** Pointer is inside the radius that would close the path. Drives the ring on
   *  the first anchor, so "clicking here joins the ends" is shown rather than
   *  guessed at. Stored as a boolean, not a position, so moving the mouse only
   *  re-renders on the two frames where the answer actually changes. */
  const [nearStart, setNearStart] = useState(false);
  const anchorsRef = useRef(anchors);
  anchorsRef.current = anchors;
  const editingIdRef = useRef(editingId);
  editingIdRef.current = editingId;
  const closedRef = useRef(closed);
  closedRef.current = closed;
  const dragRef = useRef<Drag>(null);
  const [, setTick] = useState(0);

  const mapImg = useCallback(
    (cx: number, cy: number): Pt => {
      if (!canvasEl) return { x: 0, y: 0 };
      const r = canvasEl.getBoundingClientRect();
      return {
        x: (cx - r.left) / (r.width / canvasEl.width),
        y: (cy - r.top) / (r.height / canvasEl.height),
      };
    },
    [canvasEl],
  );

  /** Finish the path in progress.
   *
   *  `keepSelection` is the difference between "I'm done with this path" and
   *  "I've finished drawing it and now I want to style it". Finishing used to
   *  always drop the selection, which is why changing a pen path's colour meant
   *  hunting for the Reselect list: the path you had just drawn was already
   *  deselected by the time you reached for a swatch. Enter and closing the
   *  loop now keep it live; Escape and clicking away still let go, so there is
   *  still an obvious way OUT of a selection. */
  const finish = useCallback(
    (mode: FinishMode, keepSelection = false) => {
      const id = editingIdRef.current;
      const a = anchorsRef.current;
      let stayOn: number | null = null;

      if (id !== null) {
        if (mode === "cancel" || a.length < 2) onEditCancel?.(id);
        else {
          onEditCommit?.(id, serialize(a, closedRef.current));
          // The commit released the engine's editing lock, so re-take it below
          // or the baked path reappears underneath the overlay's own preview.
          if (keepSelection) stayOn = id;
        }
      } else if (mode !== "cancel" && a.length >= 2) {
        const close = mode === "commit-close";
        const newId = onCommit(serialize(a, close), close);
        if (keepSelection && typeof newId === "number" && newId >= 0) {
          stayOn = newId;
          setClosed(close);
        }
      }

      dragRef.current = null;
      if (stayOn === null) {
        setEditingId(null);
        setClosed(false);
        setAnchors([]);
      } else {
        onEditStart?.(stayOn); // hide the baked copy; the overlay keeps drawing it
        setEditingId(stayOn);
      }
    },
    [onCommit, onEditCommit, onEditCancel, onEditStart],
  );

  // Leaving the pen unmounts this overlay, and a finished path now stays
  // selected — so the engine can be holding `editing_shape_id` at that moment,
  // hiding the baked path while the only thing drawing it disappears. The path
  // would look deleted. Commit what's in flight (or release the lock) on the
  // way out. Deliberately NOT `finish`: this runs during teardown, where the
  // setState calls in `finish` have nothing left to update. Callbacks come
  // through a ref so the effect can be a true run-once.
  const exitRef = useRef({ onCommit, onEditCommit, onEditCancel });
  exitRef.current = { onCommit, onEditCommit, onEditCancel };
  useEffect(
    () => () => {
      const id = editingIdRef.current;
      const a = anchorsRef.current;
      const cb = exitRef.current;
      if (id !== null) {
        if (a.length >= 2) cb.onEditCommit?.(id, serialize(a, closedRef.current));
        else cb.onEditCancel?.(id);
      } else if (a.length >= 2) {
        cb.onCommit(serialize(a, closedRef.current), closedRef.current);
      }
    },
    [],
  );

  // Reselect from the Review list: load the requested path's geometry into the
  // overlay so its curve AND control points come back, editable. The baked copy
  // is hidden by onEditStart, exactly as for a click-to-reselect on canvas.
  useEffect(() => {
    if (!editRequest) return;
    const { anchors: a, closed: cl } = deserialize(editRequest.points);
    if (a.length >= 2) {
      onEditStart?.(editRequest.id);
      setEditingId(editRequest.id);
      setClosed(cl);
      setAnchors(a);
    }
    onEditRequestHandled?.();
  }, [editRequest, onEditStart, onEditRequestHandled]);

  // Window-level drag for every drag kind (anchors + handles, create + edit).
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const { x: ix, y: iy } = mapImg(e.clientX, e.clientY);
      setAnchors((a) => {
        if (d.index >= a.length) return a;
        const next = a.slice();
        const an = { ...next[d.index] };
        if (d.kind === "create" || d.kind === "out") {
          an.out = { x: ix, y: iy };
          an.in = { x: 2 * an.x - ix, y: 2 * an.y - iy };
        } else if (d.kind === "in") {
          an.in = { x: ix, y: iy };
          an.out = { x: 2 * an.x - ix, y: 2 * an.y - iy };
        } else {
          const dx = ix - an.x;
          const dy = iy - an.y;
          an.x = ix;
          an.y = iy;
          if (an.in) an.in = { x: an.in.x + dx, y: an.in.y + dy };
          if (an.out) an.out = { x: an.out.x + dx, y: an.out.y + dy };
        }
        next[d.index] = an;
        return next;
      });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [mapImg]);

  // Keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        // Closes the loop AND keeps it selected, so the panel's colour and
        // Background controls are pointing at the path you just drew.
        e.preventDefault();
        finish("commit-close", true);
      } else if (e.key === "Escape") {
        // The deliberate way OUT: bake and deselect. Since Enter now holds the
        // selection, there has to be one.
        //
        // Escape used to CANCEL whenever a path was selected, which was right
        // when the only way to be selected was to deliberately re-open a
        // committed path. Now that drawing one leaves it selected, that rule
        // threw away every restyle: pick a colour, press Escape, and the path
        // snapped back to the colour it was drawn in — the exact frustration
        // this change is meant to remove. Escape commits; Ctrl+Z is how you
        // take back a reshape you didn't want.
        e.preventDefault();
        finish(closedRef.current ? "commit-close" : "commit-open");
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setAnchors((a) => a.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  // Click off the canvas → finish (commit when editing, finish-open when drawing).
  //
  // EXCEPT on the tool panel. This listener fires on raw coordinates, so every
  // click on the Pen panel counted as "off the canvas" and finished the path —
  // including the click on the colour swatch you opened the panel to reach. The
  // path was gone by the time the picker appeared, which is what made Reselect
  // feel mandatory. Panels marked `data-pen-keep-selection` operate ON the
  // selection, so they must not end it; the workspace around the canvas still
  // does, and remains the quick way to let go.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!canvasEl) return;
      const target = e.target as Element | null;
      if (target?.closest?.("[data-pen-keep-selection]")) return;
      const r = canvasEl.getBoundingClientRect();
      const inside =
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom;
      if (!inside) finish(editingIdRef.current !== null ? "commit-close" : "commit-open");
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [canvasEl, finish]);

  // Track the canvas box through zoom/pan/resize/scroll.
  useEffect(() => {
    const f = () => setTick((t) => t + 1);
    window.addEventListener("resize", f);
    window.addEventListener("scroll", f, true);
    return () => {
      window.removeEventListener("resize", f);
      window.removeEventListener("scroll", f, true);
    };
  }, []);

  if (!canvasEl) return null;
  const rect = canvasEl.getBoundingClientRect();
  const sx = rect.width / canvasEl.width;
  const sy = rect.height / canvasEl.height;
  const toSX = (ix: number) => rect.left + ix * sx;
  const toSY = (iy: number) => rect.top + iy * sy;

  // Proximity to the closing target. Scoped to the capture rect rather than a
  // window listener, and it only writes state when the boolean flips, so
  // sweeping across the canvas doesn't re-render on every frame.
  const onCanvasMove = (e: React.PointerEvent) => {
    if (closed || anchors.length < 2) {
      if (nearStart) setNearStart(false);
      return;
    }
    const f = anchors[0];
    const dx = toSX(f.x) - e.clientX;
    const dy = toSY(f.y) - e.clientY;
    const near = dx * dx + dy * dy < CLOSE_RADIUS_SQ;
    if (near !== nearStart) setNearStart(near);
  };

  const onCanvasDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const { x: ix, y: iy } = mapImg(e.clientX, e.clientY);

    // Building a new path: close when clicking near the first anchor.
    if (editingId === null && anchors.length >= 2) {
      const f = anchors[0];
      const dx = toSX(f.x) - e.clientX;
      const dy = toSY(f.y) - e.clientY;
      if (dx * dx + dy * dy < CLOSE_RADIUS_SQ) {
        finish("commit-close", true); // closing the loop keeps it selected too
        return;
      }
    }

    // Idle (nothing in progress): try to re-open a committed path under the click.
    if (anchors.length === 0 && onHitTest) {
      const hit = onHitTest(ix, iy);
      if (hit) {
        const { anchors: a, closed: cl } = deserialize(hit.points);
        if (a.length >= 2) {
          onEditStart?.(hit.id);
          setEditingId(hit.id);
          setClosed(cl);
          setAnchors(a);
          return;
        }
      }
    }

    // Create mode only: drop a new anchor (drag pulls its handles).
    if (editingId === null) {
      dragRef.current = { kind: "create", index: anchors.length };
      setAnchors((arr) => [...arr, { x: ix, y: iy, in: null, out: null }]);
    }
  };

  // SVG path (screen coords), including the closing segment when closed.
  let d = "";
  if (anchors.length > 0) {
    d = `M ${toSX(anchors[0].x)} ${toSY(anchors[0].y)}`;
    for (let i = 1; i < anchors.length; i++) {
      const prev = anchors[i - 1];
      const cur = anchors[i];
      const c1 = prev.out ?? prev;
      const c2 = cur.in ?? cur;
      d += ` C ${toSX(c1.x)} ${toSY(c1.y)}, ${toSX(c2.x)} ${toSY(c2.y)}, ${toSX(cur.x)} ${toSY(cur.y)}`;
    }
    if (closed && anchors.length > 1) {
      const last = anchors[anchors.length - 1];
      const first = anchors[0];
      const c1 = last.out ?? last;
      const c2 = first.in ?? first;
      d += ` C ${toSX(c1.x)} ${toSY(c1.y)}, ${toSX(c2.x)} ${toSY(c2.y)}, ${toSX(first.x)} ${toSY(first.y)} Z`;
    }
  }

  const startDrag =
    (kind: "anchor" | "in" | "out", index: number) => (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      // Closing a path by clicking the FIRST anchor — the Photoshop gesture, and
      // the one `onCanvasDown` documents. That handler never saw the click: this
      // 8×8 handle sits ON TOP of the capture rect and stops propagation, so the
      // click started an anchor drag instead. The path then never committed, so
      // neither the stroke NOR the Background fill ever appeared — the "closed
      // path refuses to fill" bug. Close here, where the click actually lands.
      if (
        kind === "anchor" &&
        index === 0 &&
        editingIdRef.current === null &&
        anchorsRef.current.length >= 2
      ) {
        // Keep it selected, same as Enter. This is the close gesture that
        // actually fires — the twin in `onCanvasDown` is shadowed by this
        // handle — so missing the flag here meant clicking the first anchor
        // still dropped you straight back to nothing selected.
        finish("commit-close", true);
        return;
      }
      dragRef.current = { kind, index };
    };

  const sw = Math.max(1.5, strokeWidth * sx);

  return (
    <svg
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        // Below the chrome (TopBar z-30, Tools/Gallery/Status z-40) so the
        // full-canvas capture rect can't block panel clicks on tall images,
        // yet above the canvas-wrapper (z-1) so anchors/handles stay visible.
        zIndex: 29,
        overflow: "hidden",
      }}
      // On the ROOT, not the capture rect. The anchor handles sit on top of
      // that rect and take `pointerEvents: all`, so the pointer went "quiet"
      // at exactly the moment that matters — hovering the first anchor, the
      // one place the close hint has to light up. Children bubble to here
      // whatever they are, and `pointerEvents: none` on this element only
      // stops it being its own hit target; it doesn't block the bubble.
      onPointerMove={onCanvasMove}
    >
      <rect
        x={rect.left}
        y={rect.top}
        width={rect.width}
        height={rect.height}
        fill="transparent"
        style={{ pointerEvents: "all", cursor: PEN_CURSOR }}
        onPointerDown={onCanvasDown}
      />

      {d && (
        <>
          {/* Live Background fill — drawn under the stroke. SVG auto-closes the
              path, matching the committed result (Rust fill_polygon). Semi-
              transparent so the image stays visible while you place points. */}
          {fillMode && fillMode !== "none" && (
            <path d={d} fill={fillColor ?? "#000000"} fillOpacity={0.7} stroke="none" />
          )}
          <path d={d} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={sw + 2} strokeLinecap="round" strokeLinejoin="round" />
          <path d={d} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}

      {/* Is the beginning joined to the end? Nothing said so before: a closed
          loop and an open path that happened to end near its start looked the
          same, and there was no hint that clicking the first anchor would join
          them. Three states, all static — an animated dash would be one more
          moving thing over the photo, and would need a reduced-motion escape:
            open, out of range  → dashed ring: "this is the closing point"
            open, in range      → solid accent ring + fill: "click joins it"
            closed              → solid ring, filled node: "the ends are joined"
          The ring's radius IS the click radius (CLOSE_RADIUS), so what it
          promises and what the hit test does cannot drift apart. */}
      {anchors.length >= 2 && (
        <circle
          cx={toSX(anchors[0].x)}
          cy={toSY(anchors[0].y)}
          r={CLOSE_RADIUS}
          fill={closed || nearStart ? "rgba(90,170,255,0.30)" : "none"}
          stroke={closed || nearStart ? "#5af" : "rgba(255,255,255,0.75)"}
          strokeWidth={closed || nearStart ? 2 : 1}
          strokeDasharray={closed || nearStart ? undefined : "3 3"}
          pointerEvents="none"
        />
      )}

      {anchors.map((a, i) => {
        const ax = toSX(a.x);
        const ay = toSY(a.y);
        return (
          <g key={i}>
            {a.in && (
              <>
                <line x1={ax} y1={ay} x2={toSX(a.in.x)} y2={toSY(a.in.y)} stroke="#5af" strokeWidth={1} />
                <circle cx={toSX(a.in.x)} cy={toSY(a.in.y)} r={4} fill="#5af" stroke="#fff" strokeWidth={1} style={{ pointerEvents: "all", cursor: "grab" }} onPointerDown={startDrag("in", i)} />
              </>
            )}
            {a.out && (
              <>
                <line x1={ax} y1={ay} x2={toSX(a.out.x)} y2={toSY(a.out.y)} stroke="#5af" strokeWidth={1} />
                <circle cx={toSX(a.out.x)} cy={toSY(a.out.y)} r={4} fill="#5af" stroke="#fff" strokeWidth={1} style={{ pointerEvents: "all", cursor: "grab" }} onPointerDown={startDrag("out", i)} />
              </>
            )}
            <rect
              x={ax - 4}
              y={ay - 4}
              width={8}
              height={8}
              // The joined start reads as the accent, matching its ring, so the
              // connection is one signal rather than two competing ones.
              fill={i === 0 ? (closed || nearStart ? "#5af" : "#fcdfc2") : "#fff"}
              stroke="#000"
              strokeWidth={1}
              style={{ pointerEvents: "all", cursor: "grab" }}
              onPointerDown={startDrag("anchor", i)}
            />
          </g>
        );
      })}
    </svg>
  );
}
