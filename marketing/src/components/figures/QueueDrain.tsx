import { useEffect, useRef } from "react";
import { seg } from "./figureTokens";
import { useMediaQuery } from "../../useMediaQuery";

/* Gate 3, animated: sixteen mutations posted with no await between them, and an
 * op log that comes out byte-identical anyway.
 *
 * Flat DOM, not WebGL. Sixteen labelled chips moving along two axes is a
 * layout problem, not a lighting one — and the chips carry text (`id7`,
 * `cancelled`) that has to stay crisp and selectable at any size, which is
 * exactly what the 3D scenes give up by projecting their labels.
 *
 * ── every number here is from the repository ──────────────────────────────
 * docs/engine-worker-a12-design.md, "The concurrent burst — this is the actual
 * gate": 16 mutations in flight at once, ids 1..16 returned in order, 7 ops,
 * 910 bytes, op-log SHA-256 `ea77112d…` on both sides. The cancellation
 * behaviour is engine.worker.ts's: `drain()` pulls a request, finds its id in
 * the `cancelled` set, and replies `{ ok: false, error: "canceled" }`. It is
 * rejected when its turn comes, not quietly dropped from the queue — which is
 * why the chip travels to the log column and is refused there rather than
 * vanishing in the middle one.
 *
 * ── the prototype showed ten ─────────────────────────────────────────────
 * The design mock animated ten chips under a header that said sixteen, because
 * sixteen would not fit in a 340px box. Rather than keep a figure that
 * undercounts its own claim, the box is taller and all sixteen are here.
 */

/** Mutations in the burst. Not a tunable — it is the gate's own number. */
const N = 16;

/** The id cancelled mid-flight, to show a rejection landing in order. */
const CANCELLED = 6;

/** Seconds per loop. Everything below is placed inside this. */
const PERIOD = 12;

/* The four movements, in seconds.
 * Tuned so the result — the hash line — is on screen for about three seconds
 * before the loop restarts. At the prototype's 0.5s drain step, sixteen chips
 * finish at 11.4 of 12 and the payoff flashes past unread. */
const SPAWN_STEP = 0.05;
const QUEUE_AT = 1.4;
const QUEUE_STEP = 0.06;
const DRAIN_AT = 3.0;
const DRAIN_STEP = 0.35;
/** When the last chip has landed and the footer can state the result. */
const SETTLED = DRAIN_AT + N * DRAIN_STEP + 0.4;

/** The still a reader who asked for no motion gets: after SETTLED, so the
 *  figure shows the finished log and the hash that is the whole point of it. */
const FROZEN_T = SETTLED + 1;

export default function QueueDrain() {
  const host = useRef<HTMLDivElement>(null);
  const chips = useRef<(HTMLDivElement | null)[]>([]);
  const foot = useRef<HTMLParagraphElement>(null);
  const frozen = useMediaQuery("(prefers-reduced-motion: reduce)", true);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    // Paused while off screen. Sixteen transform writes a frame is cheap, but
    // it is not free, and a reader four screens away is not watching.
    let visible = true;
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.05 });
    io?.observe(el);

    let raf = 0;
    const start = performance.now();
    let painted = false;

    const draw = (tt: number) => {
      const box = el.getBoundingClientRect();
      const W = box.width || 700;
      const H = box.height || 430;
      const t = tt % PERIOD;

      // Lanes, as fractions of the width. The queue and log columns line up
      // with the headers and the two dashed seams in the markup.
      const xFlight = W * 0.03;
      const xQueue = W * 0.36;
      const xLog = W * 0.7;
      const top = 62;
      const rowH = Math.min(22, (H - 132) / N);

      let logged = 0;
      let rejected = false;

      // How many have been pulled off the front of the queue so far. The
      // remaining chips shuffle up by this much, which is what makes the queue
      // visibly drain rather than just empty.
      const drained = Math.max(0, Math.min(N, Math.floor((t - DRAIN_AT) / DRAIN_STEP) + 1));

      chips.current.forEach((chip, i) => {
        if (!chip) return;
        const id = i + 1;
        const isCancelled = id === CANCELLED;

        /* 1 · in flight. All sixteen are posted before any is handled, so they
           scatter rather than queue: the disorder is the point of the gate. */
        const spawn = 0.05 + i * SPAWN_STEP;
        const appear = seg(t, spawn, spawn + 0.35);
        const flightY = top + ((i * 7) % N) * rowH * 0.9 + 6;
        const flightX = xFlight + 20 + ((i * 37) % 5) * (W * 0.03);

        /* 2 · landing in the queue, in post order — not arrival-of-reply
           order, which is the distinction the whole figure exists to draw. */
        const queued = seg(t, QUEUE_AT + i * QUEUE_STEP, QUEUE_AT + 0.6 + i * QUEUE_STEP);
        const queueY = top + Math.max(0, i - drained) * rowH;

        /* 3 · drained, one at a time, into the log. */
        const dStart = DRAIN_AT + i * DRAIN_STEP;
        const drainedOut = seg(t, dStart, dStart + 0.45);

        let x = flightX;
        let y = flightY;
        if (queued > 0) {
          x = flightX + (xQueue - flightX) * queued;
          y = flightY + (queueY - flightY) * queued;
        }
        if (drainedOut > 0) {
          // A rejection does not take a slot in the log. It is parked at the
          // bottom instead, so the appended rows stay a contiguous run of the
          // ops that actually landed.
          const targetY = isCancelled ? top + (N - 1) * rowH : top + logged * rowH;
          x = xQueue + (xLog - xQueue) * drainedOut;
          y = top + (targetY - top) * drainedOut;
        }
        if (drainedOut >= 1) {
          if (isCancelled) rejected = true;
          else logged++;
        }

        chip.style.opacity = String(t < spawn ? 0 : appear);
        chip.style.transform = `translate(${x}px, ${y}px)`;
        // `state` drives the colour in CSS rather than six style writes here.
        chip.dataset.state =
          drainedOut >= 1 ? (isCancelled ? "rejected" : "appended") : queued >= 1 ? "queued" : "flight";

        if (isCancelled) {
          chip.textContent = drainedOut > 0.5 ? "cancelled" : t > 1.0 ? `id${id} ✕` : `id${id}`;
        }
      });

      if (foot.current) {
        foot.current.textContent =
          t < QUEUE_AT
            ? `in flight: ${Math.min(N, Math.floor((t - 0.05) / SPAWN_STEP) + 1)} · replies pending`
            : t < DRAIN_AT
              ? `queued in post order · cancel(${CANCELLED}) received before it ran`
              : `appended: ${logged}${rejected ? " · rejected: 1 (cancelled)" : ""}` +
                (t > SETTLED ? " · 7 ops · 910 bytes · oplog sha256 ea77112d… byte-identical to the local engine" : "");
      }
    };

    // The static case draws exactly one frame and stops — no loop to leave
    // running behind a reader who asked for no motion.
    if (frozen) {
      draw(FROZEN_T);
      return () => io?.disconnect();
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible && painted) return;
      draw((now - start) / 1000);
      painted = true;
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [frozen]);

  return (
    /* aria-hidden for the same reason as the 3D scenes: read in DOM order this
       is "id1 id2 … cancelled … id16", which is not the finding. The
       <figcaption> beside it states what the burst proved, and the numbers are
       in the spec table above it. */
    <div className="fig-queue" ref={host} aria-hidden="true">
      <div className="fig-queue__cols">
        <p className="fig-queue__col">
          Main thread
          <span>{N} calls, no await between them</span>
        </p>
        <p className="fig-queue__col fig-queue__col--accent">
          Worker queue
          <span>drain() · FIFO · one at a time</span>
        </p>
        <p className="fig-queue__col">
          OpLog::append
          <span>arrival order · no sequence numbers</span>
        </p>
      </div>

      <span className="fig-queue__seam" data-at="queue" />
      <span className="fig-queue__seam" data-at="log" />
      <span className="fig-queue__boundary">postMessage</span>

      {Array.from({ length: N }, (_, i) => (
        <div
          key={i}
          className="fig-queue__chip"
          data-wide={i + 1 === CANCELLED ? true : undefined}
          data-state="flight"
          ref={(node) => {
            chips.current[i] = node;
          }}
        >
          {`id${i + 1}`}
        </div>
      ))}

      <p className="fig-queue__foot" ref={foot} />
    </div>
  );
}
