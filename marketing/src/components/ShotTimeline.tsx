import { useEffect, useRef, useState } from "react";
import Slider from "./Slider";
import type { Shot } from "../data/shots";
import { external } from "../config";

/* The hero shot, with a handle on its own history.
 *
 * Drag the rail and the frame walks back through the app's own releases — the
 * same editor, six months younger, then younger again, and past the bottom of
 * the run it isn't this app at all but the two it grew out of. Every frame is a
 * real capture recovered from GitHub and linked back to the commit it came from
 * (see src/data/shots.ts), so the run is a record rather than an illustration.
 *
 * ── the two things this must not cost ────────────────────────────────────
 * 1. LAYOUT. The frames are stacked in one box whose aspect ratio is fixed in
 *    CSS, and the captions are stacked the same way, so no stop can resize
 *    anything — measured at 1440, 900 and 390px, the frame and the rail are the
 *    same height at all eight. CLS on load is 0, and scrubbing moves nothing
 *    below the hero. The prerendered HTML is still one <img>, the same one.
 * 2. BYTES. On load the page downloads exactly ONE screenshot — today's, still
 *    eager and still fetchPriority="high", because it is the LCP element and
 *    nothing here is allowed to demote it. Older frames have no `src` at all
 *    until someone reaches for the rail; then its neighbours load, and the rest
 *    of the run trickles in on idle time. A reader who never touches the slider
 *    pays nothing for it beyond this component's markup.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2025-09-02" → "Sep 2025". Split off the string rather than parsed through
 *  `new Date(iso)`, which reads a bare ISO date as UTC midnight and then prints
 *  it in the reader's own zone — west of Greenwich that lands a month early.
 *  (The same reasoning, and the same fix, as the dates on /trail-log.) */
const monthYear = (iso: string) => {
  const [y, m] = iso.split("-");
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
};

interface ShotTimelineProps {
  shots: Shot[];
}

export default function ShotTimeline({ shots }: ShotTimelineProps) {
  const last = shots.length - 1;
  const [i, setI] = useState(last);
  // Which frames are allowed a `src`. Today's is in from the start; the rest
  // earn their place by being asked for.
  const [wanted, setWanted] = useState<readonly number[]>([last]);
  const idle = useRef<number | null>(null);

  const shot = shots[i];

  const goTo = (next: number) => {
    setI(next);
    // The neighbours, so the next step of a drag is already decoded.
    setWanted((w) =>
      [next - 1, next, next + 1].reduce<number[]>(
        (acc, n) => (n >= 0 && n <= last && !acc.includes(n) ? [...acc, n] : acc),
        [...w],
      ),
    );
  };

  // First touch of the rail buys the whole run — but on idle time, after the
  // page has finished the work that matters. ~550 KB of small WebPs is a cheap
  // thing to have ready; it is only expensive if it competes with first paint.
  useEffect(() => {
    if (wanted.length <= 1 || idle.current !== null) return;
    const schedule = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
    idle.current = schedule(() => setWanted(shots.map((_, n) => n))) as number;
  }, [wanted.length, shots]);

  return (
    /* One grid child, not two: the hero's own gap is 2.5rem — right between a
       headline and a picture, far too much between a picture and the control
       that drives it. Wrapping the pair lets them sit a --space-md apart and
       still travel together. */
    <div className="shot-run">
      <figure className="hero__shot shot-frame">
        <div className="shot-stack">
          {shots.map((s, n) => {
            const current = n === i;
            /* An unwanted frame is not an <img> with no src — that is invalid
               markup, and seven of them would ship in the prerendered HTML of a
               page that needs exactly one. It simply isn't in the DOM yet. */
            if (!wanted.includes(n)) return null;
            return (
              <img
                key={s.src}
                className="shot-stack__frame"
                src={s.src}
                width={s.width}
                height={s.height}
                /* Today's frame is the LCP image and keeps exactly the loading
                   behaviour it had before the rail existed. */
                loading={n === last ? "eager" : "lazy"}
                fetchPriority={n === last ? "high" : "low"}
                decoding="async"
                data-current={current || undefined}
                /* Only the visible frame is in the accessibility tree — a whole
                   stack of alt texts would otherwise be read out at once. */
                aria-hidden={!current || undefined}
                alt={current ? s.alt : ""}
              />
            );
          })}
        </div>
      </figure>

      <div className="timeline">
        <div className="timeline__scrub">
          <div>
            <Slider
              value={i}
              onValueChange={goTo}
              max={last}
              ticks
              label="Show the editor as it looked at an earlier release"
              valueText={`${shot.dateLabel} — ${shot.note}`}
            />
            <p className="timeline__ends">
              <span>{monthYear(shots[0].date)}</span>
              <span>{monthYear(shots[last].date)}</span>
            </p>
          </div>
          <p className="timeline__now">
            <span className="timeline__stamp">{shot.dateLabel}</span>
            <span className="timeline__count">
              {i + 1} of {shots.length}
            </span>
          </p>
        </div>

        {/* The caption is the payload — the picture alone doesn't say what
            changed. Every caption is in the DOM at once, stacked in one grid
            cell, so the block is always as tall as the LONGEST of them and a
            two-line stop can't shove the rest of the page down when you scrub
            onto it. (A min-height in lines was the first try; captions run to
            two lines on a desktop and three on a phone, and guessing which is
            how you ship a jump at one width and a gap at another.)
            The hidden ones are `visibility: hidden`, which keeps their size,
            takes their links out of the tab order, and leaves the screen
            reader with exactly one caption — the slider already speaks this
            sentence through aria-valuetext, so there's no live region to
            double it up. */}
        <div className="timeline__caption">
          {shots.map((s, n) => (
            <p
              key={s.src}
              className="timeline__line"
              data-current={n === i || undefined}
              aria-hidden={n !== i || undefined}
            >
              <span>{s.note}</span>
              <a className="timeline__source" href={s.href} {...external}>
                {s.sourceLabel} ↗
              </a>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
