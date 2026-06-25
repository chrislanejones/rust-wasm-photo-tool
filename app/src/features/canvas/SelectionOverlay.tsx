import { useEffect, useRef } from "react";

interface Props {
  /** The main composited canvas, used to align the overlay to its on-screen box. */
  canvasEl: HTMLCanvasElement;
  /** Canvas-sized RGBA overlay (selected pixels tinted), length w*h*4 — built in
   *  Rust by `magic_wand_select` / `select_all` / `selection_overlay`. */
  mask: Uint8Array;
  width: number;
  height: number;
}

/**
 * Non-interactive overlay that paints the magic-wand selection mask over the
 * image. The mask is drawn at image resolution and CSS-scaled to the canvas's
 * current on-screen rect, so it tracks zoom/pan exactly (re-rendered with the
 * canvas). All the masking math lives in Rust; this just blits the result.
 */
export function SelectionOverlay({ canvasEl, mask, width, height }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c || width <= 0 || height <= 0 || mask.length < width * height * 4) return;
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(mask), width, height),
      0,
      0,
    );
  }, [mask, width, height]);

  const r = canvasEl.getBoundingClientRect();
  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{
        position: "fixed",
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        pointerEvents: "none",
        zIndex: 24,
        imageRendering: "pixelated",
      }}
    />
  );
}
