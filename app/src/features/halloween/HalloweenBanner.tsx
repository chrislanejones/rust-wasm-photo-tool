import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isHalloweenSeason, readDismissed, writeDismissed } from "./season";

const MESSAGE = "HAPPY HALLOWEEN";
/** Footprint along the cord, margins included (see `.halloween-flag*`). */
const LETTER_PITCH = 24;
const BLANK_PITCH = 16;
const GAP_PITCH = 10;
/** How far the middle of the cord hangs below its ends. */
const SAG = 12;

/**
 * A small "Happy Halloween" pennant garland: a pumpkin, a string of flags and
 * a bat, shown during the last week of October.
 *
 * Two placements, one garland:
 *  - `bar`: hangs under the editor's top bar and runs its full length. It is
 *    a child of the bar's surface, so it follows the bar's width as the side
 *    panels open and close, and it goes wherever the bar goes (the bar is not
 *    drawn in the dock layout, so neither is this).
 *  - `centered`: the start screen covers the top bar, so it carries its own
 *    copy at the top of the page, just the words.
 *
 * Decoration only: the garland ignores the pointer, only the X takes a click,
 * and closing either copy closes both and is remembered for the rest of this
 * year's season. After October 31 nothing renders, so no release has to take
 * it down. The sway is a CSS animation that the reduce-motion setting and the
 * OS preference both stop (see `.halloween-garland` in styles.css).
 */
export function HalloweenBanner({ placement }: { placement: "bar" | "centered" }) {
  const closed = useSyncExternalStore(subscribe, isClosed);
  if (closed || !isHalloweenSeason(new Date())) return null;

  return (
    <div className={`halloween-banner halloween-banner-${placement}`} data-testid={`halloween-banner-${placement}`}>
      <div className="halloween-garland" role="img" aria-label="Happy Halloween">
        <Pumpkin />
        <Pennants fill={placement === "bar"} />
        <Bat />
      </div>
      <Button size="xs" className="halloween-close" aria-label="Hide the Halloween banner" onClick={close}>
        <X aria-hidden />
      </Button>
    </div>
  );
}

/**
 * The flags on their cord. With `fill`, the cord takes all the width it is
 * given and plain flags pad out both sides, so the message stays centered
 * however long the bar is.
 */
function Pennants({ fill }: { fill: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!fill || !el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);

  // The message sits in the middle on bigger flags; with `fill`, smaller
  // plain flags run out to both ends of whatever width the cord is given.
  const message = [...MESSAGE];
  const messageWidth = message.reduce((w, ch) => w + (ch === " " ? GAP_PITCH : LETTER_PITCH), 0);
  const perSide = fill ? Math.max(0, Math.floor((width - messageWidth) / 2 / BLANK_PITCH)) : 0;
  const items = [...Array<string>(perSide).fill(""), ...message, ...Array<string>(perSide).fill("")];

  const pitch = (ch: string) => (ch === "" ? BLANK_PITCH : ch === " " ? GAP_PITCH : LETTER_PITCH);
  const total = items.reduce((w, ch) => w + pitch(ch), 0);
  let x = 0;
  const flags = items.map((ch, i) => {
    // The cord sags: flags near the middle hang lower and the ones either
    // side tilt toward it, like a real garland.
    const t = ((x + pitch(ch) / 2) / total) * 2 - 1;
    x += pitch(ch);
    const drop = Math.round(SAG * (1 - t * t));
    const tilt = Math.round(-t * 8);
    if (ch === " ") return <span key={i} className="halloween-gap" />;
    const colour = i % 2 ? " halloween-flag-purple" : "";
    return (
      <span
        key={i}
        className={`halloween-flag${ch ? "" : " halloween-flag-blank"}${colour}`}
        style={{ transform: `translateY(${drop}px) rotate(${tilt}deg)` }}
      >
        {ch}
      </span>
    );
  });

  return (
    <div ref={ref} className={fill ? "halloween-string halloween-string-fill" : "halloween-string"} aria-hidden>
      <svg className="halloween-cord" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden>
        <path d={`M0 2 Q50 ${2 + SAG * 2} 100 2`} vectorEffect="non-scaling-stroke" />
      </svg>
      {flags}
    </div>
  );
}

// ── Closed state, shared by both copies ──────────────────────────────────────
// Read once from storage; after that, closing either copy notifies the other.
const listeners = new Set<() => void>();
let closedNow: boolean | null = null;

function isClosed(): boolean {
  if (closedNow === null) closedNow = readDismissed(safeStorage(), new Date());
  return closedNow;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function close(): void {
  writeDismissed(safeStorage(), new Date());
  closedNow = true;
  listeners.forEach((fn) => fn());
}

function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function Pumpkin() {
  return (
    <svg className="halloween-pumpkin" viewBox="0 0 32 32" aria-hidden>
      <path className="halloween-stem" d="M15 4c1-2 4-2 5-1-2 1-3 3-3 5h-2z" />
      <ellipse className="halloween-pumpkin-body" cx="10.5" cy="19" rx="7.5" ry="10" />
      <ellipse className="halloween-pumpkin-body" cx="21.5" cy="19" rx="7.5" ry="10" />
      <ellipse className="halloween-pumpkin-body halloween-pumpkin-front" cx="16" cy="19" rx="7" ry="10.5" />
      <path className="halloween-face" d="M10 15l3 3h-4zM22 15l1 3h-4zM10 22c2 3 10 3 12 0l-2 1-2-1-2 1-2-1-2 1z" />
    </svg>
  );
}

function Bat() {
  return (
    <svg className="halloween-bat" viewBox="0 0 40 20" aria-hidden>
      <path
        className="halloween-bat-body"
        d="M20 6c1 0 2-2 2-3l1 3c3 0 3 3 3 5 2-3 6-4 9-3l5 2c-3 1-4 4-4 6-2-2-5-2-6 0-1-2-4-2-5 0-1 2-3 4-5 4s-4-2-5-4c-1-2-4-2-5 0-1-2-4-2-6 0 0-2-1-5-4-6l5-2c3-1 7 0 9 3 0-2 0-5 3-5l1-3c0 1 1 3 2 3z"
      />
    </svg>
  );
}
