import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

// Standalone "actual histogram" component. It owns ONLY the histogram itself:
// pulling the per-channel distributions and painting the plot. It carries its
// own styling (inline — no styles.css dependency) so the surrounding panel
// ("the box") can drop it in without any shared-CSS coupling.
//
// The per-channel counts are computed in Rust (`calculate_histogram`) straight
// from the authoritative composite buffer — NO offscreen drawImage /
// getImageData / per-pixel JS loop (that ran every resample and spiked GC).
//
// Switching photos used to flash "No image" for a frame because we re-sampled
// the instant the signature changed — before the freshly-selected photo had
// finished compositing, so the read came back all-zero. Now, when you CYCLE TO
// A DIFFERENT PHOTO, the bars fall straight down to the baseline and stay there
// until the new photo has composited — however long that takes — then rise back
// up into its shape (only declaring "empty" — gently faded in — if the slot
// genuinely never produces data). An in-place EDIT of the same photo keeps the
// smooth morph from the old shape to the new one, since its data is ready at
// once and a collapse-then-rebuild on every brush stroke would just be noise.
//
// Mount contract — the box passes:
//   • getHistogram — () => the flat 1024-element Rust output (R|G|B|Luma, 256
//                    each), or null when there's no image. Called on `signature`
//                    change only.
//   • signature    — any string that changes when the image content changes
//                    (e.g. `${activePhotoId}:${undoCount}:${redoCount}:${w}x${h}`)
//   • photoKey     — identifies the active photo (e.g. activePhotoId). When it
//                    changes we treat it as a photo switch (fall-down → rise);
//                    when only `signature` changes it's an edit (smooth morph).
//   • active       — whether the box's histogram section is currently open (so
//                    we skip all work while it's hidden)

/** RGB overlay (the classic "Colors" view) or a single luminosity trace. */
type HistMode = "rgb" | "luma";

interface Props {
  getHistogram: () => Uint32Array | null;
  signature: string;
  photoKey: string;
  active: boolean;
}

const BIN = 256;
const LEN = BIN * 4; // R | G | B | Luma, 256 bins each

/** App-wide reduced-motion is a class on <html> (see styles.css). When set we
 *  snap to the new trace instead of easing the bars. */
function reducedMotion(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("reduce-motion")
  );
}

export function HistogramView({
  getHistogram,
  signature,
  photoKey,
  active,
}: Props) {
  const plotRef = useRef<HTMLCanvasElement | null>(null);
  // target = the freshly sampled counts (OUR OWN copy — never a live WASM-memory
  // view, which can move). disp = what's painted right now; each animation frame
  // it eases toward target so the trace slides between images.
  const targetRef = useRef<Float32Array | null>(null);
  const dispRef = useRef<Float32Array>(new Float32Array(LEN));
  const rafRef = useRef<number | null>(null);
  // The photo we last sampled, so the resample effect can tell a photo *switch*
  // (fall-down → rise) apart from an in-place *edit* of the same photo (morph).
  // Starts null so the first open is treated as a switch — harmless, since `disp`
  // also starts at the baseline, so the trace simply rises into its shape.
  const photoKeyRef = useRef<string | null>(null);
  const [mode, setMode] = useState<HistMode>("rgb");
  const [empty, setEmpty] = useState(false);

  // ── Paint the current `disp` buffer into the plot canvas. ────────────────
  const draw = useCallback(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = plot.clientWidth || 240;
    const cssH = plot.clientHeight || 110;
    const pxW = Math.round(cssW * dpr);
    const pxH = Math.round(cssH * dpr);
    if (plot.width !== pxW) plot.width = pxW;
    if (plot.height !== pxH) plot.height = pxH;
    const ctx = plot.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    // Faint scope grid — quarter columns + a midline.
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let q = 1; q < 4; q++) {
      const x = Math.round((cssW * q) / 4) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssH);
      ctx.stroke();
    }
    const yMid = Math.round(cssH / 2) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, yMid);
    ctx.lineTo(cssW, yMid);
    ctx.stroke();

    const disp = dispRef.current;
    const channels =
      mode === "luma"
        ? [{ off: 768, color: "rgba(225,225,230,0.92)" }]
        : [
            { off: 0, color: "rgba(255,70,70,0.85)" },
            { off: 256, color: "rgba(70,220,100,0.85)" },
            { off: 512, color: "rgba(80,135,255,0.9)" },
          ];

    // Normalize against the tallest bin, ignoring the 0/255 extremes so a large
    // pure-black or pure-white area doesn't flatten everything in between.
    let max = 1;
    for (const ch of channels) {
      for (let i = 1; i < 255; i++) {
        const v = disp[ch.off + i];
        if (v > max) max = v;
      }
    }

    ctx.save();
    // "lighten" makes overlapping RGB channels read as the familiar bright
    // mix (yellow/cyan/magenta/white) instead of muddy stacked translucency.
    if (mode === "rgb") ctx.globalCompositeOperation = "lighten";
    for (const ch of channels) {
      ctx.beginPath();
      ctx.moveTo(0, cssH);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * cssW;
        const v = Math.min(1, disp[ch.off + i] / max);
        ctx.lineTo(x, cssH - v * (cssH - 2));
      }
      ctx.lineTo(cssW, cssH);
      ctx.closePath();
      ctx.fillStyle = ch.color;
      ctx.fill();
    }
    ctx.restore();
  }, [mode]);

  // ── Animation loop: ease `disp` toward `target` (or down to the baseline
  //    when there's no image), redrawing each frame until it settles. ───────
  const animate = useCallback(() => {
    if (rafRef.current != null) return; // a loop is already running
    const step = () => {
      const disp = dispRef.current;
      const target = targetRef.current;
      let moving = false;
      if (target) {
        for (let i = 0; i < LEN; i++) {
          const d = target[i] - disp[i];
          if (Math.abs(d) > 0.75) {
            disp[i] += d * 0.28;
            moving = true;
          } else {
            disp[i] = target[i];
          }
        }
      } else {
        for (let i = 0; i < LEN; i++) {
          if (disp[i] > 0.75) {
            disp[i] *= 0.78;
            moving = true;
          } else {
            disp[i] = 0;
          }
        }
      }
      draw();
      rafRef.current = moving ? requestAnimationFrame(step) : null;
    };
    rafRef.current = requestAnimationFrame(step);
  }, [draw]);

  // Reduced motion: jump straight to the target (or baseline), no eased frames.
  const settle = useCallback(() => {
    const target = targetRef.current;
    if (target) dispRef.current.set(target);
    else dispRef.current.fill(0);
    draw();
  }, [draw]);

  // ── Sample Rust into our own `target` copy. Returns false when there's no
  //    image yet (null buffer / all-zero) so the caller can retry across the
  //    brief gap while a freshly-selected photo composites. ─────────────────
  const sample = useCallback(() => {
    const raw = getHistogram();
    if (!raw || raw.length < LEN) return false;
    let total = 0;
    for (let i = 0; i < BIN; i++) total += raw[i];
    if (total === 0) return false;
    const t =
      targetRef.current && targetRef.current.length === LEN
        ? targetRef.current
        : new Float32Array(LEN);
    t.set(raw.subarray(0, LEN));
    targetRef.current = t;
    return true;
  }, [getHistogram]);

  // Resample whenever the image (signature) changes.
  //
  // Photo switch (photoKey changed): drop `target` to null so the bars fall to
  // the baseline right away, then retry the sample for a generous window. The
  // levels stay down for as long as the new photo takes to composite; the moment
  // a non-empty read lands they rise into its shape. Only if the slot never
  // produces data do we give up and fade in "No image".
  //
  // Edit of the same photo (only signature changed): its data is ready at once,
  // so we keep the old trace and let the bars morph straight to the new shape —
  // no distracting collapse-and-rebuild on every brush stroke.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const reduce = reducedMotion();
    const switchedPhoto = photoKeyRef.current !== photoKey;
    photoKeyRef.current = photoKey;

    // Fall-down: only on a genuine photo switch, and only with motion on
    // (reduced-motion just snaps to the final trace once it's ready).
    if (switchedPhoto && !reduce) {
      targetRef.current = null; // bars ease down to the baseline...
      setEmpty(false); // ...silently — no "No image" flash during the gap
      animate();
    }

    let attempts = 0;
    // A photo switch may need to wait out a compositing/decode gap, so retry far
    // longer (≈4s at 60fps) before declaring the slot genuinely empty. A
    // same-photo edit reads back instantly, so a short window is plenty.
    const MAX_ATTEMPTS = switchedPhoto && photoKey ? 240 : 12;
    const tryOnce = () => {
      if (cancelled) return;
      if (sample()) {
        setEmpty(false);
        if (reduce) settle();
        else animate(); // rise into the new shape (or morph, for an edit)
      } else if (++attempts < MAX_ATTEMPTS) {
        requestAnimationFrame(tryOnce);
      } else {
        targetRef.current = null;
        setEmpty(true);
        if (reduce) settle();
        else animate();
      }
    };
    const raf = requestAnimationFrame(tryOnce);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [active, signature, photoKey, sample, animate, settle]);

  // Cancel any in-flight animation frame on unmount.
  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // Redraw (no resample) on mode flip and whenever the box resizes us.
  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(plot);
    return () => ro.disconnect();
  }, [draw]);

  return (
    <div style={WRAP}>
      <canvas ref={plotRef} style={PLOT} />
      <div style={emptyStyle(empty)}>No image to analyze</div>
      <div style={MODES}>
        {(["rgb", "luma"] as const).map((m) => (
          <button
            key={m}
            type="button"
            style={modeBtn(mode === m)}
            onClick={() => setMode(m)}
          >
            {m === "rgb" ? "RGB" : "Luma"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Inline styling (self-contained; the dark "scope" plot keeps the RGB
//    channels legible regardless of the surrounding light/dark theme). ───────
const WRAP: CSSProperties = {
  position: "relative",
  flex: "1 1 0",
  minHeight: 96,
  borderRadius: 6,
  border: "1px solid var(--border, rgba(255,255,255,0.12))",
  overflow: "hidden",
  background: "#0d0f13",
};

const PLOT: CSSProperties = { display: "block", width: "100%", height: "100%" };

/** Overlay is always mounted; we just fade its opacity so it never pops in/out
 *  during a photo switch. */
function emptyStyle(visible: boolean): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    font: "600 11px var(--font-mono, ui-monospace, monospace)",
    letterSpacing: "0.04em",
    color: "rgba(255,255,255,0.5)",
    opacity: visible ? 1 : 0,
    transition: "opacity .35s ease",
    pointerEvents: "none",
  };
}

const MODES: CSSProperties = {
  position: "absolute",
  top: 6,
  right: 6,
  display: "flex",
  gap: 4,
};

function modeBtn(active: boolean): CSSProperties {
  return {
    font: "600 9px var(--font-mono, ui-monospace, monospace)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "2px 6px",
    borderRadius: 999,
    cursor: "pointer",
    border: `1px solid ${active ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.14)"}`,
    background: active ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.35)",
    color: active ? "#fff" : "rgba(255,255,255,0.55)",
    transition: "color .12s, background .12s, border-color .12s",
  };
}
