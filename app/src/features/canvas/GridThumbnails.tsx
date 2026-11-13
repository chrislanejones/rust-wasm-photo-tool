// Grid thumbnails (Batch's canvas). Renders the non-active tiles around the
// hero, each with its own Exception checkbox, and the bar under them. The hero
// (the open photo's live canvas) is rendered by AppShell, as the first child of
// the same container, so switching layouts never remounts the canvas.
//
// Two layouts (11-07-2026, useBatchViewStore), picked at the left of the bar:
//   Grid    — the hero 2 × 2, tiles around it, paged when the gallery is
//             bigger than one grid. Zoom zooms the hero, as it always did.
//   Masonry — every photo at its own shape, stacked in columns like a
//             scrapbook; the hero is one tile like the others, only marked
//             Selected. Scrolls instead of paging. Zoom sizes every photo
//             (the column count).

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, LayoutDashboard, LayoutPanelLeft } from "lucide-react";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import { BatchCropThumbShade } from "@/features/gallery/BatchCropThumbShade";
import { BatchExceptionCheckbox } from "./BatchExceptionCheckbox";
import {
  CanvasActionBar,
  CanvasActionBarButton,
  CanvasActionBarText,
} from "@/components/ui/canvas-action-bar";
import { DecodedImage } from "@/components/ui/decoded-image";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useBatchViewStore, type BatchLayout } from "@/stores/useBatchViewStore";
import { masonryTileStyle } from "./batchLayout";

interface Props {
  photos: PhotoEntry[];
  activePhotoId: string | null;
  onSelectPhoto: (entry: PhotoEntry) => void;
}

// CSS-grid coordinates for the 11 thumbnail tiles (hero is grid-area 1/1/3/3,
// rendered separately by AppShell — not included here).
const TILE_AREAS: string[] = [
  "1 / 3 / 2 / 4",
  "1 / 4 / 2 / 5",
  "1 / 5 / 2 / 6",
  "2 / 3 / 3 / 4",
  "2 / 4 / 3 / 5",
  "2 / 5 / 3 / 6",
  "3 / 1 / 4 / 2",
  "3 / 2 / 4 / 3",
  "3 / 3 / 4 / 4",
  "3 / 4 / 4 / 5",
  "3 / 5 / 4 / 6",
];

// The open photo big with tiles beside it, and staggered heights: the two
// icons have to read apart at 16px (four equal squares did not).
const LAYOUTS: { layout: BatchLayout; label: string; name: string; Icon: typeof LayoutDashboard }[] = [
  { layout: "grid", label: "Grid view", name: "Grid", Icon: LayoutPanelLeft },
  { layout: "masonry", label: "Masonry view", name: "Masonry", Icon: LayoutDashboard },
];

export function GridThumbnails({
  photos,
  activePhotoId,
  onSelectPhoto,
}: Props) {
  const exceptionCount = useGalleryStore(
    (s) => photos.filter((p) => s.selectedIds.has(p.id)).length,
  );
  const layout = useBatchViewStore((s) => s.layout);
  const setLayout = useBatchViewStore((s) => s.setLayout);
  const masonry = layout === "masonry";

  // Grid: 12 cells, the hero and 11 tiles; a bigger gallery is paged, 11
  // tiles at a time, with « » in the bar. Masonry shows every photo and
  // scrolls.
  const tileAreas = TILE_AREAS;
  const rest = useMemo(
    () => photos.filter((p) => p.id !== activePhotoId),
    [photos, activePhotoId],
  );
  const perPage = masonry ? Math.max(1, rest.length) : tileAreas.length;
  const pages = Math.max(1, Math.ceil(rest.length / perPage));
  const [page, setPage] = useState(0);
  const current = Math.min(page, pages - 1);
  const others = rest.slice(current * perPage, (current + 1) * perPage);


  // The bar hangs under the photos. Their box is AppShell's; we find it from a
  // marker of our own rather than adding a ref there (a marker, not the first
  // tile: Masonry has no tile when the open photo is the only one). Masonry
  // can be taller than the view and scrolls in its parent, so the bar stays
  // at the bottom of what is visible.
  const markerRef = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const grid = markerRef.current?.parentElement;
    if (!grid) return;
    const scroller = grid.parentElement;
    const measure = () => {
      const r = grid.getBoundingClientRect();
      const bottom = masonry && scroller ? Math.min(r.bottom, scroller.getBoundingClientRect().bottom) : r.bottom;
      setAnchor({ x: r.left + r.width / 2, y: bottom + 8 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    if (scroller) ro.observe(scroller);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [masonry]);

  const tileClass = "relative overflow-hidden rounded-md border border-border bg-background hover:ring-2 hover:ring-orange-400";

  const tile = (p: PhotoEntry, style: React.CSSProperties) => (
    <div key={p.id} style={style} className={tileClass}>
      <button
        type="button"
        onClick={() => onSelectPhoto(p)}
        className="flex h-full w-full items-center justify-center"
        aria-label={p.name}
      >
        <DecodedImage source={p.thumbBlob} alt={p.name} className="size-full object-contain" fallback={<span role="img" aria-label={`${p.name} could not be displayed. Select the photo to open it.`}><ImageOff aria-hidden className="size-4 text-text-muted" /></span>} />
      </button>
      <BatchCropThumbShade entry={p} isActive={false} cover={false} />
      <BatchExceptionCheckbox photoId={p.id} name={p.name} />
    </div>
  );

  return (
    <>
      <span ref={markerRef} hidden />
      {masonry
        ? others.map((p) => tile(p, masonryTileStyle(p)))
        : tileAreas.map((area, i) => {
            const p = others[i];
            if (!p) {
              return (
                <div
                  key={`empty-${i}`}
                  style={{ gridArea: area }}
                  className="overflow-hidden rounded-md border border-border bg-bg-secondary/40"
                />
              );
            }
            return tile(p, { gridArea: area });
          })}
      {anchor && photos.length > 0 && (
        <CanvasActionBar x={anchor.x} y={anchor.y} label="Batch photos" data-testid="batch-grid-bar">
          <div role="group" aria-label="Layout" className="flex items-center gap-0.5">
            {LAYOUTS.map(({ layout: l, label, name, Icon }) => (
              <CanvasActionBarButton key={l} onClick={() => setLayout(l)} pressed={layout === l} title={label}>
                <Icon aria-hidden className="size-4" />
                {/* The word on both, not just the pressed one (Chris,
                    11-12-2026): two layout icons at 16px don't say which is
                    which until you've tried them. */}
                {name}
              </CanvasActionBarButton>
            ))}
          </div>
          {!masonry && (
            <CanvasActionBarButton
              onClick={() => setPage(current - 1)}
              disabled={current === 0}
              title="Previous photos"
            >
              <ChevronLeft aria-hidden className="size-4" />
            </CanvasActionBarButton>
          )}
          <CanvasActionBarText>
            {pages > 1
              ? `Page ${current + 1} of ${pages} · ${photos.length} photos`
              : `${photos.length} photo${photos.length === 1 ? "" : "s"}`}
            {exceptionCount > 0 ? ` · ${exceptionCount} exception${exceptionCount === 1 ? "" : "s"}` : ""}
          </CanvasActionBarText>
          {!masonry && (
            <CanvasActionBarButton
              onClick={() => setPage(current + 1)}
              disabled={current >= pages - 1}
              title="Next photos"
            >
              <ChevronRight aria-hidden className="size-4" />
            </CanvasActionBarButton>
          )}
        </CanvasActionBar>
      )}
    </>
  );
}
