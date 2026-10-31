import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBreakpoint } from "@/lib/useBreakpoint";
import { isHalloweenSeason, readDismissed, writeDismissed } from "./season";

const WORDS = ["HAPPY", "HALLOWEEN"];

/**
 * A small "Happy Halloween" pennant garland — a pumpkin, a string of flags,
 * a bat — hung at the top of the editor during the last week of October.
 *
 * Decoration only, so it stays out of the way: the garland ignores the
 * pointer (clicks fall through to whatever is under it), only the X takes a
 * click, and closing it is remembered for the rest of this year's season.
 * After October 31 it renders nothing, so no release has to take it down.
 * The sway is a CSS animation, which the reduce-motion setting and the OS
 * preference both stop (see `.halloween-garland` in styles.css).
 *
 * Full desktop layout only. In the compact dock layout (≤ BP_COMPACT) the
 * side panel reaches the top of the window and the garland would hang across
 * its tool icons, so it simply does not show there.
 */
export function HalloweenBanner() {
  const [now] = useState(() => new Date());
  const [closed, setClosed] = useState(() => readDismissed(safeStorage(), now));
  const { dock } = useBreakpoint();

  if (closed || dock || !isHalloweenSeason(now)) return null;

  const letters = WORDS.flatMap((w, wi) => [...(wi ? [" "] : []), ...w.split("")]);
  const mid = (letters.length - 1) / 2;

  return (
    <div className="halloween-banner" data-testid="halloween-banner">
      <div className="halloween-garland" role="img" aria-label="Happy Halloween">
        <Pumpkin />
        <div className="halloween-string" aria-hidden>
          {letters.map((ch, i) => {
            // The string sags: flags near the middle hang lower and the ones
            // either side tilt toward it, like a real garland.
            const t = (i - mid) / mid;
            const drop = Math.round(10 * (1 - t * t));
            const tilt = Math.round(-t * 8);
            if (ch === " ") return <span key={i} className="halloween-gap" />;
            return (
              <span
                key={i}
                className={i % 2 ? "halloween-flag halloween-flag-purple" : "halloween-flag"}
                style={{ transform: `translateY(${drop}px) rotate(${tilt}deg)` }}
              >
                {ch}
              </span>
            );
          })}
        </div>
        <Bat />
      </div>
      <Button
        size="xs"
        className="halloween-close"
        aria-label="Hide the Halloween banner"
        onClick={() => {
          writeDismissed(safeStorage(), now);
          setClosed(true);
        }}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
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
