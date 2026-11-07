// Batch's two layouts as styles, and its zoom (11-07-2026). AppShell owns the
// container, the hero and the canvas inside it; GridThumbnails the tiles and
// the bar. Both read useBatchViewStore and style through here, so AppShell
// carries one call per element rather than two layouts' worth of CSS.
//
// One container for both layouts, the hero always its first child, so
// Grid ⇄ Masonry restyles the same elements and the canvas is never remounted
// (the canvas element's identity matters — lib/engine/canvasIdentity.ts).
import type { CSSProperties } from "react";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import { masonryZoomFactor, useBatchViewStore, type BatchLayout } from "@/stores/useBatchViewStore";

export interface BatchView {
  layout: BatchLayout;
  masonryCols: number;
}

/** A photo's shape for a masonry tile: its current size, else its upload
 *  size, else square. */
function photoAspect(
  p: Pick<PhotoEntry, "workingWidth" | "workingHeight" | "origWidth" | "origHeight"> | undefined,
): number {
  if (!p) return 1;
  const w = p.workingWidth || p.origWidth;
  const h = p.workingHeight || p.origHeight;
  return w > 0 && h > 0 ? w / h : 1;
}

/** The box around the container: Masonry scrolls in it; the Grid is fitted
 *  and centered. */
export function batchScrollerStyle(layout: BatchLayout): CSSProperties {
  return layout === "masonry"
    ? { display: "block", overflowY: "auto" }
    : { display: "flex", alignItems: "center", justifyContent: "center" };
}

/** The container. Grid: 5 × 3 with the open photo 2 × 2, fitted, as it
 *  always was. Masonry: CSS columns, as tall as the photos make it. */
export function batchHostStyle(view: BatchView): CSSProperties {
  if (view.layout === "masonry") {
    return { display: "block", columnCount: view.masonryCols, columnGap: "12px", padding: "12px", width: "100%" };
  }
  return {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gridTemplateRows: "repeat(3, 1fr)",
    gap: "12px",
    padding: "12px",
    maxWidth: "100%",
    maxHeight: "100%",
    width: "auto",
    margin: "auto",
    aspectRatio: "5 / 3",
  };
}

/** A masonry tile — the hero's and every other photo's. */
export function masonryTileStyle(p: Parameters<typeof photoAspect>[0]): CSSProperties {
  return { aspectRatio: String(photoAspect(p)), breakInside: "avoid", marginBottom: 12, width: "100%" };
}

/** The hero (the open photo's live canvas). Grid: the 2 × 2 corner. Masonry:
 *  a tile like the rest, at its own shape — Selected, not bigger. */
export function batchHeroStyle(layout: BatchLayout, active: PhotoEntry | undefined): CSSProperties {
  const base: CSSProperties = { position: "relative", overflow: "hidden", borderRadius: "0.375rem" };
  return layout === "masonry" ? { ...base, ...masonryTileStyle(active) } : { ...base, gridArea: "1 / 1 / 3 / 3" };
}

interface ZoomHandlers {
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
}

/** Zoom in Batch: the Grid zooms the open photo, like every other tool. In
 *  Masonry, Alt + = / − / 0, the top bar's buttons and the canvas menu size
 *  EVERY photo (the column count) instead. Returns the handlers to wire, the
 *  zoom to show, and the layout for the container. */
export function useBatchZoom(inBatch: boolean, engine: ZoomHandlers, engineZoom: number) {
  const layout = useBatchViewStore((s) => s.layout);
  const masonryCols = useBatchViewStore((s) => s.masonryCols);
  const zoomIn = useBatchViewStore((s) => s.zoomIn);
  const zoomOut = useBatchViewStore((s) => s.zoomOut);
  const zoomReset = useBatchViewStore((s) => s.zoomReset);
  const view: BatchView = { layout, masonryCols };
  const allPhotos = inBatch && layout === "masonry";
  const pick = allPhotos ? { zoomIn, zoomOut, zoomReset } : engine;
  return {
    view,
    handleZoomIn: pick.zoomIn,
    handleZoomOut: pick.zoomOut,
    handleZoomReset: pick.zoomReset,
    zoom: allPhotos ? masonryZoomFactor(masonryCols) : engineZoom,
  };
}
