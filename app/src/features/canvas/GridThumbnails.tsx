// Grid thumbnails (Batch's canvas). Renders the 11 non-active tiles around the
// hero, each with its own Exception checkbox, and the bar under the grid that
// pages through a gallery bigger than one grid. The hero (the open photo's live
// canvas) is rendered by AppShell.
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
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

export function GridThumbnails({
  photos,
  activePhotoId,
  onSelectPhoto,
}: Props) {
  const exceptionCount = useGalleryStore(
    (s) => photos.filter((p) => s.selectedIds.has(p.id)).length,
  );

  // The grid has 12 cells: the hero and 11 tiles. A bigger gallery is paged,
  // 11 tiles at a time, with « » in the bar under the grid.
  const rest = useMemo(
    () => photos.filter((p) => p.id !== activePhotoId),
    [photos, activePhotoId],
  );
  const pages = Math.max(1, Math.ceil(rest.length / TILE_AREAS.length));
  const [page, setPage] = useState(0);
  const current = Math.min(page, pages - 1);
  const others = rest.slice(current * TILE_AREAS.length, (current + 1) * TILE_AREAS.length);

  // The bar hangs under the grid. The grid's box is AppShell's; we find it from
  // our own first tile rather than adding a ref there.
  const firstTileRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const grid = firstTileRef.current?.parentElement;
    if (!grid) return;
    const measure = () => {
      const r = grid.getBoundingClientRect();
      setAnchor({ x: r.left + r.width / 2, y: r.bottom + 8 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <>
      {TILE_AREAS.map((area, i) => {
        const p = others[i];
        if (!p) {
          return (
            <div
              key={`empty-${i}`}
              ref={i === 0 ? firstTileRef : undefined}
              style={{ gridArea: area }}
              className="overflow-hidden rounded-md border border-border bg-bg-secondary/40"
            />
          );
        }
        return (
          <div
            key={p.id}
            ref={i === 0 ? firstTileRef : undefined}
            style={{ gridArea: area }}
            className="relative overflow-hidden rounded-md border border-border bg-background hover:ring-2 hover:ring-orange-400"
          >
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
      })}
      {anchor && photos.length > 0 && (
        <CanvasActionBar x={anchor.x} y={anchor.y} label="Batch photos" data-testid="batch-grid-bar">
          <CanvasActionBarButton
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            title="Previous photos"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </CanvasActionBarButton>
          <CanvasActionBarText>
            {pages > 1
              ? `Page ${current + 1} of ${pages} · ${photos.length} photos`
              : `${photos.length} photo${photos.length === 1 ? "" : "s"}`}
            {exceptionCount > 0 ? ` · ${exceptionCount} exception${exceptionCount === 1 ? "" : "s"}` : ""}
          </CanvasActionBarText>
          <CanvasActionBarButton
            onClick={() => setPage(current + 1)}
            disabled={current >= pages - 1}
            title="Next photos"
          >
            <ChevronRight aria-hidden className="size-4" />
          </CanvasActionBarButton>
        </CanvasActionBar>
      )}
    </>
  );
}
