import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

const BIN = 256;
const LEN = BIN * 4;

type HistMode = "rgb" | "luma";

interface Props {
  getHistogram: () => Uint32Array | null;
  signature: string;
  photoKey: string;
  active: boolean;
}

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
  const targetRef = useRef<Float32Array | null>(null);
  const dispRef = useRef<Float32Array>(new Float32Array(LEN));
  const rafRef = useRef<number | null>(null);
  const photoKeyRef = useRef<string | null>(null);
  const [mode, setMode] = useState<HistMode>("rgb");
  const [empty, setEmpty] = useState(false);

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

    let max = 1;
    for (const ch of channels) {
      for (let i = 1; i < 255; i++) {
        const v = disp[ch.off + i];
        if (v > max) max = v;
      }
    }

    ctx.save();
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

  const cancelAnim = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const animate = useCallback(() => {
    if (rafRef.current != null) return;

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

  const settle = useCallback(() => {
    const target = targetRef.current;
    if (target) dispRef.current.set(target);
    else dispRef.current.fill(0);
    draw();
  }, [draw]);

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

  // Drop bars immediately when switching photos, and keep them down
  // until a valid Rust histogram is available for the new image.
  useEffect(() => {
    if (!active) return;

    const reduce = reducedMotion();
    const switchedPhoto = photoKeyRef.current !== photoKey;
    photoKeyRef.current = photoKey;

    if (switchedPhoto) {
      targetRef.current = null;
      setEmpty(false);
      cancelAnim();
      if (reduce) settle();
      else animate();
    }
  }, [active, photoKey, animate, settle, cancelAnim]);

  // Only raise bars when the backing image is actually ready enough
  // for Rust to return a valid histogram. The parent-controlled
  // `signature` should change after recomposite / undo / redo / load.
  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const reduce = reducedMotion();
    let attempts = 0;
    const maxAttempts = 240;

    const tryOnce = () => {
      if (cancelled) return;

      if (sample()) {
        setEmpty(false);
        cancelAnim();
        if (reduce) settle();
        else animate();
        return;
      }

      attempts += 1;
      if (attempts < maxAttempts) {
        requestAnimationFrame(tryOnce);
      } else {
        targetRef.current = null;
        setEmpty(true);
        cancelAnim();
        if (reduce) settle();
        else animate();
      }
    };

    const raf = requestAnimationFrame(tryOnce);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [active, signature, sample, animate, settle, cancelAnim]);

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

  useEffect(() => {
    return () => {
      cancelAnim();
    };
  }, [cancelAnim]);

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

const WRAP: CSSProperties = {
  position: "relative",
  flex: "1 1 0",
  minHeight: 96,
  borderRadius: 6,
  border: "1px solid var(--border, rgba(255,255,255,0.12))",
  overflow: "hidden",
  background: "rgba(0,0,0,0.28)",
};

const PLOT: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
};

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
    border: `1px solid ${
      active ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.14)"
    }`,
    background: active
      ? "rgba(255,255,255,0.16)"
      : "rgba(0,0,0,0.35)",
    color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.62)",
    transition: "color .12s, background .12s, border-color .12s",
  };
}
