/* The animated figures of "The hotel Wi-Fi died. The editor kept running."
 *
 *   <Scene kind="cut" />              FIG 1 — the cable is cut mid-edit
 *   <Scene kind="idb" controls />     FIG 2 — the IndexedDB round trip
 *   <Scene kind="cache" controls />   FIG 3 — the precache
 *   <Scene kind="cut" backdrop />     the header banner behind the headline
 *
 * Same split as engine-in-a-worker.figures.tsx: React owns the frame, the
 * WebGL scenes are imperative (offline-by-construction.scenes.ts), three.js
 * loads on a dynamic import the first time a scene nears the viewport, and
 * the whole thing is prerender-safe by construction — see that file's header
 * for the full rationale, which applies here unchanged.
 */

import { useEffect, useRef, useState } from "react";

import type { GlPalette, SceneHandle, SceneKind, ThreeSubset } from "./offline-by-construction.scenes";

/* ── three.js, once ─────────────────────────────────────────────────────── */
let threeP: Promise<ThreeSubset> | null = null;
const loadThree = () => (threeP ??= import("./offline-by-construction.three"));

/* ── colors ─────────────────────────────────────────────────────────────── *
 * See engine-in-a-worker.figures.tsx's resolvePalette for why this probes the
 * tokens through a 1×1 canvas rather than trusting three's Color.setStyle.
 */
const TOKEN: Partial<Record<keyof GlPalette, string>> = {
  accent: "--color-accent",
  accent2: "--color-accent-2",
  ink: "--color-ink",
  ink2: "--color-ink-2",
  ink3: "--color-ink-3",
};

/** The design's WebGL palette. ink/accent are the tokens converted; the rest
 *  are lit-material albedos, straight from the design (see the sibling file). */
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

function afterLoadAndIdle(fn: () => void): () => void {
  let cancelIdle = () => {};
  const idle = () => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(fn, { timeout: 2000 });
      cancelIdle = () => window.cancelIdleCallback(id);
    } else {
      const id = window.setTimeout(fn, 200);
      cancelIdle = () => window.clearTimeout(id);
    }
  };
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
  return () => {
    window.removeEventListener("load", idle);
    cancelIdle();
  };
}

/* ── Scene ──────────────────────────────────────────────────────────────── */

type Status = "idle" | "loading" | "ready" | "failed";

export interface SceneProps {
  kind: SceneKind;
  /** FIG 2 and FIG 3: play/pause, a scrubber and one button per beat. */
  controls?: boolean;
  animate?: boolean;
  labels?: boolean;
  /** The post's header banner rather than a figure. See SceneProps in
   *  engine-in-a-worker.figures.tsx for the full rationale. */
  backdrop?: boolean;
}

export function Scene({ kind, controls = false, animate = true, labels = true, backdrop = false }: SceneProps) {
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

    const onScreen = new IntersectionObserver(([e]) => scene?.setVisible(e.isIntersecting), {
      threshold: 0.05,
    });

    const near = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        near.disconnect();
        setStatus("loading");
        Promise.all([loadThree(), import("./offline-by-construction.scenes")])
          .then(([T, { createScene }]) => {
            if (cancelled) return;
            scene = createScene({
              T,
              kind,
              colors: resolvePalette(),
              slot,
              stepEl: stepRef.current,
              animate: animate && !reducedMotion(),
              showLabels: labels && !backdrop,
              controls,
              backdrop,
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
    let cancelWait = () => {};
    if (backdrop) cancelWait = afterLoadAndIdle(() => near.observe(root));
    else near.observe(root);

    return () => {
      cancelled = true;
      cancelWait();
      near.disconnect();
      onScreen.disconnect();
      scene?.dispose();
      scene = null;
    };
  }, [kind, controls, animate, labels, backdrop]);

  return (
    <div
      ref={rootRef}
      className={`scene scene--${kind}${controls ? " scene--controls" : ""}${backdrop ? " scene--backdrop" : ""}`}
      data-status={status}
    >
      <div className="scene__gl">
        <div ref={slotRef} className="scene__slot" aria-hidden="true" />
        {status === "failed" && !backdrop && (
          <div className="scene__fallback">
            3D diagram unavailable — WebGL or the network did not come through. The caption says
            what it shows.
          </div>
        )}
      </div>
      {controls && (
        <>
          <div ref={stepRef} className="scene__step" />
          <div className="scene__bar">{handle && <Controls handle={handle} />}</div>
        </>
      )}
    </div>
  );
}

function Controls({ handle }: { handle: SceneHandle }) {
  const [playing, setPlaying] = useState(handle.playing);
  const [active, setActive] = useState(-1);
  const sliderRef = useRef<HTMLInputElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);

  useEffect(
    () =>
      handle.subscribe((s) => {
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
