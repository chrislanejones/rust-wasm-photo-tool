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
// Mount contract — the box passes:
//   • getHistogram — () => the flat 1024-element Rust output (R|G|B|Luma, 256
//                    each), or null when there's no image. Called on `signature`
//                    change only.
//   • signature    — any string that changes when the image content changes
//                    (e.g. `${activePhotoId}:${undoCount}:${redoCount}:${w}x${h}`)
//   • active       — whether the box's histogram section is currently open (so
//                    we skip all work while it's hidden)

/** RGB overlay (the classic "Colors" view) or a single luminosity trace. */
type HistMode = "rgb" | "luma";

interface Props {
  getHistogram: () => Uint32Array | null;
  signature: string;
  active: boolean;
}

interface Bins {
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
  luma: Uint32Array;
  /** Number of opaque pixels counted. */
  total: number;
}

export function HistogramView({ getHistogram, signature, active }: Props) {
  const plotRef = useRef<HTMLCanvasElement | null>(null);
  const binsRef = useRef<Bins | null>(null);
  const [mode, setMode] = useState<HistMode>("rgb");
  const [empty, setEmpty] = useState(true);

  // ── Pull the per-channel 256-bin histogram from Rust. ────────────────────
  const sample = useCallback(() => {
    const raw = getHistogram();
    if (!raw || raw.length < 1024) {
      binsRef.current = null;
      setEmpty(true);
      return;
    }
    // Flat Rust output: R | G | B | Luma, 256 bins each. Views, no copy.
    const r = raw.subarray(0, 256);
    const g = raw.subarray(256, 512);
    const b = raw.subarray(512, 768);
    const luma = raw.subarray(768, 1024);
    let total = 0;
    for (let i = 0; i < 256; i++) total += r[i];
    binsRef.current = total > 0 ? { r, g, b, luma, total } : null;
    setEmpty(total === 0);
  }, [getHistogram]);

  // ── Paint the cached bins into the plot canvas. ──────────────────────────
  const draw = useCallback(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = plot.clientWidth || 240;
    const cssH = plot.clientHeight || 110;
    plot.width = Math.round(cssW * dpr);
    plot.height = Math.round(cssH * dpr);
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

    const bins = binsRef.current;
    if (!bins) return;

    const channels =
      mode === "luma"
        ? [{ data: bins.luma, color: "rgba(225,225,230,0.92)" }]
        : [
            { data: bins.r, color: "rgba(255,70,70,0.85)" },
            { data: bins.g, color: "rgba(70,220,100,0.85)" },
            { data: bins.b, color: "rgba(80,135,255,0.9)" },
          ];

    // Normalize against the tallest bin, ignoring the 0/255 extremes so a large
    // pure-black or pure-white area doesn't flatten everything in between.
    let max = 1;
    for (const ch of channels) {
      for (let i = 1; i < 255; i++) if (ch.data[i] > max) max = ch.data[i];
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
        const v = Math.min(1, ch.data[i] / max);
        ctx.lineTo(x, cssH - v * (cssH - 2));
      }
      ctx.lineTo(cssW, cssH);
      ctx.closePath();
      ctx.fillStyle = ch.color;
      ctx.fill();
    }
    ctx.restore();
  }, [mode]);

  // Resample + redraw whenever the image changes (deferred a frame so the main
  // canvas/composite has finished its flush before we read the buffer back).
  useEffect(() => {
    if (!active) return;
    const raf = requestAnimationFrame(() => {
      sample();
      draw();
    });
    return () => cancelAnimationFrame(raf);
  }, [active, signature, sample, draw]);

  // Redraw (no resample) when the box resizes us — sections share the height.
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
      {empty && <div style={EMPTY}>No image to analyze</div>}
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

const EMPTY: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  font: "600 11px var(--font-mono, ui-monospace, monospace)",
  letterSpacing: "0.04em",
  color: "rgba(255,255,255,0.5)",
};

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
