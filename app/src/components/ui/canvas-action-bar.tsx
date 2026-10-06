// The floating action bar that sits on or under the canvas — ONE component for
// every tool that wants buttons next to the gesture instead of in the sidebar.
// Edit › Perspective / Distort / Skew park it under the quad; Batch parks it
// under the 12-photo grid. Callers decide WHERE (an anchor point in screen px)
// and WHAT (buttons and text); this file owns the look, the clamping and the
// pointer rules, so the bars cannot drift apart.
//
// DOM, not SVG: real <button>s with focus, hover, labels and a keyboard path.
// The outer box is pointer-transparent so it never eats a drag that starts near
// it; only the pill itself takes pointer events.
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Keep the bar this far inside the viewport edges. */
const MARGIN_PX = 8;

interface CanvasActionBarProps {
  /** Screen point the bar hangs from: its top edge, horizontally centered. */
  x: number;
  y: number;
  /** Accessible name of the group, e.g. "Perspective actions". */
  label: string;
  "data-testid"?: string;
  children: React.ReactNode;
}

export function CanvasActionBar({ x, y, label, children, ...rest }: CanvasActionBarProps) {
  const pillRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 220, h: 40 });
  // Clamp with the bar's REAL size, so a long bar is not pushed half off-screen
  // and a short one is not held needlessly far from the edge.
  useLayoutEffect(() => {
    const el = pillRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const half = size.w / 2;
  const left = Math.min(Math.max(x, MARGIN_PX + half), window.innerWidth - MARGIN_PX - half);
  const top = Math.min(y, window.innerHeight - MARGIN_PX - size.h);

  return (
    <div
      data-testid={rest["data-testid"]}
      style={{
        position: "fixed",
        left,
        top,
        transform: "translateX(-50%)",
        zIndex: "var(--z-canvas-overlay)",
        pointerEvents: "none",
      }}
    >
      <div
        ref={pillRef}
        className="flex items-center gap-1 rounded-md border border-theme-sidebar-border bg-theme-sidebar px-1 py-1 shadow-lg"
        style={{ pointerEvents: "auto" }}
        role="group"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}

/** One button in a {@link CanvasActionBar}. */
export function CanvasActionBarButton({
  onClick,
  disabled,
  pressed,
  title,
  className,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  /** A toggle's state (aria-pressed + the hover tint held on). Omit for a
   *  plain button. */
  pressed?: boolean;
  /** Also the accessible name, so it must say what the button does. */
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      title={title}
      aria-label={title}
      // A canvas overlay's window-level drag listeners still hear a pointerdown
      // that lands here; stopping it keeps a click on a button from also
      // starting a drag underneath.
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-theme-foreground hover:bg-theme-muted disabled:cursor-not-allowed disabled:opacity-40",
        pressed && "bg-theme-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Plain text in a {@link CanvasActionBar} — a count or a status, not a control. */
export function CanvasActionBarText({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 text-xs tabular-nums text-theme-muted-foreground" aria-live="polite">
      {children}
    </span>
  );
}
