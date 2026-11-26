import { useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isThanksgivingSeason, readDismissed, writeDismissed } from "./season";

const MESSAGE = "HAPPY THANKSGIVING";
/** Footprint along the cord at full size, margins included (see
 *  `.thanksgiving-flag*` and `.thanksgiving-gap`, which multiply the same
 *  numbers by `--thanksgiving-scale`). The gap between the words holds a
 *  maple leaf. */
const LETTER_PITCH = 56;
const BLANK_PITCH = 32;
const GAP_PITCH = 40;
/** How far the middle of the cord hangs below its ends, at full size. */
const SAG = 20;
/** Never shrink the letters below this, however narrow the bar. */
const MIN_SCALE = 0.4;
/** The letter flags take these colours in turn (see styles.css). */
const LETTER_COLOURS = ["", " thanksgiving-flag-gold", " thanksgiving-flag-cranberry"];

/**
 * A "Happy Thanksgiving" pennant garland: a pumpkin, a string of flags with a
 * maple leaf between the words, and a turkey, shown in the days around the
 * fourth Thursday of November (see season.ts). The artwork and layout are the
 * Halloween garland's (v9.46–v9.47), with the bat swapped for a turkey and
 * the pumpkin's face left off.
 *
 * Two placements, one garland:
 *  - `bar`: hangs under the editor's top bar and runs its full length. It is
 *    a child of the bar's surface, so it follows the bar's width as the side
 *    panels open and close, and it goes wherever the bar goes (the bar is not
 *    drawn in the dock layout, so neither is this).
 *  - `centered`: the start screen covers the top bar, so it carries its own
 *    copy at the top of the page, just the words.
 *
 * ACCESSIBILITY. The garland is one image named "Happy Thanksgiving"; the
 * flags, pumpkin, leaf and turkey inside it are hidden from assistive tech,
 * so the words are read once rather than letter by letter. The X is a real,
 * named, 24px button with the app's focus ring, and closing it puts focus
 * back on a neighbouring control. The garland's motion (a sway, and the
 * turkey's wobble) stops under reduce-motion, and the X hides it outright
 * (WCAG 2.2.2). The bar copy is a sibling of the top bar's toolbar, not
 * inside it, so it is not announced as a toolbar control.
 *
 * Decoration only: the garland ignores the pointer, only the X takes a click,
 * and closing either copy closes both and is remembered for the rest of this
 * year's season. Outside the season nothing renders, so no release has to
 * take it down. The motion is CSS animation that the reduce-motion setting
 * and the OS preference both stop (see `.thanksgiving-garland` in styles.css).
 */
export function ThanksgivingBanner({ placement }: { placement: "bar" | "centered" }) {
  const closed = useSyncExternalStore(subscribe, isClosed);
  if (closed || !isThanksgivingSeason(new Date())) return null;

  return (
    <div
      className={`thanksgiving-banner thanksgiving-banner-${placement}`}
      data-testid={`thanksgiving-banner-${placement}`}
    >
      <div className="thanksgiving-garland" role="img" aria-label="Happy Thanksgiving">
        <Pumpkin />
        <Pennants fill={placement === "bar"} />
        <Turkey />
      </div>
      <Button
        size="tiny"
        className="thanksgiving-close"
        aria-label="Hide the Thanksgiving banner"
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
  let letter = 0;
  const flags = items.map((ch, i) => {
    // The cord sags: flags near the middle hang lower and the ones either
    // side tilt toward it, like a real garland.
    const t = ((x + pitch(ch) / 2) / total) * 2 - 1;
    x += pitch(ch);
    // In full-size pixels; the CSS scale shrinks the drop with the flag, so
    // the start-screen copy (scaled by media queries, not here) sags in step.
    const drop = Math.round(SAG * (1 - t * t));
    const tilt = Math.round(-t * 8);
    const transform = `translateY(calc(${drop}px * var(--thanksgiving-scale))) rotate(${tilt}deg)`;
    if (ch === " ")
      return (
        <span key={i} className="thanksgiving-gap" style={{ transform }}>
          <MapleLeaf />
        </span>
      );
    // Letters cycle orange, gold, cranberry; the plain filler flags alternate
    // orange and gold so the words stand out.
    const colour = ch ? LETTER_COLOURS[letter++ % LETTER_COLOURS.length] : i % 2 ? LETTER_COLOURS[1] : "";
    return (
      <span
        key={i}
        className={`thanksgiving-flag${ch ? "" : " thanksgiving-flag-blank"}${colour}`}
        style={{ transform }}
      >
        {ch}
      </span>
    );
  });

  return (
    <div
      ref={ref}
      className={fill ? "thanksgiving-string thanksgiving-string-fill" : "thanksgiving-string"}
      style={fill ? ({ "--thanksgiving-scale": scale } as CSSProperties) : undefined}
      aria-hidden
    >
      {/* 40 units tall in a box 40 × scale px tall (styles.css), so a unit is a
          scaled pixel and the curve's middle dips SAG, the same as the flags. */}
      <svg className="thanksgiving-cord" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
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

/** The Halloween pumpkin without its face, plus a leaf on the stem. */
function Pumpkin() {
  return (
    <svg className="thanksgiving-pumpkin" viewBox="0 0 32 32" aria-hidden>
      <path className="thanksgiving-stem" d="M15 4c1-2 4-2 5-1-2 1-3 3-3 5h-2z" />
      <path className="thanksgiving-pumpkin-leaf" d="M18 7c2-3 6-3 8-1-2 2-5 3-8 1z" />
      <ellipse className="thanksgiving-pumpkin-body" cx="10.5" cy="19" rx="7.5" ry="10" />
      <ellipse className="thanksgiving-pumpkin-body" cx="21.5" cy="19" rx="7.5" ry="10" />
      <ellipse className="thanksgiving-pumpkin-body thanksgiving-pumpkin-front" cx="16" cy="19" rx="7" ry="10.5" />
    </svg>
  );
}

/** A maple leaf, hung in the gap between the two words. */
function MapleLeaf() {
  return (
    <svg className="thanksgiving-leaf" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2L13.6 5.8 16.2 4.6 15.6 9.2 19.2 6.8 19.6 9.2 22.4 9.4 20.6 12.8 22 14 17 17.2 17.6 19.4 12.5 18.8V22h-1v-3.2L6.4 19.4 7 17.2 2 14 3.4 12.8 1.6 9.4 4.4 9.2 4.8 6.8 8.4 9.2 7.8 4.6 10.4 5.8z" />
    </svg>
  );
}

/** A turkey facing out, tail fanned: it takes the bat's place at the end of the cord. */
function Turkey() {
  const feathers = [
    { angle: -64, colour: "thanksgiving-feather-red" },
    { angle: -32, colour: "thanksgiving-feather-orange" },
    { angle: 0, colour: "thanksgiving-feather-gold" },
    { angle: 32, colour: "thanksgiving-feather-orange" },
    { angle: 64, colour: "thanksgiving-feather-red" },
  ];
  return (
    <svg className="thanksgiving-turkey" viewBox="0 0 40 40" aria-hidden>
      {feathers.map(({ angle, colour }) => (
        <ellipse
          key={angle}
          className={colour}
          cx="20"
          cy="12"
          rx="4.6"
          ry="10.5"
          transform={`rotate(${angle} 20 25)`}
        />
      ))}
      <path className="thanksgiving-turkey-feet" d="M17 32.5v4.5M23 32.5v4.5M15.5 37h3M21.5 37h3" />
      <ellipse className="thanksgiving-turkey-body" cx="20" cy="26.5" rx="8" ry="8" />
      <circle className="thanksgiving-turkey-head" cx="20" cy="17" r="4.6" />
      <circle className="thanksgiving-turkey-eye" cx="18.4" cy="16.2" r="0.85" />
      <circle className="thanksgiving-turkey-eye" cx="21.6" cy="16.2" r="0.85" />
      <path className="thanksgiving-turkey-beak" d="M18.8 18.3h2.4L20 20.4z" />
      <ellipse className="thanksgiving-turkey-wattle" cx="21.4" cy="21.4" rx="0.9" ry="1.9" />
    </svg>
  );
}
