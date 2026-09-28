/* The figures of "The engine left the main thread".
 *
 *   <Scene kind="threads" />          FIG 1 — where things live now
 *   <Scene kind="doors" />            FIG 2 — three doors and the wall
 *   <Scene kind="canvas" controls />  FIG 4 — the transfer, in four beats
 *   <Queue />                         FIG 5 — the FIFO gate and the op log
 *   <Scene kind="threads" backdrop /> the header banner behind the headline
 *
 * The four scenes use the blog's shared frame (scene/figure.tsx) bound to
 * this post's builders. The queue is the one figure on the blog that is not a
 * scene — a DOM timeline — so it lives here, with its rules in
 * engine-in-a-worker.figures.css.
 */

import { useEffect, useRef } from "react";

import { reducedMotion, sceneFigure } from "./scene/figure";

export const Scene = sceneFigure(() => import("./engine-in-a-worker.scenes"));

/* ── Queue ──────────────────────────────────────────────────────────────── *
 * Ten chips stand in for the sixteen mutations of gate 3. Posted with no
 * await, they scatter in flight, land in the worker's queue in post order,
 * and drain one at a time into the op log — where the canceled id is
 * rejected rather than skipped. A DOM timeline, no WebGL.
 */
const N = 10;
const CANCELED = 6;
/** Chip height, matching `.queue__chip` in the stylesheet. The timeline has to
 *  know it to keep the bottom row clear of the footer. */
const CHIP_H = 24;
const PERIOD = 12;
/** The frame shown under reduced motion: everything drained, the hash line up. */
const FROZEN_AT = 9.4;

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));

export function Queue({ animate = true }: { animate?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const footRef = useRef<HTMLSpanElement>(null);
  const shaRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const chips = chipRefs.current.filter((c): c is HTMLDivElement => c !== null);
    const live = animate && !reducedMotion();

    const draw = (tt: number) => {
      const W = root.clientWidth || 700;
      const H = root.clientHeight || 340;
      const t = ((tt % PERIOD) + PERIOD) % PERIOD;
      // The band the chips get is measured, not assumed.
      //
      // The design took the row pitch from `(H - 130) / N`, where 130 stands in
      // for the headings above and the footer below. That holds at the width it
      // was drawn at and nowhere else: on a phone the three column headings wrap
      // to three lines each, the band starts 106px down instead of 64, and the
      // last two chips finish on top of the footer. Measuring both ends costs a
      // pair of offsetHeights per frame and cannot drift from the layout.
      const top0 = (headRef.current?.offsetHeight ?? 40) + 24;
      const footH = footRef.current?.parentElement?.offsetHeight ?? 40;
      const floor = H - footH - 20;
      const rowH = Math.max(12, Math.min(30, (floor - top0 - CHIP_H) / (N - 1)));
      const xLeft = W * 0.03;
      const xQueue = W * 0.36;
      const xLog = W * 0.7;
      let logged = 0;
      let rejected = false;
      chips.forEach((c, i) => {
        const id = i + 1;
        // 0–1.2 s: burst out, scattered — all in flight at once
        const spawn = 0.05 + i * 0.05;
        const a = seg(t, spawn, spawn + 0.35);
        const jitterY = top0 + ((i * 7) % N) * rowH * 0.9 + 6;
        const jitterX = xLeft + 20 + ((i * 37) % 5) * (W * 0.03);
        // 1.4–2.6 s: land in the queue, in post order
        const q = seg(t, 1.4 + i * 0.06, 2.0 + i * 0.06);
        // from 3.0 s: drain, one every half second
        const dStart = 3.0 + i * 0.5;
        const d = seg(t, dStart, dStart + 0.45);
        const isCancel = id === CANCELED;
        const drained = Math.max(0, Math.min(N, Math.floor((t - 3.0) / 0.5) + 1));
        const queueY = top0 + Math.max(0, i - drained) * rowH;
        let x = jitterX;
        let y = jitterY;
        if (q > 0) {
          x = jitterX + (xQueue - jitterX) * q;
          y = jitterY + (queueY - jitterY) * q;
        }
        if (d > 0) {
          const ty = isCancel ? top0 + (N - 1) * rowH : top0 + logged * rowH;
          x = xQueue + (xLog - xQueue) * d;
          y = top0 + (ty - top0) * d;
        }
        if (d >= 1 && !isCancel) logged++;
        if (d >= 1 && isCancel) rejected = true;
        c.style.opacity = t < spawn ? "0" : String(a);
        c.style.transform = `translate(${x}px, ${y}px)`;
        const phase = d >= 1 ? (isCancel ? "rejected" : "logged") : q >= 1 ? "queued" : "flight";
        if (c.dataset.phase !== phase) c.dataset.phase = phase;
        if (isCancel) {
          const state = d > 0.5 ? "done" : t > 1.0 ? "flagged" : "";
          if (c.dataset.state !== state) c.dataset.state = state;
        }
      });
      const done = t > 3.0 + N * 0.5 + 0.4;
      const foot =
        t < 1.4
          ? `in flight: ${Math.min(N, Math.floor((t - 0.05) / 0.05) + 1)} · replies pending`
          : t < 3.0
            ? `queued in post order · cancel(${CANCELED}) received before it ran`
            : `appended: ${logged}${rejected ? " · rejected: 1 (canceled)" : ""}`;
      const sha = done ? "oplog sha256 ea77112d… — byte-identical to the local engine" : "";
      if (footRef.current && footRef.current.textContent !== foot) footRef.current.textContent = foot;
      if (shaRef.current && shaRef.current.textContent !== sha) shaRef.current.textContent = sha;
    };

    let t = 0;
    let last = 0;
    let visible = true;
    let dirty = true;
    let renderedOnce = false;
    let stopped = false;
    let raf = 0;
    const frame = (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (!live) {
        if (!visible || (renderedOnce && !dirty)) return;
        draw(FROZEN_AT);
        renderedOnce = true;
        dirty = false;
        return;
      }
      const running = visible && !document.hidden;
      if (!running && renderedOnce && !dirty) return;
      if (running) t += dt;
      draw(t);
      renderedOnce = true;
      dirty = false;
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !visible) last = 0;
        visible = e.isIntersecting;
      },
      { threshold: 0.05 },
    );
    io.observe(root);
    const ro = new ResizeObserver(() => {
      dirty = true;
    });
    ro.observe(root);
    raf = requestAnimationFrame(frame);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, [animate]);

  return (
    <div ref={rootRef} className="queue">
      <div ref={headRef} className="queue__head">
        <div className="queue__col queue__col--main">
          Main thread
          <span className="queue__sub">16 calls, no await between them</span>
        </div>
        <div className="queue__col queue__col--worker">
          Worker queue
          <span className="queue__sub">drain() · FIFO · one at a time</span>
        </div>
        <div className="queue__col queue__col--log">
          OpLog::append
          <span className="queue__sub">arrival order · no sequence numbers</span>
        </div>
      </div>
      <div className="queue__seam queue__seam--a" aria-hidden="true" />
      <div className="queue__seam queue__seam--b" aria-hidden="true" />
      <span className="queue__boundary" aria-hidden="true">
        postMessage
      </span>
      {/* Decorative: the footer and the caption say what happened. */}
      <div className="queue__chips" aria-hidden="true">
        {Array.from({ length: N }, (_, i) => {
          const id = i + 1;
          const cancel = id === CANCELED;
          return (
            <div
              key={id}
              ref={(el) => {
                chipRefs.current[i] = el;
              }}
              className="queue__chip"
              data-cancel={cancel ? "" : undefined}
            >
              <span className="queue__key">id</span>
              <span className="queue__num">{id}</span>
              {cancel && (
                <>
                  <span className="queue__x">✕</span>
                  <span className="queue__done">canceled</span>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="queue__foot">
        <span ref={footRef} />
        <span ref={shaRef} className="queue__sha" />
      </div>
    </div>
  );
}
