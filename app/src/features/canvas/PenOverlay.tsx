import { useCallback, useEffect, useRef, useState } from "react";

// Pen-nib cursor (data-URI), mirroring CanvasArea's rotate-cursor pattern.
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
  /** Commit a NEW path: flat control sequence + whether it closes. */
  onCommit: (flatPoints: number[], close: boolean) => void;
  /** Hit-test an image-space point against committed kind-7 paths. */
  onHitTest?: (imgX: number, imgY: number) => { id: number; points: number[] } | null;
  /** A committed path was picked for editing (hide the baked copy). */
  onEditStart?: (id: number) => void;
  /** Commit a reshape of a committed path. */
  onEditCommit?: (id: number, flatPoints: number[]) => void;
  /** Abandon an edit (un-hide, leave the original). */
  onEditCancel?: (id: number) => void;
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
}: PenOverlayProps) {
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [closed, setClosed] = useState(false);
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

  const finish = useCallback(
    (mode: FinishMode) => {
      const id = editingIdRef.current;
      const a = anchorsRef.current;
      if (id !== null) {
        if (mode === "cancel" || a.length < 2) onEditCancel?.(id);
        else onEditCommit?.(id, serialize(a, closedRef.current));
      } else if (mode !== "cancel" && a.length >= 2) {
        const close = mode === "commit-close";
        onCommit(serialize(a, close), close);
      }
      dragRef.current = null;
      setEditingId(null);
      setClosed(false);
      setAnchors([]);
    },
    [onCommit, onEditCommit, onEditCancel],
  );

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
        e.preventDefault();
        finish("commit-close");
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish(editingIdRef.current !== null ? "cancel" : "commit-open");
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setAnchors((a) => a.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  // Click off the canvas → finish (commit when editing, finish-open when drawing).
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!canvasEl) return;
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

  const onCanvasDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const { x: ix, y: iy } = mapImg(e.clientX, e.clientY);

    // Building a new path: close when clicking near the first anchor.
    if (editingId === null && anchors.length >= 2) {
      const f = anchors[0];
      const dx = toSX(f.x) - e.clientX;
      const dy = toSY(f.y) - e.clientY;
      if (dx * dx + dy * dy < 100) {
        finish("commit-close");
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
              fill={i === 0 ? "#fcdfc2" : "#fff"}
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
