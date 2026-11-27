import { useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isBlackFridaySeason, readDismissed, writeDismissed } from "./season";

const MESSAGE = "BLACK FRIDAY";
/** Footprint along the cord at full size, margins included (see
 *  `.black-friday-flag*` and `.black-friday-gap`, which multiply the same
 *  numbers by `--black-friday-scale`). The gap between the words holds a
 *  star. */
const LETTER_PITCH = 56;
const BLANK_PITCH = 32;
const GAP_PITCH = 40;
/** How far the middle of the cord hangs below its ends, at full size. */
const SAG = 20;
/** Never shrink the letters below this, however narrow the bar. */
const MIN_SCALE = 0.4;
/** The letter flags take these colours in turn (see styles.css). */
const LETTER_COLOURS = ["", " black-friday-flag-red", " black-friday-flag-gold"];

/**
 * A "Black Friday" pennant garland: a shopping bag, a string of flags with a
 * star between the words, and a sale tag, shown from Black Friday through the
 * Sunday after (see season.ts). The layout is the Halloween garland's
 * (v9.46–v9.47), by way of the Thanksgiving one.
 *
 * Two placements, one garland:
 *  - `bar`: hangs under the editor's top bar and runs its full length. It is
 *    a child of the bar's surface, so it follows the bar's width as the side
 *    panels open and close, and it goes wherever the bar goes (the bar is not
 *    drawn in the dock layout, so neither is this).
 *  - `centered`: the start screen covers the top bar, so it carries its own
 *    copy at the top of the page, just the words.
 *
 * ACCESSIBILITY. The garland is one image named "Black Friday"; the flags,
 * bag, star and tag inside it are hidden from assistive tech, so the words
 * are read once rather than letter by letter. The X is a real, named, 24px
 * button with the app's focus ring, and closing it puts focus back on a
 * neighbouring control. The garland's motion (a sway, and the tag swinging)
 * stops under reduce-motion, and the X hides it outright (WCAG 2.2.2). The
 * bar copy is a sibling of the top bar's toolbar, not inside it, so it is not
 * announced as a toolbar control.
 *
 * Decoration only: the garland ignores the pointer, only the X takes a click,
 * and closing either copy closes both and is remembered for the rest of this
 * year's season. Outside the season nothing renders, so no release has to
 * take it down. The motion is CSS animation that the reduce-motion setting
 * and the OS preference both stop (see `.black-friday-garland` in styles.css).
 */
export function BlackFridayBanner({ placement }: { placement: "bar" | "centered" }) {
  const closed = useSyncExternalStore(subscribe, isClosed);
  if (closed || !isBlackFridaySeason(new Date())) return null;

  return (
    <div
      className={`black-friday-banner black-friday-banner-${placement}`}
      data-testid={`black-friday-banner-${placement}`}
    >
      <div className="black-friday-garland" role="img" aria-label="Black Friday">
        <ShoppingBag />
        <Pennants fill={placement === "bar"} />
        <SaleTag />
      </div>
      <Button
        size="tiny"
        className="black-friday-close"
        aria-label="Hide the Black Friday banner"
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
    const transform = `translateY(calc(${drop}px * var(--black-friday-scale))) rotate(${tilt}deg)`;
    if (ch === " ")
      return (
        <span key={i} className="black-friday-gap" style={{ transform }}>
          <Star />
        </span>
      );
    // Letters cycle black, red, gold; the plain filler flags alternate black
    // and red so the words stand out.
    const colour = ch ? LETTER_COLOURS[letter++ % LETTER_COLOURS.length] : i % 2 ? LETTER_COLOURS[1] : "";
    return (
      <span
        key={i}
        className={`black-friday-flag${ch ? "" : " black-friday-flag-blank"}${colour}`}
        style={{ transform }}
      >
        {ch}
      </span>
    );
  });

  return (
    <div
      ref={ref}
      className={fill ? "black-friday-string black-friday-string-fill" : "black-friday-string"}
      style={fill ? ({ "--black-friday-scale": scale } as CSSProperties) : undefined}
      aria-hidden
    >
      {/* 40 units tall in a box 40 × scale px tall (styles.css), so a unit is a
          scaled pixel and the curve's middle dips SAG, the same as the flags. */}
      <svg className="black-friday-cord" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
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

/** A red shopping bag with gold handles and a % on the front. */
function ShoppingBag() {
  return (
    <svg className="black-friday-bag" viewBox="0 0 32 32" aria-hidden>
      <path className="black-friday-bag-handle" d="M11 12V8.5a5 5 0 0 1 10 0V12" />
      <path className="black-friday-bag-body" d="M5 11h22l-2 18H7z" />
      <path className="black-friday-bag-mark" d="M19.5 16.5l-7 9" />
      <circle className="black-friday-bag-dot" cx="12.8" cy="17.6" r="1.8" />
      <circle className="black-friday-bag-dot" cx="19.2" cy="24.4" r="1.8" />
    </svg>
  );
}

/** A five-point star, hung in the gap between the two words. */
function Star() {
  return (
    <svg className="black-friday-star" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z" />
    </svg>
  );
}

/** A gold SALE tag on a string: it takes the bat's place at the end of the cord. */
function SaleTag() {
  return (
    <svg className="black-friday-tag" viewBox="0 0 40 40" aria-hidden>
      <path className="black-friday-tag-string" d="M3 2C6 8 8 13 11.5 20" />
      <g transform="rotate(-18 20 20)">
        <path className="black-friday-tag-body" d="M15 9h22v22H15L6 20z" />
        <circle className="black-friday-tag-hole" cx="11.5" cy="20" r="2" />
        <text className="black-friday-tag-text" x="26.5" y="22.4" textAnchor="middle">
          SALE
        </text>
      </g>
    </svg>
  );
}
