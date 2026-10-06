// The shape action bar — Apply · Cancel · Duplicate [-] 20px [+] · Connect
// · Disconnect — parked under a selected shape, plus the ring of eight port
// buttons that Duplicate and Connect open around it, and the X that
// Disconnect puts on every connector end attached to it. Disconnect is only
// on the bar while the shape HAS a connector.
//
// Connect's ports sit on the shape's OUTLINE (lib/shapePorts `outlinePoint`),
// so a connector to a circle, diamond, star or triangle touches the shape and
// not the empty corner of its box. Duplicate's arrows stay on the box.
//
// Replaces the Review › Reselect d-pad and its four ⊕ buttons: the bar is
// the same CanvasActionBar the Perspective quad uses, so the canvas has one
// kind of floating toolbar. Engine work lives in app/session/useShapeActions;
// geometry in lib/shapePorts. This file only places things and runs the
// Connect drag.
//
// Everything sits inside `[data-draw-overlay]`: useDrawingTools commits the
// pending edit on any pointerdown OUTSIDE that, and a click on this bar is
// not "outside" the shape being edited.
//
// Too small, no karate: under MIN_ACTIONABLE_SCREEN_PX on screen the bar and
// the ring are not drawn at all — they would bury the shape. Zoom in and
// they come back; Enter and Esc still apply and cancel.
import { useEffect, useRef, useState } from "react";
import { Check, Copy, LineSquiggle, Minus, Plus, Spline, Triangle, Unlink, X } from "lucide-react";
import {
  CanvasActionBar,
  CanvasActionBarButton,
  CanvasActionBarText,
} from "@/components/ui/canvas-action-bar";
import type { DrawEditState } from "@/hooks/useDrawingTools";
import { Button } from "@/components/ui/button";
import {
  GAP_MAX,
  GAP_STEP,
  PORTS,
  connectTarget,
  outlinePoint,
  portDirection,
  portPoint,
  targetPoint,
  tooSmallForActions,
  type AttachedEnd,
  type PortBox,
  type PortId,
  type PortTarget,
  type Pt,
} from "@/lib/shapePorts";
import type { ShapeActionMode } from "@/stores/useToolStore";

interface Props {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  editState: DrawEditState;
  mode: ShapeActionMode;
  gap: number;
  /** False for an arrow, line, pin — Duplicate and Connect are refused. */
  boxy: boolean;
  /** This shape's kind byte and star count — the outline its ports sit on. */
  outline: { kind: number; starPoints?: number };
  /** Every other box shape, IMAGE px — where a Connect drag can land. */
  connectTargets: PortTarget[];
  /** The connector ends attached to this shape (its committed geometry). */
  connections: AttachedEnd[];
  onApply: () => void;
  onCancel: () => void;
  onToggleDuplicate: () => void;
  onToggleConnect: () => void;
  onGap: (px: number) => void;
  onDuplicate: (port: PortId) => void;
  onConnect: (from: Pt, to: Pt) => void;
  onToggleDisconnect: () => void;
  onDisconnect: (arrowId: number) => void;
}

/** Port disc diameter, screen px — "small". */
const PORT_PX = 14;
/** Clear space between the shape's box and the disc's edge, screen px. */
const PORT_GAP_PX = 5;
/** Below the box, screen px: clears the rotate hook (≈31px) with room. */
const BAR_GAP_PX = 44;
/** How close a Connect drop must come to a port to snap, screen px. */
const SNAP_PX = 14;
/** Disconnect's X disc diameter, screen px — a touch bigger than a port, it
 *  is a delete. */
const X_PX = 18;

export function ShapeActionsOverlay({
  canvasRef,
  editState,
  mode,
  gap,
  boxy,
  outline,
  connectTargets,
  connections,
  onApply,
  onCancel,
  onToggleDuplicate,
  onToggleConnect,
  onGap,
  onDuplicate,
  onConnect,
  onToggleDisconnect,
  onDisconnect,
}: Props) {
  // Connect drag: the port it started from (IMAGE px) and the pointer (SCREEN).
  const [drag, setDrag] = useState<{ from: Pt; at: Pt } | null>(null);
  const dragRef = useRef(drag);
  const latest = useRef({ onConnect, connectTargets });
  useEffect(() => {
    dragRef.current = drag;
    latest.current = { onConnect, connectTargets };
  });

  // Window listeners only while a drag is live — the pointer can leave the
  // disc it started on the moment it moves.
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const canvas = canvasRef.current;
    const onMove = (e: PointerEvent) =>
      setDrag((d) => (d ? { ...d, at: { x: e.clientX, y: e.clientY } } : d));
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      setDrag(null);
      if (!d || !canvas) return;
      const r = canvas.getBoundingClientRect();
      const sx = r.width / canvas.width;
      const p = { x: (e.clientX - r.left) / sx, y: (e.clientY - r.top) / (r.height / canvas.height) };
      const hit = connectTarget(latest.current.connectTargets, p, SNAP_PX / sx);
      if (hit) latest.current.onConnect(d.from, hit.point);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Esc mid-drag drops the pigtail, not the whole edit.
      e.preventDefault();
      e.stopImmediatePropagation();
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [dragging, canvasRef]);

  const canvas = canvasRef.current;
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null;
  const r = canvas.getBoundingClientRect();
  const sx = r.width / canvas.width;
  const sy = r.height / canvas.height;
  const toScreen = (p: Pt): Pt => ({ x: r.left + p.x * sx, y: r.top + p.y * sy });

  const { start, end } = editState;
  const box: PortBox = { x0: start.x, y0: start.y, x1: end.x, y1: end.y };
  // An arrow's angle lives in its endpoints; it never carries a rotation.
  const rotation = editState.kind === "arrow" ? 0 : (editState.rotation ?? 0);
  const w = Math.abs(end.x - start.x) * sx;
  const h = Math.abs(end.y - start.y) * sy;
  // A line or arrow is measured along itself — its box can be 0px tall.
  const small = boxy ? tooSmallForActions(w, h) : Math.hypot(w, h) < 32;
  if (small) return null;

  const corners = PORTS.filter((p) => p.ax !== 0.5 && p.ay !== 0.5).map((p) =>
    toScreen(portPoint(box, rotation, p)),
  );
  const barX = (Math.min(...corners.map((c) => c.x)) + Math.max(...corners.map((c) => c.x))) / 2;
  const barY = Math.max(...corners.map((c) => c.y)) + BAR_GAP_PX;

  const ring = boxy && (mode === "duplicate" || mode === "connect");
  /** Where Connect's port `port` is on screen-independent IMAGE px. */
  const onOutline = (port: (typeof PORTS)[number]) =>
    outlinePoint(box, rotation, port, outline.kind, outline.starPoints);
  // The connectors drawn where they WILL be when this edit commits: from
  // their fixed far end to the same port on the shape's live outline. Only
  // when the shape has actually moved — the engine draws them in place
  // otherwise.
  const following = connections
    .map((c) => ({ c, live: onOutline(PORTS.find((p) => p.id === c.port)!) }))
    .filter(({ c, live }) => Math.hypot(live.x - c.at.x, live.y - c.at.y) > 0.5);
  const reach = PORT_GAP_PX + PORT_PX / 2;
  const snapped = drag
    ? connectTarget(
        connectTargets,
        { x: (drag.at.x - r.left) / sx, y: (drag.at.y - r.top) / sy },
        SNAP_PX / sx,
      )
    : null;

  return (
    <div data-draw-overlay data-testid="shape-actions">
      {ring &&
        PORTS.map((port) => {
          const isDup = mode === "duplicate";
          const at = toScreen(isDup ? portPoint(box, rotation, port) : onOutline(port));
          const dir = portDirection(rotation, port);
          const cx = at.x + dir.x * reach;
          const cy = at.y + dir.y * reach;
          // 0° = pointing up; the triangle's apex points AWAY from the shape.
          const angle = (Math.atan2(dir.x, -dir.y) * 180) / Math.PI;
          const label = isDup
            ? `Duplicate ${port.where} (${gap}px apart)`
            : `Connect from here — drag to another shape`;
          return (
            <button
              key={port.id}
              type="button"
              data-shape-port={port.id}
              aria-label={label}
              title={label}
              onClick={
                isDup
                  ? (e) => {
                      e.stopPropagation();
                      onDuplicate(port.id);
                    }
                  : undefined
              }
              onPointerDown={(e) => {
                e.stopPropagation();
                if (isDup) return;
                e.preventDefault();
                setDrag({
                  from: onOutline(port),
                  at: { x: e.clientX, y: e.clientY },
                });
              }}
              className="opacity-70 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
              style={{
                position: "fixed",
                left: cx,
                top: cy,
                width: PORT_PX,
                height: PORT_PX,
                transform: "translate(-50%, -50%)",
                borderRadius: "9999px",
                border: "none",
                padding: 0,
                // Near-black on the photo, the old pad's color: a control,
                // not part of the picture.
                background: "#111",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: isDup ? "pointer" : "crosshair",
                zIndex: 46,
                boxShadow: "0 1px 3px rgba(0,0,0,.35)",
              }}
            >
              {isDup ? (
                <Triangle
                  size={8}
                  strokeWidth={0}
                  fill="currentColor"
                  aria-hidden="true"
                  style={{ transform: `rotate(${angle}deg)` }}
                />
              ) : (
                <LineSquiggle size={9} strokeWidth={2.5} aria-hidden="true" />
              )}
            </button>
          );
        })}

      {mode === "disconnect" &&
        connections.map((c) => {
          const at = toScreen(onOutline(PORTS.find((p) => p.id === c.port)!));
          return (
            // The shared Button, not a raw <button> (ui-raw-button ratchet):
            // the inline style below still owns the canvas-fixed look.
            <Button
              key={`${c.arrowId}-${c.end}`}
              size="tiny"
              data-disconnect={c.arrowId}
              aria-label="Disconnect — delete this connector"
              title="Disconnect — delete this connector"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDisconnect(c.arrowId);
              }}
              className="opacity-85 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
              style={{
                position: "fixed",
                left: at.x,
                top: at.y,
                width: X_PX,
                height: X_PX,
                transform: "translate(-50%, -50%)",
                borderRadius: "9999px",
                border: "1.5px solid #fff",
                padding: 0,
                background: "#111",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 47,
                boxShadow: "0 1px 3px rgba(0,0,0,.35)",
              }}
            >
              <X size={11} strokeWidth={3} aria-hidden="true" />
            </Button>
          );
        })}

      {following.length > 0 && (
        <svg
          aria-hidden="true"
          data-testid="connector-follow"
          style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100vh",
            pointerEvents: "none",
            zIndex: 45,
          }}
        >
          {following.map(({ c, live }) => {
            const a = toScreen(c.other);
            const b = toScreen(live);
            return (
              <line
                key={`${c.arrowId}-${c.end}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#111"
                strokeOpacity={0.6}
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      )}

      {drag && (
        <svg
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100vh",
            pointerEvents: "none",
            zIndex: 46,
          }}
        >
          {/* Every other box's ports, so you can see where a drop lands. */}
          {connectTargets.flatMap((t) =>
            PORTS.map((p) => {
              const q = toScreen(targetPoint(t, p));
              const on = snapped?.id === t.id && snapped.port === p.id;
              return (
                <circle
                  key={`${t.id}-${p.id}`}
                  cx={q.x}
                  cy={q.y}
                  r={on ? 6 : 4}
                  fill={on ? "#111" : "white"}
                  stroke="#111"
                  strokeWidth={1.5}
                />
              );
            }),
          )}
          {(() => {
            const a = toScreen(drag.from);
            const b = snapped ? toScreen(snapped.point) : drag.at;
            return (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#111"
                strokeWidth={2}
                strokeDasharray={snapped ? undefined : "5 4"}
                strokeLinecap="round"
              />
            );
          })()}
        </svg>
      )}

      <CanvasActionBar x={barX} y={barY} label="Shape actions" data-testid="shape-action-bar">
        <CanvasActionBarButton onClick={onApply} title="Apply (Enter)">
          <Check aria-hidden className="size-4" /> Apply
        </CanvasActionBarButton>
        <CanvasActionBarButton onClick={onCancel} title="Cancel (Esc)">
          <X aria-hidden className="size-4" /> Cancel
        </CanvasActionBarButton>
        <span aria-hidden className="mx-0.5 h-4 w-px bg-theme-sidebar-border" />
        <CanvasActionBarButton
          onClick={onToggleDuplicate}
          pressed={mode === "duplicate"}
          disabled={!boxy}
          title={
            boxy
              ? mode === "duplicate"
                ? "Stop duplicating"
                : "Duplicate — arrows around the shape lay copies that way"
              : "Duplicate works on rectangles, circles, diamonds, stars and triangles"
          }
        >
          <Copy aria-hidden className="size-4" /> Duplicate
        </CanvasActionBarButton>
        {mode === "duplicate" && boxy && (
          <>
            <CanvasActionBarButton
              onClick={() => onGap(gap - GAP_STEP)}
              disabled={gap <= 0}
              title={`Less space between copies (−${GAP_STEP}px)`}
              className="px-1"
            >
              <Minus aria-hidden className="size-3.5" />
            </CanvasActionBarButton>
            <CanvasActionBarText>{gap}px</CanvasActionBarText>
            <CanvasActionBarButton
              onClick={() => onGap(gap + GAP_STEP)}
              disabled={gap >= GAP_MAX}
              title={`More space between copies (+${GAP_STEP}px)`}
              className="px-1"
            >
              <Plus aria-hidden className="size-3.5" />
            </CanvasActionBarButton>
          </>
        )}
        <CanvasActionBarButton
          onClick={onToggleConnect}
          pressed={mode === "connect"}
          disabled={!boxy || mode === "duplicate"}
          title={
            !boxy
              ? "Connect works on rectangles, circles, diamonds, stars and triangles"
              : mode === "duplicate"
                ? "Turn Duplicate off to connect"
                : mode === "connect"
                  ? "Stop connecting"
                  : "Connect — drag from a point on this shape to a point on another"
          }
        >
          <Spline aria-hidden className="size-4" /> Connect
        </CanvasActionBarButton>
        {boxy && connections.length > 0 && (
          <CanvasActionBarButton
            onClick={onToggleDisconnect}
            pressed={mode === "disconnect"}
            title={
              mode === "disconnect"
                ? "Stop disconnecting"
                : "Disconnect — click an X to delete that connector"
            }
          >
            <Unlink aria-hidden className="size-4" /> Disconnect
          </CanvasActionBarButton>
        )}
      </CanvasActionBar>
    </div>
  );
}
