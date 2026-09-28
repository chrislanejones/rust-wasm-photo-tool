/* The frame every WebGL figure on the blog renders into.
 *
 * React owns the frame: the box, the caption slot, the fallback and a
 * `controls` scene's transport. The scenes themselves are imperative (kit.ts,
 * plus each post's builders), and three.js is loaded with a dynamic import the
 * first time a scene comes near the viewport, so the ~400 kB it costs is paid
 * only on a post that has one. A header banner is a scene that is in view from
 * the start, so every reader of that post pays it, after the page has loaded
 * (see `backdrop` below). No other page ever requests it.
 *
 * A post binds its builders once, in its own figures.tsx:
 *
 *   export const Scene = sceneFigure(() => import("./my-post.scenes"));
 *
 * and uses <Scene kind="…" /> in its body. The stylesheet comes with this
 * module (scene.css), so a post imports no CSS to get a working figure.
 *
 * Prerender-safe by construction. scripts/prerender.mjs renders this under
 * Node, where there is no window, no matchMedia, no WebGL — so the render
 * path touches none of them. What the server emits is the framed box at the
 * right aspect ratio and the caption the post wraps around it; everything
 * that needs a browser happens in an effect, after hydration, and the first
 * client render is byte-identical to the server's.
 */


import { useEffect, useRef, useState } from "react";

import type { GlPalette, SceneHandle, SceneOptions, ThreeSubset } from "./kit";
import "./scene.css";

/* ── three.js, once ─────────────────────────────────────────────────────── */
let threeP: Promise<ThreeSubset> | null = null;
const loadThree = () => (threeP ??= import("./three"));

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

function resolvePalette(): GlPalette {
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

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Run `fn` once the page has finished loading and the browser has a spare
 *  moment. Returns a cancel. */
function afterLoadAndIdle(fn: () => void): () => void {
  let cancelIdle = () => {};
  const idle = () => {
    // Typed as always present, and it is not: Safari keeps it behind a flag.
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

export interface SceneProps<K extends string = string> {
  kind: K;
  /** Play/pause, a scrubber and one button per beat. */
  controls?: boolean;
  /** Design-tool switches, kept for parity. Reduced motion overrides both. */
  animate?: boolean;
  labels?: boolean;
  /**
   * A post's header banner rather than a figure. It fills its positioned
   * parent with no frame, no labels and no fallback text: there is no caption
   * to explain it, and if WebGL fails the header's own gradient is already
   * the right picture.
   *
   * It also loads later. A figure is fetched when it nears the viewport, and a
   * banner is in the viewport at load by definition, so the same rule would
   * put three.js (~116 KB gzipped) in the same breath as the fonts and the
   * main bundle. A backdrop waits for the load event and an idle moment.
   */
  backdrop?: boolean;
}

/** What a post's `*.scenes.ts` exports: its builders, bound to the runtime. */
export interface SceneModule<K extends string> {
  createScene(o: SceneOptions<K>): SceneHandle;
}

/** A post's `<Scene>`: the shared frame, bound to that post's builders.
 *
 *    export const Scene = sceneFigure(() => import("./my-post.scenes"));
 *
 *  The loader is a dynamic import so each post's builders stay their own
 *  chunk — the other routes never carry them, and neither do the other posts. */
export function sceneFigure<K extends string>(loadScenes: () => Promise<SceneModule<K>>) {
  return function Scene(props: SceneProps<K>) {
    return <SceneFrame {...props} loadScenes={loadScenes} />;
  };
}

function SceneFrame<K extends string>({
  kind,
  controls = false,
  animate = true,
  labels = true,
  backdrop = false,
  loadScenes,
}: SceneProps<K> & { loadScenes: () => Promise<SceneModule<K>> }) {
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
        Promise.all([loadThree(), loadScenes()])
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
  }, [kind, controls, animate, labels, backdrop, loadScenes]);

  return (
    <div
      ref={rootRef}
      className={`scene scene--${kind}${controls ? " scene--controls" : ""}${backdrop ? " scene--backdrop" : ""}`}
      data-status={status}
    >
      <div className="scene__gl">
        {/* The canvas and the label layer are appended here by the scene
            runtime and never touched by React. Decorative: the caption in the
            post carries the meaning, and the labels would read as a jumble. */}
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
          {/* The beat's own sentence. Written by the scene; readable by
              everyone, which is why it is not inside the hidden slot. */}
          <div ref={stepRef} className="scene__step" />
          <div className="scene__bar">{handle && <Controls handle={handle} />}</div>
        </>
      )}
    </div>
  );
}

/* ── the transport, for a `controls` scene ──────────────────────────────────────────────────── */
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

