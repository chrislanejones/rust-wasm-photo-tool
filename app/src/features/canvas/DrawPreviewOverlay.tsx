import React, { useEffect } from "react";

interface Props {
  /** WASM image dimensions — the overlay's backing store matches the main
   *  canvas exactly, so `useDrawingTools` can keep drawing in image pixel
   *  space with no coordinate change. */
  width: number;
  height: number;
  /** The main canvas's LAYOUT size in CSS px (its fit-scaled box). Same
   *  reasoning as `SelectionOverlay`: the backing store stays image-resolution
   *  and CSS scales it down, so the preview lines up with the pixels rather
   *  than being drawn 2–3× too large on a photo bigger than the viewport. */
  cssWidth?: number;
  cssHeight?: number;
  /** The main canvas's live pan/zoom — the overlay rides the SAME transform so
   *  the rubber band stays pinned to the image while panning or zooming. */
  panOffset: { x: number; y: number };
  zoom: number;
}

/**
 * The arrow / shapes / crop rubber-band preview surface.
 *
 * **Why this exists.** The preview used to be drawn onto the MAIN canvas:
 * `getImageData` the whole canvas on mousedown, then per pointermove
 * `putImageData` the snapshot back and draw the rubber band on top, then
 * `putImageData` once more on mouseup to erase it. Three problems with that:
 *
 *  1. It violated the project invariant that the engine owns pixels — this was
 *     canvas-2D pixel manipulation in React land, on the document surface.
 *  2. It made `useDrawingTools` a second writer to the main canvas, which
 *     retired ADR-024's measured finding #5 and is the thing blocking Stage 4:
 *     after `transferControlToOffscreen()` the main thread cannot get a 2D
 *     context at all, so the preview would simply stop working.
 *  3. A full-canvas `getImageData` per mousedown plus a `putImageData` per
 *     pointermove is a lot of copying on a 12-megapixel document, to draw a
 *     rectangle.
 *
 * Drawing onto a transparent sibling instead makes all three go away: no
 * snapshot, no restore, and the main canvas is never touched. Erasing the
 * preview becomes `clearRect` rather than blitting a full-resolution copy back.
 *
 * Laid out exactly like `SelectionOverlay` — absolute sibling, image-resolution
 * backing store, fit-scaled CSS box, same pan/zoom transform, non-interactive.
 * `zIndex` 20 keeps it under the selection ants (24) and lasso (25), matching
 * the old stacking where the preview lived in the image pixels and every
 * overlay painted above it.
 */
export const DrawPreviewOverlay = React.forwardRef<HTMLCanvasElement, Props>(
  function DrawPreviewOverlay(
    { width, height, cssWidth, cssHeight, panOffset, zoom },
    ref,
  ) {
    // Setting width/height on a canvas clears it, and React only writes the
    // attributes it sees change — but a dimension change means the document
    // resized under the drag anyway, so a cleared preview is correct.
    useEffect(() => {
      const c = (ref as React.RefObject<HTMLCanvasElement | null>)?.current;
      if (!c) return;
      if (c.width !== width) c.width = width;
      if (c.height !== height) c.height = height;
    }, [ref, width, height]);

    return (
      <canvas
        ref={ref}
        width={width}
        height={height}
        style={{
          position: "absolute",
          width: cssWidth ?? width,
          height: cssHeight ?? height,
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          transformOrigin: "center center",
          pointerEvents: "none",
          zIndex: 20,
        }}
      />
    );
  },
);
