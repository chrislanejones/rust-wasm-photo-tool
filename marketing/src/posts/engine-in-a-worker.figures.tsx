/* The animated figures of "The engine left the main thread".
 *
 *   <Scene kind="threads" />          FIG 1 — where things live now
 *   <Scene kind="doors" />            FIG 2 — three doors and the wall
 *   <Scene kind="canvas" controls />  FIG 4 — the transfer, in four beats
 *   <Queue />                         FIG 5 — the FIFO gate and the op log
 *
 * React owns the frame: the box, the caption slot, the fallback and FIG 4's
 * controls. The WebGL scenes themselves are imperative
 * (engine-in-a-worker.scenes.ts) and three.js is loaded with a dynamic import
 * the first time a scene comes near the viewport, so the ~400 kB it costs is
 * paid only on this post and only by a reader who scrolls to a figure.
 *
 * Prerender-safe by construction. scripts/prerender.mjs renders this under
 * Node, where there is no window, no matchMedia, no WebGL — so the render
 * path touches none of them. What the server emits is the framed box at the
 * right aspect ratio and the caption the post wraps around it; everything
 * that needs a browser happens in an effect, after hydration, and the first
 * client render is byte-identical to the server's.
 */

import { useEffect, useRef, useState } from "react";

import type { GlPalette, SceneHandle, SceneKind, ThreeSubset } from "./engine-in-a-worker.scenes";

/* ── three.js, once ─────────────────────────────────────────────────────── */
let threeP: Promise<ThreeSubset> | null = null;
const loadThree = () => (threeP ??= import("./engine-in-a-worker.three"));

/* ── colors ─────────────────────────────────────────────────────────────── *
 * The DOM parts of a figure read the tokens through CSS. WebGL cannot: a
 * material wants a number, and three 0.165's Color.setStyle parses rgb/hsl/hex
 * and named colors only — an oklch() token comes back as "Unknown color model".
 * So the tokens are resolved at mount by painting each one into a 1×1 canvas
 * and reading the pixel back, which is the browser's own oklch→sRGB, gamut
 * clipping included. Where that is unavailable the design's hex table stands.
 *
 * Only the ink and accent tokens are probed. The five surface colors are NOT
 * the tokens and are not meant to be: they are albedos under a hemisphere
 * light at 1.35 plus a key at 1.6, which brightens a lit face roughly 2.5×, so
 * the design set them lighter by eye — and the unlit edge lines (rule) have to
 * stay visible against the lit faces, where the real --color-rule at 28% L
 * would vanish. Those five come straight from the design.
 */
const TOKEN: Partial<Record<keyof GlPalette, string>> = {
  accent: "--color-accent",
  accent2: "--color-accent-2",
  ink: "--color-ink",
  ink2: "--color-ink-2",
  ink3: "--color-ink-3",
};

/** The design's WebGL palette. ink/accent are the tokens converted; the rest
 *  are lit-material albedos (see above). */
const DESIGN_HEX: GlPalette = {
  accent: 0xf09646,
  accent2: 0xef5a70,
  paper: 0x1c1512,
  paper2: 0x2a211c,
  paper3: 0x372c26,
  paper4: 0x4a3d35,
  rule: 0x6b5a50,
  ink: 0xf5efe6,
  ink2: 0xc4b8a8,
  ink3: 0x8a7f72,
};

/** Paint a CSS color and read it back as 0xRRGGBB, or null if the browser did
 *  not parse it. The sentinel catches the parse failure: an invalid fillStyle
 *  assignment is ignored, so the previous value would be read back as if it
 *  were the answer. */
function probe(ctx: CanvasRenderingContext2D, css: string): number | null {
  ctx.fillStyle = "#010203";
  ctx.fillStyle = css;
  if (ctx.fillStyle === "#010203") return null;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  if (a === 0) return null;
  return (r << 16) | (g << 8) | b;
}

export function resolvePalette(): GlPalette {
  const out = { ...DESIGN_HEX };
  try {
    const style = getComputedStyle(document.documentElement);
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return out;
    for (const key of Object.keys(TOKEN) as (keyof GlPalette)[]) {
      const value = style.getPropertyValue(TOKEN[key]!).trim();
      if (!value) continue;
      const hex = probe(ctx, value);
      if (hex !== null) out[key] = hex;
    }
  } catch {
    // The table stands. A scene in the wrong shade beats no scene.
  }
  return out;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── Scene ──────────────────────────────────────────────────────────────── */

type Status = "idle" | "loading" | "ready" | "failed";

export interface SceneProps {
  kind: SceneKind;
  /** FIG 4: play/pause, a scrubber and one button per beat. */
  controls?: boolean;
  /** Design-tool switches, kept for parity. Reduced motion overrides both. */
  animate?: boolean;
  labels?: boolean;
}

export function Scene({ kind, controls = false, animate = true, labels = true }: SceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [handle, setHandle] = useState<SceneHandle | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const slot = slotRef.current;
    if (!root || !slot) return;
    let scene: SceneHandle | null = null;
    let cancelled = false;

    // Pauses the loop while the figure is scrolled away. The loader below is
    // a separate observer because it wants a margin (start fetching before
    // the reader arrives) and this one wants the box itself.
    const onScreen = new IntersectionObserver(([e]) => scene?.setVisible(e.isIntersecting), {
      threshold: 0.05,
    });

    const near = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        near.disconnect();
        setStatus("loading");
        // Two chunks, fetched together: three.js and the scene builders. The
        // builders are their own chunk so that the other routes never carry
        // them either.
        Promise.all([loadThree(), import("./engine-in-a-worker.scenes")])
          .then(([T, { createScene }]) => {
            if (cancelled) return;
            scene = createScene({
              T,
              kind,
              colors: resolvePalette(),
              slot,
              stepEl: stepRef.current,
              animate: animate && !reducedMotion(),
              showLabels: labels,
              controls,
            });
            onScreen.observe(root);
            setHandle(scene);
            setStatus("ready");
          })
          .catch((err: unknown) => {
            if (cancelled) return;
            console.warn(`[scene:${kind}] WebGL scene unavailable`, err);
            setStatus("failed");
          });
      },
      { rootMargin: "25% 0px" },
    );
    near.observe(root);

    return () => {
      cancelled = true;
      near.disconnect();
      onScreen.disconnect();
      scene?.dispose();
      scene = null;
    };
  }, [kind, controls, animate, labels]);

  return (
    <div
      ref={rootRef}
      className={`scene scene--${kind}${controls ? " scene--controls" : ""}`}
      data-status={status}
    >
      <div className="scene__gl">
        {/* The canvas and the label layer are appended here by the scene
            runtime and never touched by React. Decorative: the caption in the
            post carries the meaning, and the labels would read as a jumble. */}
        <div ref={slotRef} className="scene__slot" aria-hidden="true" />
        {status === "failed" && (
          <div className="scene__fallback">
            3D diagram unavailable — WebGL or the network did not come through. The caption says
            what it shows.
          </div>
        )}
      </div>
      {controls && (
        <>
          {/* The beat's own sentence. Written by the scene; readable by
              everyone, which is why it is not inside the hidden slot. */}
          <div ref={stepRef} className="scene__step" />
          <div className="scene__bar">{handle && <Controls handle={handle} />}</div>
        </>
      )}
    </div>
  );
}

/* ── FIG 4's transport ──────────────────────────────────────────────────── */
function Controls({ handle }: { handle: SceneHandle }) {
  const [playing, setPlaying] = useState(handle.playing);
  const [active, setActive] = useState(-1);
  const sliderRef = useRef<HTMLInputElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  useEffect(
    () =>
      handle.subscribe((s) => {
        // The slider is left alone while it has focus: a reader dragging it
        // must not have it yanked back by the frame that just rendered.
        const slider = sliderRef.current;
        if (slider && document.activeElement !== slider) {
          slider.value = String(Math.round(s.frac * 1000));
          slider.setAttribute("aria-valuetext", `${s.seconds.toFixed(1)} seconds of ${s.period}`);
        }
        if (readoutRef.current) {
          readoutRef.current.textContent = `${s.seconds.toFixed(1)}s / ${s.period}s`;
        }
        setPlaying(s.playing);
        setActive(s.active);
      }),
    [handle],
  );

  return (
    <>
      <button
        type="button"
        className="scene__play"
        onClick={handle.toggle}
        aria-label={playing ? "Pause animation" : "Play animation"}
      >
        <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
      </button>
      <input
        ref={sliderRef}
        type="range"
        className="scene__scrub"
        min={0}
        max={1000}
        step={1}
        defaultValue={0}
        aria-label="Scrub the animation"
        onChange={(e) => handle.seek(e.currentTarget.valueAsNumber / 1000)}
      />
      <div className="scene__steps" role="group" aria-label="Jump to a step">
        {handle.chapters.map((ch, i) => (
          <button
            key={ch.label}
            type="button"
            className="scene__chip"
            title={ch.label}
            aria-label={`Jump to step ${i + 1}: ${ch.label}`}
            aria-current={i === active ? "step" : undefined}
            onClick={() => handle.jump(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <span ref={readoutRef} className="scene__readout" />
    </>
  );
}

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
