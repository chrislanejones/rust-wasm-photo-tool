// The MOBILE VERSION (< BP_MOBILE): a phone gets a real surface — upload, add,
// and view the gallery — instead of a cramped editor. No editing here at all:
// the canvas, tools, and panels stay desktop/compact-only, and the
// MobileVersionNotice says so. Renders as an opaque layer over the editor
// chrome (z --z-mobile, below dialogs, so the shared delete-confirm dialog and
// toasts still land on top). Uploads run through the SAME handleAddPhotos
// pipeline as the desktop dialogs — originals into IndexedDB, thumbnails,
// tier caps, the persisted gallery manifest — so photos added on a phone are
// waiting in the gallery when the same browser profile opens the editor wide.
import { PendingImportTile } from "@/features/gallery/PendingImportTile";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ImageOff,
  ImagePlus,
  Settings,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/UserMenu";
import { MobileSettingsSheet } from "@/features/mobile/MobileSettingsSheet";
import { useUIStore } from "@/stores/useUIStore";
import { formatBytes } from "@/lib/format";
import { getOriginal, getOriginalAsBlobUrl } from "@/lib/dexie/originalsAdapter";
import { isImportableFile } from "@/lib/importBoundary";
import { HEIC_ACCEPT } from "@/lib/heicImport";
import { useBetaOn } from "@/hooks/useBetaOn";
import { extFromMime } from "@/lib/mimeExt";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";
import { useThumbImage } from "@/features/gallery/useThumbImage";
import { GalleryLoadingRegion } from "@/features/gallery/GalleryLoadingRegion";
import { useGalleryLoading, useGalleryTile } from "@/features/gallery/useGalleryLoading";

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
 *  editorial (selection, compression overlays, hover chrome).
 *
 *  ⚠️ IT SHARES THE DECODE, NOT THE COMPONENT. `Thumb` carries the whole
 *  editorial surface this file's first comment exists to exclude, so what is
 *  shared is `useThumbImage` — the rule and the race fix — while the markup
 *  stays the phone's own. The hook is the part that was wrong here.
 *
 *  What this had instead, and why each was a bug:
 *
 *    · `useState(true)` for `loading`, so EVERY tile drew a placeholder on
 *      every open, including the cached ones that decode in single-digit
 *      milliseconds. A twelve-photo grid flashed twelve grey boxes. The hook's
 *      300 ms of grace means an ordinary open shows only photos.
 *    · `setLoading(true)` inside the blob effect, so an edit blanked the tile
 *      and covered it with a placeholder. The hook decodes off-DOM and swaps,
 *      so the previous picture stays up until the new one is ready.
 *    · `onError` set `loading = false` with nothing to show for it, leaving a
 *      bare checkerboard square and no reason. There is an error state now.
 *    · The placeholder carried its own `aria-label`, so a screen reader on a
 *      100-photo grid heard "Loading <name>" a hundred times. One `aria-busy`
 *      on the grid, tiles `decorative`. */
function MobileThumb({
  entry,
  onOpen,
  onPendingChange,
}: {
  entry: PhotoEntry;
  onOpen: () => void;
  /** Report whether this tile still has no pixels, for the grid's one `aria-busy`. */
  onPendingChange: (id: string, pending: boolean) => void;
}) {
  const thumb = useThumbImage(entry.thumbBlob);
  // The grid loads like the desktop gallery card (GalleryLoadingRegion).
  const view = useGalleryTile(thumb);

  // Cleared on unmount as well, or a tile deleted mid-decode leaves the grid
  // busy for ever — and the phone is where tiles get deleted.
  useEffect(() => {
    onPendingChange(entry.id, thumb.pending);
  }, [onPendingChange, entry.id, thumb.pending]);
  useEffect(() => () => onPendingChange(entry.id, false), [onPendingChange, entry.id]);

  return (
    <button
      type="button"
      data-id={entry.id}
      aria-label={`View photo ${entry.name}`}
      className="photo-thumb photo-thumb-grid relative"
      onClick={onOpen}
    >
      {/* Only once there is a picture. Rendered unconditionally it shows
          through the placeholder — a checkerboard where a photo is supposed to
          be arriving, which reads as a failed load. */}
      {view.src && <div className="absolute inset-0 checkerboard rounded-lg" />}

      {/* Every branch is in flow at the same size, matching `Thumb` — this
          grid is `content-start items-start`, so a tile's row height comes
          from its in-flow child.

          ⚠️ THE OLD MARKUP DID NOT ACTUALLY SHIFT LAYOUT, and the reason is
          worth keeping: it asked for `absolute inset-0` on the placeholder and
          never got it. `.skeleton` sets `position: relative` in plain,
          unlayered CSS (styles.css), which a Tailwind utility does not
          reliably beat — the same trap as `.btn-icon-ghost`. Measured with the
          delay harness: computed `position: relative`, tile 117x117 while
          waiting and 117x117 settled, on master as well as here. So this is
          not a layout fix; `absolute` on a `Skeleton` is simply a thing that
          does not work, and there is now no caller that tries. */}
      {view.src ? (
        <img src={view.src} alt={entry.name} draggable={false} decoding="async" />
      ) : view.failed ? (
        <div
          className="flex w-full aspect-square flex-col items-center justify-center gap-1 rounded-md bg-bg-elevated px-1 text-center"
          role="img"
          aria-label={`${entry.name} could not be displayed`}
        >
          <ImageOff className="h-5 w-5 text-text-muted" aria-hidden="true" />
          <span className="line-clamp-2 break-all text-2xs text-text-muted">{entry.name}</span>
        </div>
      ) : (
        /* Inside the grace period `loading={false}` renders the child instead —
           an invisible box of the same size, so a fast decode shows nothing at
           all and the tile never changes size on the way. */
        <Skeleton variant="tile" decorative loading={view.showSkeleton} className="w-full">
          <div className="w-full aspect-square" aria-hidden="true" />
        </Skeleton>
      )}
    </button>
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

  // ABOVE the `if (!photo) return null` below: hooks must run in the same
  // order every render, and these sat after that early return.
  const [saving, setSaving] = useState(false);

  /**
   * Save the photo's STORED bytes to the device. Deliberately not a render or
   * an export: there is no editor on a phone, so the file you brought in is
   * exactly the file you get back, and a re-encode would only lose quality on
   * the way.
   *
   * Revokes inside the same function that created the URL — a split between a
   * memo and an effect is what broke gallery thumbnails under StrictMode once.
   */
  const handleDownload = useCallback(async () => {
    if (!photo) return;
    setSaving(true);
    try {
      const stored = await getOriginal(photo.originalKey);
      if (!stored) {
        toast.error("Couldn't find this image's file");
        return;
      }
      // StoredOriginal carries raw `bytes` + `mimeType`, not a Blob.
      const url = URL.createObjectURL(
        new Blob([stored.bytes], { type: stored.mimeType }),
      );
      const a = document.createElement("a");
      a.href = url;
      // The stored name has its extension stripped on import, so the saved
      // file gets it back from the stored MIME — otherwise it has no type.
      a.download = `${photo.name}${extFromMime(stored.mimeType)}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't save this image");
    } finally {
      setSaving(false);
    }
  }, [photo]);

  if (!photo) return null;

  const dims =
    photo.origWidth && photo.origHeight
      ? `${photo.origWidth}×${photo.origHeight}`
      : null;
  const meta = [dims, formatBytes(photo.byteSize)].filter(Boolean).join(" · ");

  return (
    <div className="absolute inset-0 z-[var(--z-mobile-viewer)] flex flex-col bg-bg-primary">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text-primary">
            {photo.name}
          </p>
          <p className="text-xs text-text-muted">
            {index + 1} of {photos.length}
            {meta ? ` · ${meta}` : ""}
          </p>
        </div>
        <Button
          size="tiny"
          aria-label="Download image"
          title="Download image"
          disabled={saving}
          onClick={() => void handleDownload()}
        >
          <Download className="h-4 w-4" />
        </Button>
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
            <Button
              size="large"
              onClick={() => goto(-1)}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2"
            >
              <ChevronLeft />
            </Button>
            <Button
              size="large"
              onClick={() => goto(1)}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <ChevronRight />
            </Button>
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
  const heicOn = useBetaOn("heic-import");
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);

  const pendingImports = useGalleryStore((s) => s.pendingImports);
  // Which tiles have no pixels yet (the grid's one `aria-busy`), and whether
  // the grid is loading as one piece — the desktop gallery's rule, same hook.
  const gallery = useGalleryLoading({
    itemIds: photos.map((p) => p.id),
    pendingImports: pendingImports.length,
  });
  // Store flag, not a local useState: dialog visibility is UI-chrome state and
  // every other dialog in the app already lives in useUIStore. It also means a
  // future entry point (a palette command, a `#/settings` deep link) can open
  // this without MobileShell exposing a handle.
  const settingsOpen = useUIStore((s) => s.mobileSettingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setMobileSettingsOpen);

  // The viewed photo was deleted (confirm dialog → handleRemovePhoto) —
  // fall back to the grid rather than a blank viewer.
  useEffect(() => {
    if (viewerId && !photos.some((p) => p.id === viewerId)) setViewerId(null);
  }, [viewerId, photos]);

  // Same image filter as NewActions.processFiles: the mime check plus .svg
  // (and, Beta, .heic) files whose source hands over an empty mime
  // (handleAddPhotos converts those at the boundary).
  const handlePicked = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const images = Array.from(list).filter(isImportableFile);
      if (images.length) onAddFiles(images);
    },
    [onAddFiles],
  );

  // The editor under this layer is COVERED, not gone — it keeps running so a
  // widened window resumes into live state (see AppShell). But covered is not
  // enough: measured 09-28 at 390px, once a photo is added the editor's chrome
  // mounts beneath this layer and Tab walked from "Add Images" straight into
  // 27 controls nobody could see — New, Tools, Gallery, Review, Export…
  //
  // `inert` on the editor's container takes all of it out of the tab order and
  // the accessibility tree while leaving it mounted and running. It goes on the
  // CONTAINER, not on a snapshot of siblings: the chrome that caused this
  // mounts LATER, after a photo is added, and a snapshot would miss it.
  //
  // So this layer portals itself to <body> (it is `fixed`, so its position
  // never depended on where it sat in the tree), and the whole .app-shell goes
  // inert under it. Dialogs are Radix portals at z-dialog (50), above this
  // layer's 48, so the shared confirms and the mobile notice still work.
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".app-shell");
    if (!shell) return;
    const wasInert = shell.hasAttribute("inert");
    shell.setAttribute("inert", "");
    return () => {
      // Only undo what this did — something else may have wanted it inert.
      if (!wasInert) shell.removeAttribute("inert");
    };
  }, []);

  const layer = (
    <div className="fixed inset-0 z-[var(--z-mobile)] flex flex-col bg-bg-primary">
      {/* Header — logo + name on the left, settings and sign-in / avatar on the
          right, in the top bar's own cog-then-user order.

          MEASURED before the cog went in (390px, signed out): the name block is
          `flex-1` at 272px while its widest line — the subtitle — needs 134px.
          A 44px control plus the 10px gap takes the block to 218px, still 84px
          of slack, and neither line truncates. There is room for a third
          control here; it did not have to go anywhere else. */}
      <div className="flex items-center gap-2.5 border-b border-border bg-bg-secondary px-4 py-2.5">
        <img src={horseLogo} alt="" className="h-9 w-9 drop-shadow" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold tracking-wide text-text-primary">
            Image Horse
          </h1>
          <p className="text-xs text-text-muted">Mobile — upload &amp; view</p>
        </div>
        {/* 44px, not IconButton's default 30px box: this is the touch surface,
            and 30px is under the WCAG 2.5.5 target size. The glyph inside stays
            18px, so it reads at the same weight as the top bar's cog — only the
            tappable area grows. */}
        <IconButton
          icon={Settings}
          label="Settings"
          title="Theme and motion"
          standalone
          className="h-11 w-11 rounded-lg"
          onClick={() => setSettingsOpen(true)}
        />
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
            {/* min-h-11: 44px, the phone's touch floor. `size="large"` is 38px,
                which is right for a mouse and short for a thumb — measured
                122x38 at 390 and 320 (UI Night 6 §6). Scoped here, not on the
                shared size: this layer only exists at phone width. */}
            <Button
              size="large"
              className="min-h-11 w-full"
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              Add Images
            </Button>
            <p className="text-xs text-text-secondary">
              {heicOn
                ? "Supports PNG, JPG, GIF, WebP, AVIF, HEIC, SVG"
                : "Supports PNG, JPG, GIF, WebP, AVIF, SVG"}
            </p>
          </div>
        </div>
      ) : (
        <GalleryLoadingRegion state={gallery} className="flex min-h-0 flex-1 flex-col">
          <div ref={gallery.setRoot} data-skeleton-skip className="min-h-0 flex-1 overflow-y-auto p-3 pb-24">
            {/* ONE `aria-busy` for the grid, not one per tile. Thirty tiles
                each announcing their own "Loading" is a worse experience than
                silence; the grid says it once while any tile is still
                decoding, and the tile placeholders are `decorative`. */}
            <div
              className="grid grid-cols-3 content-start items-start gap-2"
              aria-busy={gallery.busy}
            >
              {photos.map((entry) => (
                <MobileThumb
                  key={entry.id}
                  entry={entry}
                  onOpen={() => setViewerId(entry.id)}
                  onPendingChange={gallery.reportPending}
                />
              ))}
              {/* Files an import is still opening — same tile as the desktop. */}
              {pendingImports.map((p) => (
                <PendingImportTile key={p.id} name={p.name} vertical />
              ))}
            </div>
          </div>

          {/* Count readout + the one-way-in Add button, pinned to the bottom
              like the status bar. */}
          <div inert={gallery.loading || undefined} data-gallery-chrome="" className="flex items-center gap-3 border-t border-border bg-bg-secondary px-4 py-3">
            <p className="flex-1 text-xs text-text-muted">
              {photos.length} of {maxPhotos} photos
            </p>
            <Button size="large" className="min-h-11" onClick={() => inputRef.current?.click()}>
              <ImagePlus className="h-4 w-4" />
              Add Images
            </Button>
          </div>
        </GalleryLoadingRegion>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={heicOn ? `image/*,.svg,${HEIC_ACCEPT}` : "image/*,.svg"}
        multiple
        className="hidden"
        onChange={(e) => {
          handlePicked(e.target.files);
          // Allow re-picking the same file(s) next time.
          e.target.value = "";
        }}
      />

      <MobileSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />

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

  return createPortal(layer, document.body);
}
