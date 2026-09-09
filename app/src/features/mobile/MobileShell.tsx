// The MOBILE VERSION (< BP_MOBILE): a phone gets a real surface — upload, add,
// and view the gallery — instead of a cramped editor. No editing here at all:
// the canvas, tools, and panels stay desktop/compact-only, and the
// MobileVersionNotice says so. Renders as an opaque layer over the editor
// chrome (z --z-mobile, below dialogs, so the shared delete-confirm dialog and
// toasts still land on top). Uploads run through the SAME handleAddPhotos
// pipeline as the desktop dialogs — originals into IndexedDB, thumbnails,
// tier caps, the persisted gallery manifest — so photos added on a phone are
// waiting in the gallery when the same browser profile opens the editor wide.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/UserMenu";
import { formatBytes } from "@/lib/format";
import { getOriginalAsBlobUrl } from "@/lib/dexie/originalsAdapter";
import { isSvgFile } from "@/lib/rasterizeSvg";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";

const horseLogo = "/Image-Horse-Logo.svg";

interface Props {
  photos: PhotoEntry[];
  /** Per-tier gallery cap, for the count readout. */
  maxPhotos: number;
  /** Cold-start boot still running (WASM + session check) — show a splash. */
  booting: boolean;
  onAddFiles: (files: File[]) => void;
  /** Ask AppShell to confirm-then-delete (the shared per-image dialog). */
  onRequestDelete: (id: string) => void;
}

/** Gallery tile — the vertical GalleryBar's square thumb, minus everything
 *  editorial (selection, compression overlays, hover chrome). */
function MobileThumb({
  entry,
  onOpen,
}: {
  entry: PhotoEntry;
  onOpen: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [thumbUrl, setThumbUrl] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(entry.thumbBlob);
    setThumbUrl(url);
    setLoading(true);
    return () => URL.revokeObjectURL(url);
  }, [entry.thumbBlob]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View photo ${entry.name}`}
      className="photo-thumb photo-thumb-grid relative"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="absolute inset-0 checkerboard rounded-lg" />
      <img
        src={thumbUrl || undefined}
        alt={entry.name}
        draggable={false}
        decoding="async"
        loading="lazy"
        onLoad={() => setLoading(false)}
        onError={() => setLoading(false)}
      />
      {loading && (
        <Skeleton
          className="absolute inset-0 z-10 rounded-lg"
          aria-label={`Loading ${entry.name}`}
        />
      )}
    </div>
  );
}

/** Full-screen single-photo viewer: the stored ORIGINAL bytes (full
 *  resolution, straight from IndexedDB), swipe/chevron navigation, delete. */
function MobileViewer({
  photos,
  photoId,
  onNavigate,
  onClose,
  onRequestDelete,
}: {
  photos: PhotoEntry[];
  photoId: string;
  onNavigate: (id: string) => void;
  onClose: () => void;
  onRequestDelete: (id: string) => void;
}) {
  const index = photos.findIndex((p) => p.id === photoId);
  const photo = index >= 0 ? photos[index] : null;
  const [url, setUrl] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  // Full-res original from IndexedDB. Keyed on the content hash so a
  // superseded load can't blit over a newer photo's URL; revoke on the way out.
  const originalKey = photo?.originalKey ?? null;
  useEffect(() => {
    if (!originalKey) return;
    let cancelled = false;
    let created: string | null = null;
    setUrl(null);
    void (async () => {
      const u = await getOriginalAsBlobUrl(originalKey);
      if (cancelled || !u) return;
      created = u;
      setUrl(u);
    })();
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [originalKey]);

  const goto = useCallback(
    (dir: 1 | -1) => {
      if (photos.length < 2 || index < 0) return;
      const next = photos[(index + dir + photos.length) % photos.length]!;
      onNavigate(next.id);
    },
    [photos, index, onNavigate],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goto(1);
      else if (e.key === "ArrowLeft") goto(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goto]);

  if (!photo) return null;

  const dims =
    photo.origWidth && photo.origHeight
      ? `${photo.origWidth}×${photo.origHeight}`
      : null;
  const meta = [dims, formatBytes(photo.byteSize)].filter(Boolean).join(" · ");

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {photo.name}
          </p>
          <p className="text-xs text-white/60">
            {index + 1} of {photos.length}
            {meta ? ` · ${meta}` : ""}
          </p>
        </div>
        <Button
          size="tiny"
          aria-label="Delete image"
          title="Delete image"
          onClick={() => onRequestDelete(photo.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button size="tiny" aria-label="Close" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (start == null || end == null) return;
          const dx = end - start;
          if (Math.abs(dx) > 48) goto(dx < 0 ? 1 : -1);
        }}
      >
        {url ? (
          <img
            src={url}
            alt={photo.name}
            draggable={false}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <Spinner size={28} aria-label={`Loading ${photo.name}`} />
        )}

        {photos.length > 1 && (
          <>
            <button
              onClick={() => goto(-1)}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white/90"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={() => goto(1)}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white/90"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function MobileShell({
  photos,
  maxPhotos,
  booting,
  onAddFiles,
  onRequestDelete,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);

  // The viewed photo was deleted (confirm dialog → handleRemovePhoto) —
  // fall back to the grid rather than a blank viewer.
  useEffect(() => {
    if (viewerId && !photos.some((p) => p.id === viewerId)) setViewerId(null);
  }, [viewerId, photos]);

  // Same image filter as NewActions.processFiles: the mime check plus
  // isSvgFile for .svg files whose source hands over an empty mime
  // (handleAddPhotos rasterizes those at the boundary).
  const handlePicked = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const images = Array.from(list).filter(
        (f) => f.type.startsWith("image/") || isSvgFile(f),
      );
      if (images.length) onAddFiles(images);
    },
    [onAddFiles],
  );

  return (
    <div className="fixed inset-0 z-[var(--z-mobile)] flex flex-col bg-bg-primary">
      {/* Header — logo + name on the left, sign-in / avatar on the right,
          mirroring the top bar's chrome. */}
      <div className="flex items-center gap-2.5 border-b border-border bg-bg-secondary px-4 py-2.5">
        <img src={horseLogo} alt="" className="h-9 w-9 drop-shadow" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold tracking-wide text-text-primary">
            Image Horse
          </h1>
          <p className="text-xs text-text-muted">Mobile — upload &amp; view</p>
        </div>
        <UserMenu />
      </div>

      {booting ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <img src={horseLogo} alt="Image Horse" className="h-20 w-20 drop-shadow-lg" />
          <Spinner size={22} aria-label="Loading Image Horse" />
        </div>
      ) : photos.length === 0 ? (
        // Empty state — the mobile cut of the New-actions surface: one clear
        // way in (no paste / samples / blank canvas; those are editor starts).
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-bg-secondary p-6 text-center shadow-2xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-elevated">
              <Upload className="h-7 w-7 text-text-muted" />
            </div>
            <p className="text-sm text-text-secondary">
              Add images from your photo library or camera. They land in your
              gallery, ready to edit next time you're on a bigger screen.
            </p>
            <Button
              size="large"
              className="w-full"
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              Add Images
            </Button>
            <p className="text-xs text-text-secondary">
              Supports PNG, JPG, GIF, WebP, AVIF, SVG
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-24">
            <div className="grid grid-cols-3 content-start items-start gap-2">
              {photos.map((entry) => (
                <MobileThumb
                  key={entry.id}
                  entry={entry}
                  onOpen={() => setViewerId(entry.id)}
                />
              ))}
            </div>
          </div>

          {/* Count readout + the one-way-in Add button, pinned to the bottom
              like the status bar. */}
          <div className="flex items-center gap-3 border-t border-border bg-bg-secondary px-4 py-3">
            <p className="flex-1 text-xs text-text-muted">
              {photos.length} of {maxPhotos} photos
            </p>
            <Button size="large" onClick={() => inputRef.current?.click()}>
              <ImagePlus className="h-4 w-4" />
              Add Images
            </Button>
          </div>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.svg"
        multiple
        className="hidden"
        onChange={(e) => {
          handlePicked(e.target.files);
          // Allow re-picking the same file(s) next time.
          e.target.value = "";
        }}
      />

      {viewerId && (
        <MobileViewer
          photos={photos}
          photoId={viewerId}
          onNavigate={setViewerId}
          onClose={() => setViewerId(null)}
          onRequestDelete={onRequestDelete}
        />
      )}
    </div>
  );
}
