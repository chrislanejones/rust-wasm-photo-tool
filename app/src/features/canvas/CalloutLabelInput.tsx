// Smart Callout v1: the label being typed for a callout that is not placed
// yet. A Pins click with Drop on Callout parks its point in useAnnotationStore
// (`pendingCallout`); this draws the pin and leader it will make and a box to
// type the label in, where the label will go. Enter (or clicking away with
// text in it) places all three as one undo step through `commitCallout`
// (hooks/usePinSteps); Escape, or an empty box, places nothing.
import { useRef, useState } from "react";
import { defaultLabelAt, type Pt } from "@/lib/callouts";
import { pinLabelText } from "@/lib/pinLabel";
import { nextPinNumber } from "@/lib/pinSteps";
import { useAnnotationStore } from "@/stores/useAnnotationStore";
import { useToolStore } from "@/stores/useToolStore";

export function CalloutLabelInput({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const at = useAnnotationStore((s) => s.pendingCallout);
  const canvas = canvasRef.current;
  if (!at || !canvas) return null;
  // Keyed by its point: a click elsewhere blurs this box (placing what it
  // holds, at ITS point) while it starts the next one, with its own text.
  return <PendingCallout key={`${at.x},${at.y}`} at={at} canvas={canvas} />;
}

function PendingCallout({ at, canvas }: { at: Pt; canvas: HTMLCanvasElement }) {
  const { max } = useAnnotationStore((s) => s.pinSequence);
  const pinNext = useAnnotationStore((s) => s.pinNext);
  const strokeWidth = useToolStore((s) => s.toolSettings.strokeWidth);
  const color = useToolStore((s) => s.toolSettings.strokeColor);
  const letters = useToolStore((s) => s.toolSettings.pinLabel === "letters");
  const [text, setText] = useState("");
  const done = useRef(false);

  const finish = (place: boolean) => {
    if (done.current) return;
    done.current = true;
    const { pendingCallout, setPendingCallout, commitCallout } = useAnnotationStore.getState();
    if (pendingCallout === at) setPendingCallout(null);
    if (place && text.trim()) commitCallout?.(at, text.trim());
  };

  const r = canvas.getBoundingClientRect();
  const sx = r.width / canvas.width;
  const pinR = 8 + strokeWidth * 3;
  const label = defaultLabelAt(at, pinR, canvas.width);
  const pin = { x: r.left + at.x * sx, y: r.top + at.y * sx };
  const box = { x: r.left + label.x * sx, y: r.top + label.y * sx };
  return (
    <div data-draw-overlay data-callout-pending>
      <svg style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 45 }}>
        <line x1={box.x} y1={box.y + 12} x2={pin.x} y2={pin.y} stroke={color} strokeWidth={Math.max(1, 3 * sx)} />
        <circle cx={pin.x} cy={pin.y} r={pinR * sx} fill={color} />
        <text x={pin.x} y={pin.y} fill="white" fontSize={pinR * sx} textAnchor="middle" dominantBaseline="central">
          {pinLabelText(nextPinNumber(max, pinNext), letters ? 1 : 0)}
        </text>
      </svg>
      <input
        autoFocus
        aria-label="Callout label"
        placeholder="Label, then Enter"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation(); // Enter/Escape are this box's, not the edit box's
          if (e.key === "Enter") finish(true);
          if (e.key === "Escape") finish(false);
        }}
        onBlur={() => finish(true)}
        className="rounded-sm border border-theme-sidebar-border bg-theme-sidebar px-1.5 py-0.5 text-xs shadow-lg"
        style={{ position: "fixed", left: box.x, top: box.y, zIndex: 46, width: 160 }}
      />
    </div>
  );
}
