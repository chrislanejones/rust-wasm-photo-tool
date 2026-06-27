import { useEffect, useRef } from "react";

interface Props {
  /** Canvas-sized RGBA overlay (the selection marker — a marching-ants outline
   *  + faint interior tint), length w*h*4. Built in Rust by `magic_wand_select`
   *  / `select_all` / `selection_overlay`; we only blit it. */
  mask: Uint8Array;
  width: number;
  height: number;
  /** The image canvas's live pan offset (px) and zoom — we apply the SAME CSS
   *  transform as the main canvas so the marker tracks it exactly. */
  panOffset: { x: number; y: number };
  zoom: number;
}

/**
 * Non-interactive overlay that paints the selection marker over the image.
 *
 * It is an image-resolution canvas sized to the image and transformed with the
 * very same `translate(pan) scale(zoom)` the main canvas uses (and laid out as a
 * sibling, exactly like the transparency checkerboard). That's the fix for the
 * old drift: the previous version positioned itself `fixed` from a one-shot
 * `getBoundingClientRect()`, so it lagged / slid away whenever you panned or
 * zoomed. Now it rides the same transform and stays pinned to the pixels.
 *
 * All the masking + marker geometry lives in Rust; this just blits the result.
 */
export function SelectionOverlay({
  mask,
  width,
  height,
  panOffset,
  zoom,
}: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c || width <= 0 || height <= 0 || mask.length < width * height * 4)
      return;
    if (c.width !== width) c.width = width;
    if (c.height !== height) c.height = height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(mask), width, height),
      0,
      0,
    );
  }, [mask, width, height]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{
        position: "absolute",
        width,
        height,
        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
        transformOrigin: "center center",
        pointerEvents: "none",
        zIndex: 24,
        imageRendering: "pixelated",
      }}
    />
  );
}
