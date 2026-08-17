// The Perspective tool's quad, its handles, and the drag that reshapes them.
//
// Projects image space → screen exactly the way ImageGuidesOverlay does (the
// live <canvas> rect plus sx/sy), so it tracks zoom and pan for free. The
// <svg> wrapper is pointer-transparent; only the handles capture pointers.
//
// WHY THE DRAG LIVES HERE AND NOT IN THE STAMP HANDLERS. `useEffectiveTool`
// idles for this sub-tool on purpose — routing a handle grab through the
// shared canvas handlers would put a clone-stamp dab under every corner you
// touched. Guides set the precedent; the note in `useEffectiveTool` explains
// it at the dispatch site.
//
// COLOUR IS STATE, not decoration. Green = the quad is convex and the engine
// will accept it; red = the corners have crossed and Apply is refused. Getting
// that feedback DURING the drag rather than on the click is why
// `isValidQuad` is duplicated into TS at all (see lib/perspective.ts).
import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  dragCorner,
  dragEdge,
  edgeMidpoint,
  isValidQuad,
  unitSquareTo,
  type PerspectiveMode,
  type Pt,
  type Quad,
} from "@/lib/perspective";

interface Props {
  /** Live screen rect of the <canvas> (already reflects zoom + pan). */
  rect: DOMRect;
  /** Screen px per image px on each axis (= zoom). */
  sx: number;
  sy: number;
  /** The quad, in IMAGE pixel coordinates. */
  quad: Quad;
  mode: PerspectiveMode;
  /** True while the quad targets an annotation (non-destructive). Only changes
   *  the accent colour — the geometry is identical either way. */
  vector: boolean;
  onChange: (q: Quad) => void;
  /** Fired once on pointer-up, so the caller can push ONE history step for the
   *  whole drag rather than one per frame. */
  onCommit: () => void;
  /** Live text annotations, so the tool can be pointed at one by clicking it.
   *  This is the canvas-side twin of picking it out of Review → Reselect. */
  annotations: { id: number; x: number; y: number; tile_w: number; tile_h: number }[];
  targetId: number | null;
  onTargetChange: (id: number | null) => void;
}

/** Handle hit radius in SCREEN px — deliberately not scaled by zoom. A handle
 *  is a thing you grab with a mouse, so it should stay the same physical size
 *  whether you are at 25% or 400%. */
const HANDLE_R = 6;
const HIT_R = 13;

export function PerspectiveOverlay({
  rect,
  sx,
  sy,
  quad,
  mode,
  vector,
  onChange,
  onCommit,
  annotations,
  targetId,
  onTargetChange,
}: Props) {
  const { left, top } = rect;

  // Latest projection + quad in refs so the window-level drag listeners read
  // current values without re-subscribing on every render (and therefore
  // without dropping the drag mid-gesture).
  const proj = useRef({ left, top, sx, sy });
  proj.current = { left, top, sx, sy };

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  /** The drag in flight. `base` is the quad as it was when the pointer went
   *  DOWN — every rule in lib/perspective.ts is a pure function of (base,
   *  pointer), so feeding it the live quad instead would compound the
   *  transform and make a slow drag travel further than a fast one. */
  const dragRef = useRef<{
    kind: "corner" | "edge";
    index: number;
    base: Quad;
    /** Pointer position at drag start, image space — edge drags are relative. */
    from: Pt;
  } | null>(null);

  useEffect(() => {
    const toImage = (e: globalThis.PointerEvent): Pt => {
      const p = proj.current;
      return { x: (e.clientX - p.left) / p.sx, y: (e.clientY - p.top) / p.sy };
    };
    const onPointerMove = (e: globalThis.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const to = toImage(e);
      const next =
        d.kind === "corner"
          ? dragCorner(d.base, d.index, to, modeRef.current)
          : dragEdge(
              d.base,
              d.index,
              { x: to.x - d.from.x, y: to.y - d.from.y },
              modeRef.current,
            );
      onChangeRef.current(next);
    };
    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      // One commit per gesture — the caller turns this into a single history
      // step. Committing per move would fill Review → History with a hundred
      // "Perspective" rows for one drag.
      onCommitRef.current();
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const valid = isValidQuad(quad);
  // Green when the engine will take it, red when the corners have crossed.
  // The screenshot's two colours are this one state, not two separate quads.
  const accent = !valid ? "#ef4444" : vector ? "#22c55e" : "#f43f5e";

  const toScreen = (p: Pt) => ({ x: left + p.x * sx, y: top + p.y * sy });
  const pts = quad.map(toScreen);
  const outline = pts.map((p) => `${p.x},${p.y}`).join(" ");

  // The interior grid: a 3×3 of projected lines, so the perspective is
  // readable BEFORE you commit. Drawn through the forward homography, which is
  // why lib/perspective.ts carries its own solver — a linearly-interpolated
  // grid would look right on a shear and lie on a keystone, which is precisely
  // the case the tool is for.
  const map = unitSquareTo(quad);
  const gridLines: string[] = [];
  if (map) {
    for (const t of [1 / 3, 2 / 3]) {
      const h: string[] = [];
      const v: string[] = [];
      // 8 samples per line: enough that the projective curvature reads as a
      // straight line where it is one, without drawing 60 segments per frame.
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        const ph = toScreen(map(u, t));
        const pv = toScreen(map(t, u));
        h.push(`${ph.x},${ph.y}`);
        v.push(`${pv.x},${pv.y}`);
      }
      gridLines.push(h.join(" "), v.join(" "));
    }
  }

  const startCorner =
    (index: number) => (e: ReactPointerEvent<SVGCircleElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        kind: "corner",
        index,
        base: quad.map((p) => ({ ...p })) as Quad,
        from: { x: 0, y: 0 },
      };
    };

  const startEdge = (index: number) => (e: ReactPointerEvent<SVGRectElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const p = proj.current;
    dragRef.current = {
      kind: "edge",
      index,
      base: quad.map((q) => ({ ...q })) as Quad,
      from: { x: (e.clientX - p.left) / p.sx, y: (e.clientY - p.top) / p.sy },
    };
  };

  return (
    <svg
      data-testid="perspective-overlay"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none", // wrapper transparent; only handles below grab
        zIndex: "var(--z-canvas-overlay)",
        overflow: "hidden",
      }}
    >
      {/* TARGET PICKERS — one transparent rect per text annotation, BELOW the
          quad so a handle grab always wins over a target switch. Clicking an
          annotation points the tool at it (non-destructive path); clicking the
          one already targeted releases it back to the destructive pixel path,
          so both directions are reachable without a second control. */}
      {annotations.map((a) => {
        const p0 = toScreen({ x: a.x, y: a.y });
        const p1 = toScreen({ x: a.x + a.tile_w, y: a.y + a.tile_h });
        const targeted = a.id === targetId;
        return (
          <rect
            key={`t${a.id}`}
            x={Math.min(p0.x, p1.x)}
            y={Math.min(p0.y, p1.y)}
            width={Math.abs(p1.x - p0.x)}
            height={Math.abs(p1.y - p0.y)}
            fill="transparent"
            stroke={targeted ? accent : "#94a3b8"}
            strokeWidth={1}
            strokeDasharray="4 3"
            strokeOpacity={targeted ? 0 : 0.7}
            style={{ pointerEvents: "auto", cursor: "pointer" }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTargetChange(targeted ? null : a.id);
            }}
          />
        );
      })}

      {/* Interior grid, behind the outline. */}
      {gridLines.map((points, i) => (
        <polyline
          key={`g${i}`}
          points={points}
          fill="none"
          stroke={accent}
          strokeWidth={1}
          strokeOpacity={0.4}
        />
      ))}

      <polygon
        points={outline}
        fill={accent}
        fillOpacity={0.08}
        stroke={accent}
        strokeWidth={2}
      />

      {/* Edge handles — indexed by their FIRST corner, matching dragEdge. */}
      {[0, 1, 2, 3].map((edge) => {
        const m = toScreen(edgeMidpoint(quad, edge));
        const horizontal = edge === 0 || edge === 2;
        // Under Skew an edge only slides along its own axis, so the cursor says
        // so rather than promising freedom the rule will refuse.
        const cursor =
          mode === "skew"
            ? horizontal
              ? "ew-resize"
              : "ns-resize"
            : "move";
        return (
          <g key={`e${edge}`} style={{ pointerEvents: "auto", cursor }}>
            <rect
              x={m.x - HIT_R}
              y={m.y - HIT_R}
              width={HIT_R * 2}
              height={HIT_R * 2}
              fill="transparent"
              onPointerDown={startEdge(edge)}
            />
            <rect
              x={m.x - HANDLE_R / 2 - 1}
              y={m.y - HANDLE_R / 2 - 1}
              width={HANDLE_R + 2}
              height={HANDLE_R + 2}
              fill="#fff"
              stroke={accent}
              strokeWidth={2}
              pointerEvents="none"
            />
          </g>
        );
      })}

      {/* Corner handles, drawn last so they sit above the edge handles where
          the two overlap on a small quad. */}
      {pts.map((p, i) => (
        <g key={`c${i}`} style={{ pointerEvents: "auto", cursor: "grab" }}>
          <circle
            cx={p.x}
            cy={p.y}
            r={HIT_R}
            fill="transparent"
            onPointerDown={startCorner(i)}
          />
          <circle
            cx={p.x}
            cy={p.y}
            r={HANDLE_R}
            fill={accent}
            stroke="#fff"
            strokeWidth={2}
            pointerEvents="none"
          />
        </g>
      ))}
    </svg>
  );
}
