import { useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isFallBackSeason, readDismissed, writeDismissed } from "./season";

const MESSAGE = "FALL BACK";
/** Footprint along the cord at full size, margins included (see
 *  `.fallback-flag*` and `.fallback-gap`, which multiply the same numbers by
 *  `--fallback-scale`). The gap between the words holds the pumpkin. */
const LETTER_PITCH = 56;
const BLANK_PITCH = 32;
const GAP_PITCH = 64;
/** How far the middle of the cord hangs below its ends, at full size. */
const SAG = 20;
/** Never shrink the letters below this, however narrow the bar. */
const MIN_SCALE = 0.4;

/**
 * A small "Fall Back" pennant garland: a clock at each end and a pumpkin
 * hanging between the two words, shown in the days around the first Sunday
 * of November, when clocks go back an hour (see season.ts).
 *
 * Two placements, one garland:
 *  - `bar`: hangs under the editor's top bar and runs its full length. It is
 *    a child of the bar's surface, so it follows the bar's width as the side
 *    panels open and close, and it goes wherever the bar goes (the bar is not
 *    drawn in the dock layout, so neither is this).
 *  - `centered`: the start screen covers the top bar, so it carries its own
 *    copy at the top of the page, just the words.
 *
 * ACCESSIBILITY. The garland is one image named "Fall back: clocks go back
 * one hour"; the flags, clocks and pumpkin inside it are hidden from
 * assistive tech, so the words are read once rather than letter by letter.
 * The X is a real, named, 24px button with the app's focus ring, and closing
 * it puts focus back on a neighbouring control. The garland's motion (a sway,
 * and the clock hands winding backwards) stops under reduce-motion, and the X
 * hides it outright (WCAG 2.2.2). The bar copy is a sibling of the top bar's
 * toolbar, not inside it, so it is not announced as a toolbar control.
 *
 * Decoration only: the garland ignores the pointer, only the X takes a click,
 * and closing either copy closes both and is remembered for the rest of this
 * year's season. Outside the season nothing renders, so no release has to
 * take it down. The motion is CSS animation that the reduce-motion setting
 * and the OS preference both stop (see `.fallback-garland` in styles.css).
 */
export function FallBackBanner({ placement }: { placement: "bar" | "centered" }) {
  const closed = useSyncExternalStore(subscribe, isClosed);
  if (closed || !isFallBackSeason(new Date())) return null;

  return (
    <div className={`fallback-banner fallback-banner-${placement}`} data-testid={`fallback-banner-${placement}`}>
      <div className="fallback-garland" role="img" aria-label="Fall back: clocks go back one hour">
        <Clock />
        <Pennants fill={placement === "bar"} />
        <Clock />
      </div>
      <Button
        size="tiny"
        className="fallback-close"
        aria-label="Hide the Fall Back banner"
        onClick={(e) => {
          // The X is about to unmount. If it had focus, hand focus to the
          // control just before it rather than dropping it on <body>, where a
          // keyboard or screen-reader user would have to start over.
          if (document.activeElement === e.currentTarget) focusNeighbour(e.currentTarget);
          close();
        }}
      >
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
  // A bar too short for the full-size message shrinks every flag to fit it,
  // rather than clipping letters off both ends.
  const message = [...MESSAGE];
  const fullMessageWidth = message.reduce((w, ch) => w + (ch === " " ? GAP_PITCH : LETTER_PITCH), 0);
  const scale = fill && width > 0 ? Math.max(MIN_SCALE, Math.min(1, width / fullMessageWidth)) : 1;
  const messageWidth = fullMessageWidth * scale;
  const perSide = fill ? Math.max(0, Math.floor((width - messageWidth) / 2 / (BLANK_PITCH * scale))) : 0;
  const items = [...Array<string>(perSide).fill(""), ...message, ...Array<string>(perSide).fill("")];

  const pitch = (ch: string) => (ch === "" ? BLANK_PITCH : ch === " " ? GAP_PITCH : LETTER_PITCH);
  const total = items.reduce((w, ch) => w + pitch(ch), 0);
  let x = 0;
  const flags = items.map((ch, i) => {
    // The cord sags: flags near the middle hang lower and the ones either
    // side tilt toward it, like a real garland.
    const t = ((x + pitch(ch) / 2) / total) * 2 - 1;
    x += pitch(ch);
    // In full-size pixels; the CSS scale shrinks the drop with the flag, so
    // the start-screen copy (scaled by media queries, not here) sags in step.
    const drop = Math.round(SAG * (1 - t * t));
    const tilt = Math.round(-t * 8);
    const transform = `translateY(calc(${drop}px * var(--fallback-scale))) rotate(${tilt}deg)`;
    if (ch === " ")
      return (
        <span key={i} className="fallback-gap" style={{ transform }}>
          <Pumpkin />
        </span>
      );
    const colour = i % 2 ? " fallback-flag-rust" : "";
    return (
      <span
        key={i}
        className={`fallback-flag${ch ? "" : " fallback-flag-blank"}${colour}`}
        style={{ transform }}
      >
        {ch}
      </span>
    );
  });

  return (
    <div
      ref={ref}
      className={fill ? "fallback-string fallback-string-fill" : "fallback-string"}
      style={fill ? ({ "--fallback-scale": scale } as CSSProperties) : undefined}
      aria-hidden
    >
      {/* 40 units tall in a box 40 × scale px tall (styles.css), so a unit is a
          scaled pixel and the curve's middle dips SAG, the same as the flags. */}
      <svg className="fallback-cord" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
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

const TABBABLE =
  'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Focus the nearest visible tab stop before `from` (or after, if none). */
function focusNeighbour(from: HTMLElement): void {
  const all = [...document.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (el) => el !== from && !el.closest("[inert]") && el.getClientRects().length > 0,
  );
  const before = all.filter((el) => el.compareDocumentPosition(from) & Node.DOCUMENT_POSITION_FOLLOWING);
  (before[before.length - 1] ?? all.find((el) => !before.includes(el)))?.focus();
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
    <svg className="fallback-pumpkin" viewBox="0 0 32 32" aria-hidden>
      <path className="fallback-stem" d="M15 4c1-2 4-2 5-1-2 1-3 3-3 5h-2z" />
      <path className="fallback-leaf" d="M18 7c2-3 6-3 8-1-2 2-5 3-8 1z" />
      <ellipse className="fallback-pumpkin-body" cx="10.5" cy="19" rx="7.5" ry="10" />
      <ellipse className="fallback-pumpkin-body" cx="21.5" cy="19" rx="7.5" ry="10" />
      <ellipse className="fallback-pumpkin-body fallback-pumpkin-front" cx="16" cy="19" rx="7" ry="10.5" />
    </svg>
  );
}

/** An alarm clock at two o'clock whose hands wind back to one: the minute hand turns once backwards. */
function Clock() {
  return (
    <svg className="fallback-clock" viewBox="0 0 40 40" aria-hidden>
      <circle className="fallback-clock-bell" cx="9" cy="8" r="5" />
      <circle className="fallback-clock-bell" cx="31" cy="8" r="5" />
      <circle className="fallback-clock-rim" cx="20" cy="22" r="15" />
      <circle className="fallback-clock-face" cx="20" cy="22" r="12" />
      <path className="fallback-clock-ticks" d="M20 11.5v2.5M30.5 22h-2.5M20 32.5v-2.5M9.5 22h2.5" />
      <line className="fallback-clock-hand fallback-clock-hour" x1="20" y1="22" x2="25.6" y2="18.8" />
      <line className="fallback-clock-hand fallback-clock-minute" x1="20" y1="22" x2="20" y2="12.5" />
      <circle className="fallback-clock-pin" cx="20" cy="22" r="1.4" />
    </svg>
  );
}
