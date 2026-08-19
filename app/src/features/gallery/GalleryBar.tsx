import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { slideFromBottom, slideFromLeft, panelSpacingTransition, instantTransition, thumbEnter } from "@/lib/animations";
import { Check, Zap, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Trash2, Download, SquareX, Copy, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { TinyNumberBox } from "@/components/ui/tiny-number-box";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes } from "@/lib/format";
import { TIERS } from "@/lib/tiers";
import { PANEL_OPEN_GUTTER } from "@/lib/layout";

export interface PhotoEntry {
  id: string;
  name: string;
  mimeType: string;
  byteSize: number;
  /** Immutable size at upload (bytes). `byteSize` may shrink after compress. */
  originalByteSize: number;
  origWidth: number;
  origHeight: number;
  workingWidth: number;
  workingHeight: number;
  /** WebP thumbnail blob for the gallery strip. */
  thumbBlob: Blob;
  /** SHA-256 hex key into IndexedDB for the untouched original bytes. */
  originalKey: string;
  /** Immutable key of the *upload* original — A/B compare baseline. Never
   *  replaced by Apply Compression or Auto Compress. */
  uploadKey?: string;
}

interface Props {
  photos: PhotoEntry[];
  activeId: string | null;
  onSelect: (entry: PhotoEntry) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  showTools: boolean;
  showHistory: boolean;
  /** Reduce Motion preference — when on, skip the margin-slide animation. */
  reduceMotion?: boolean;
  /** Narrow window — side panels overlay, so the gallery bar stays full-bleed. */
  narrow?: boolean;
  compressionProgress: Record<string, number>;
  compressionSavings?: Record<string, { savingsPercent: number }>;
  modifiedPhotos?: Set<string>;
  /** Per-tier gallery cap, shown next to the count (e.g. "3 / 12"). */
  maxPhotos?: number;
  /** Remove every photo from the gallery. */
  onDeleteAll?: () => void;
  /** Remove the currently-selected photos. */
  onDeleteSelected?: () => void;
  /** Export the currently-selected photos as a ZIP. */
  onExportSelected?: () => void;
  /** Duplicate the currently-selected photos. */
  onDuplicateSelected?: () => void;
  /** Currently-selected photo ids (lifted to the parent). */
  selectedIds: Set<string>;
  /** Toggle a photo's selection. */
  onToggleSelect: (id: string) => void;
  /** Add a contiguous run of photo ids to the selection (shift+click range). */
  onSelectRange?: (ids: string[]) => void;
  /** Clear the entire selection (the "Unselect" action). */
  onClearSelection?: () => void;
  /** Vertical mode: the same gallery inverted for the compact master bar —
   *  self-positions as the master-bar content box, stacks thumbs in a column,
   *  and scrolls with up/down arrows (no scrollbar). */
  vertical?: boolean;
}

interface ThumbProps {
  entry: PhotoEntry;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
  progress?: number;
  savings?: { savingsPercent: number };
  isModified?: boolean;
  /** Whether this thumb is checked in the multi-select. */
  selected: boolean;
  /** True once at least one photo is selected — keeps checkboxes always visible. */
  selectionActive: boolean;
  /** Toggle this thumb's checkbox. */
  onToggleSelect: (shiftKey: boolean) => void;
  /** Vertical gallery: fill the grid column (square) instead of the fixed 96px. */
  vertical?: boolean;
}

function Thumb({ entry, index, isActive, onSelect, onRemove, progress, savings, isModified, selected, selectionActive, onToggleSelect, vertical }: ThumbProps) {
  const [loading, setLoading] = useState(true);
  const [thumbUrl, setThumbUrl] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(entry.thumbBlob);
    setThumbUrl(url);
    setLoading(true);
    return () => URL.revokeObjectURL(url);
  }, [entry.thumbBlob]);

  const isCompressing = progress !== undefined && progress >= 0 && progress < 100;
  const isDone = progress === 100;
  const isError = progress === -1;
  // `savingsPercent` is SIGNED: positive = smaller than the upload, negative =
  // bigger. Both are worth showing — the badge used to require > 0, so a photo
  // that GREW (an upscale, or a quality raised past the original) showed no
  // badge at all and looked untouched. Growth is unbounded and routinely passes
  // 100%: a file 2.5x the upload reads "+150%".
  const sizeDelta = savings?.savingsPercent ?? 0;
  const hasSavings = sizeDelta !== 0;
  const grew = sizeDelta < 0;

  const dims =
    entry.origWidth && entry.origHeight
      ? `${entry.origWidth}×${entry.origHeight}`
      : null;
  const meta = [formatBytes(entry.byteSize), dims].filter(Boolean).join(" · ");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          data-id={entry.id}
          role="button"
          tabIndex={0}
          aria-label={`Select photo ${entry.name}`}
          aria-pressed={isActive}
          className={`photo-thumb group ${isActive ? "active" : ""} ${selected ? "selected" : ""} ${vertical ? "photo-thumb-grid" : ""} relative`}
          onClick={onSelect}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect();
            }
          }}
          {...(vertical ? {} : thumbEnter(index))}
          style={vertical ? { width: "100%", height: "auto" } : undefined}
        >
      {/* Unconditional. It used to be gated on the SOURCE file's mime being
          png/webp/svg, which tested the wrong thing twice over: the thumbnail
          is re-encoded to WebP for every photo (makeThumbnailFromPixels), so
          the source format says nothing about the pixels being drawn, and a
          JPEG that gained transparency from the artboard or the eraser still
          got no checker while a fully opaque PNG always did.

          No gate is needed to hide it, either — this div is BEHIND the image
          in paint order, so a thumb that fills its tile occludes it. In the
          strip that leaves the letterbox bars on non-square photos, which is
          the intended look; in the vertical grid (object-fit: cover) the image
          fills the tile and nothing shows but real alpha.

          THAT SECOND HALF WAS ASSERTED IN v7.72 AND WAS FALSE AT THE TIME.
          The grid's tiles were stretching to fill a flex-1 panel, so the image
          was 108px inside a 300px tile and this div — `absolute inset-0` —
          filled the rest: 188px of bare checkerboard under every thumbnail,
          every format. The layout bug predates v7.72; deleting the mime gate
          is what made it visible. Fixed by `items-start` on the grid container
          below, where the reasoning lives. The claim is true now; it was not
          when it was written. */}
      <div className="absolute inset-0 checkerboard rounded-lg" />
      <img
        ref={imgRef}
        src={thumbUrl || undefined}
        alt={entry.name}
        draggable={false}
        decoding="async"
        loading="lazy"
        onLoad={() => setLoading(false)}
        onError={() => setLoading(false)}
      />

      {loading && (
        <Skeleton className="absolute inset-0 z-10 rounded-lg" aria-label={`Loading ${entry.name}`} />
      )}

      <AnimatePresence>
        {isCompressing && (
          <motion.div
            key="compressing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg overflow-hidden"
          >
            <div
              className="absolute inset-0 bg-black/60 transition-all duration-300 ease-out"
              style={{ clipPath: `inset(0 0 ${100 - (progress ?? 0)}% 0)` }}
            />
            <div
              className="absolute inset-0 bg-emerald-500/20 transition-all duration-300 ease-out"
              style={{ clipPath: `inset(0 0 ${100 - (progress ?? 0)}% 0)` }}
            />
            <span className="relative z-20 text-white text-lg font-bold font-mono drop-shadow-lg tabular-nums">
              {progress}%
            </span>
          </motion.div>
        )}

        {isDone && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-emerald-500/30"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
              <Check className="h-3.5 w-3.5 text-white" />
            </div>
          </motion.div>
        )}

        {isError && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-red-500/30"
          >
            <span className="text-white text-xs font-bold">!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {hasSavings && (
        <div
          className={`absolute top-1 left-1 z-20 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-white text-2xs font-bold font-mono shadow-lg pointer-events-none ${
            grew ? "bg-amber-500/90" : "bg-emerald-500/90"
          }`}
          title={
            grew
              ? `${Math.abs(sizeDelta)}% larger than the uploaded file`
              : `${sizeDelta}% smaller than the uploaded file`
          }
        >
          <Zap className="h-2.5 w-2.5" />
          {grew ? "+" : "-"}
          {Math.abs(sizeDelta)}%
        </div>
      )}

      {isModified && (
        <div className="photo-thumb-modified" />
      )}

      {/* Remove — bottom-left, same rounded-square shape as the checkbox, red.
          Shown on hover only. */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        title="Remove"
        className="absolute bottom-1 left-1 z-30 flex h-5 w-5 items-center justify-center rounded-md bg-red-600/90 text-white opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 className="h-3 w-3" />
      </button>

      {/* Multi-select checkbox — bottom-right; shows on hover, and stays
          visible for every thumb once a selection has started. */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelect(e.shiftKey); }}
        title={selected ? "Deselect" : "Select"}
        className={`absolute bottom-1 right-1 z-30 flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
          selected
            ? "bg-accent border-accent text-white opacity-100"
            : "bg-black/50 border-white/70 text-transparent"
        } ${selectionActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
      >
        <Check className="h-3 w-3" />
      </button>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs leading-snug">
        <p className="font-semibold">{entry.name}</p>
        {meta && <p className="text-text-muted">{meta}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

/** The gallery count readout — "Selected: # of #" while selecting, otherwise
 *  "# of # — # max (i)". Rendered in the header (horizontal) or as a footer
 *  (vertical / master bar). */
function GalleryCount({
  selectionActive,
  selectedCount,
  total,
  maxPhotos,
}: {
  selectionActive: boolean;
  selectedCount: number;
  total: number;
  maxPhotos?: number;
}) {
  return (
    <h2 className="flex items-center gap-2 text-xs font-semibold">
      <span className="flex items-center gap-1 text-xs font-normal text-text-muted">
        {selectionActive ? (
          <>
            <span>Selected:</span>
            <TinyNumberBox>{selectedCount}</TinyNumberBox>
            <span>of</span>
            <TinyNumberBox>{total}</TinyNumberBox>
          </>
        ) : (
          <>
            <TinyNumberBox>{total}</TinyNumberBox>
            <span>of</span>
            <TinyNumberBox>{total}</TinyNumberBox>
            {maxPhotos != null && (
              <>
                <span>—</span>
                <TinyNumberBox>{maxPhotos}</TinyNumberBox>
                <span>max</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Why this limit?"
                      className="text-text-muted hover:text-text-primary transition-colors"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="font-semibold mb-1.5">
                      Gallery photos per session
                    </p>
                    <ul className="space-y-1 text-xs">
                      <li className="flex items-center justify-between gap-6">
                        <span>Logged out</span>
                        <span className="font-mono tabular-nums">
                          {TIERS.demo.galleryLimit}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-6">
                        <span>Logged in</span>
                        <span className="font-mono tabular-nums">
                          {TIERS.loggedIn.galleryLimit}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-6">
                        <span>Paid · {TIERS.paid.tag}</span>
                        <span className="font-mono tabular-nums">
                          {TIERS.paid.galleryLimit}
                        </span>
                      </li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </>
        )}
      </span>
    </h2>
  );
}

export function GalleryBar({
  photos,
  activeId,
  onSelect,
  onRemove,
  showTools,
  showHistory,
  reduceMotion,
  narrow,
  compressionProgress,
  compressionSavings,
  modifiedPhotos,
  maxPhotos,
  onDeleteAll,
  onDeleteSelected,
  onExportSelected,
  onDuplicateSelected,
  selectedIds,
  onToggleSelect,
  onSelectRange,
  onClearSelection,
  vertical = false,
}: Props) {
  const stripRef = useRef<HTMLDivElement>(null);
  const selectionActive = selectedIds.size > 0;
  // Shift+click range anchor: the index of the last checkbox the user
  // toggled without shift. Shift+clicking another checkbox selects the whole
  // run between the two (inclusive), like every file manager. Plain clicks
  // move the anchor; the anchor also moves to the end of a range so chained
  // shift-clicks extend from where you left off.
  const rangeAnchorRef = useRef<number | null>(null);

  // Overflow-aware arrow state. Each arrow is enabled only when the strip can
  // actually scroll that way. When all thumbs fit (e.g. desktop, ≤12 photos)
  // there's no overflow so both arrows disable; on narrow/mobile widths the
  // strip overflows and the arrows light up.
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    if (vertical) {
      setCanScrollLeft(el.scrollTop > 1);
      setCanScrollRight(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
    } else {
      setCanScrollLeft(el.scrollLeft > 1);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }
  }, [vertical]);

  useEffect(() => {
    if (!activeId || !stripRef.current) return;
    const el = stripRef.current.querySelector<HTMLElement>(`[data-id="${activeId}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [activeId, photos.length]);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, photos.length, showTools, showHistory]);

  if (photos.length === 0) return null;

  return (
    <motion.div
      variants={vertical ? slideFromLeft : slideFromBottom}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={
        vertical
          ? // Master-bar content box: flush below the 48px chrome (top 56).
            "fixed left-2 top-[56px] bottom-[var(--panel-bottom)] z-[var(--z-panel)] flex w-[252px] flex-col overflow-hidden rounded-b-xl border border-t-0 border-border bg-bg-secondary"
          : "fixed left-0 right-0 bottom-[var(--panel-bottom)] z-[var(--z-panel)] pointer-events-none"
      }
      style={vertical ? { boxShadow: "var(--shadow-panel)" } : undefined}
    >
      <motion.div
        animate={
          vertical
            ? undefined
            : {
                marginLeft: !narrow && showTools ? PANEL_OPEN_GUTTER : 12,
                marginRight: !narrow && showHistory ? PANEL_OPEN_GUTTER : 12,
              }
        }
        transition={reduceMotion ? instantTransition : panelSpacingTransition}
        style={vertical ? undefined : { position: "relative" }}
        className={
          vertical
            ? "flex min-h-0 flex-1 flex-col overflow-hidden"
            : "pointer-events-auto bg-bg-secondary/90 backdrop-blur-sm rounded-xl shadow-2xl border border-border"
        }
      >
        <div className={vertical ? "flex min-h-0 flex-1 flex-col p-3" : "p-4"}>
          <div
            className={
              vertical
                ? // Divider + padding so the photos never crowd the count/actions
                  // (the header grows when a selection appears).
                  "mb-3 flex flex-col gap-2 border-b border-border pb-3"
                : "flex items-center justify-between mb-3"
            }
          >
            {/* Horizontal: count sits left of the actions. Vertical: it moves
                to a footer at the bottom of the bar (rendered below). */}
            {!vertical && (
              <GalleryCount
                selectionActive={selectionActive}
                selectedCount={selectedIds.size}
                total={photos.length}
                maxPhotos={maxPhotos}
              />
            )}
            <div
              className={
                vertical
                  ? // Even 2-up grid of full-width action buttons (no ragged wrap).
                    "grid grid-cols-2 gap-1.5 [&>button]:w-full"
                  : "flex items-center gap-1"
              }
            >
              {selectionActive && onExportSelected && (
                <Button size="large"
                  onClick={onExportSelected}
                  title="Export selected images"
                  className="px-2.5 py-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Export Selected</span>
                </Button>
              )}
              {selectionActive && onDuplicateSelected && (
                <Button size="large"
                  onClick={onDuplicateSelected}
                  title="Duplicate selected images"
                  className="px-2.5 py-1.5 text-xs"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Duplicate</span>
                </Button>
              )}
              {selectionActive && onDeleteSelected && (
                <Button size="large"
                  onClick={onDeleteSelected}
                  title="Delete selected images"
                  className="px-2.5 py-1.5 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Delete Selected</span>
                </Button>
              )}
              {onDeleteAll && (
                <Button size="large"
                  onClick={onDeleteAll}
                  title="Delete all images"
                  className="px-2.5 py-1.5 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Delete All</span>
                </Button>
              )}
              {selectionActive && onClearSelection && (
                <Button size="large"
                  onClick={onClearSelection}
                  title="Clear selection"
                  className="px-2.5 py-1.5 text-xs"
                >
                  <SquareX className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Unselect</span>
                </Button>
              )}
            </div>
          </div>

          <div
            className={
              vertical
                ? // minmax(0,1fr) lets the strip row shrink below its content so
                  //  it scrolls (instead of squashing the tiles) when the header
                  //  grows with selection actions.
                  "grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 justify-items-center"
                : "grid grid-cols-[auto_1fr_auto] gap-2 items-center"
            }
          >
            <button
              onClick={() =>
                stripRef.current?.scrollBy(
                  vertical
                    ? { top: -220, behavior: "smooth" }
                    : { left: -220, behavior: "smooth" },
                )
              }
              disabled={!canScrollLeft}
              className="btn-icon flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label={vertical ? "Scroll up" : "Scroll left"}
            >
              {vertical ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>

            <div
              ref={stripRef}
              className={
                vertical
                  ? // Two thumbs per row, with breathing room between tiles + above.
                    //
                    // `items-start` is load-bearing, not cosmetic. This grid
                    // lives in a `flex-1` column, so without it the rows
                    // STRETCH to fill the panel: with four photos in a 640px
                    // panel each 108px thumbnail sat in a 300px tile. The
                    // image is unaffected (aspect-ratio 1 + object-fit cover),
                    // but the checkerboard behind it is `absolute inset-0` and
                    // filled the whole stretched tile — 188px of bare
                    // checkerboard under every thumbnail, reading as a failed
                    // image load.
                    //
                    // v7.72 made that visible: the checkerboard used to be
                    // gated on the source file's mime, so only PNG/WebP/SVG
                    // could show it. Removing the gate was right; this is the
                    // layout bug it uncovered, and it predates v7.72.
                    //
                    // `content-start` is the SECOND half, and the reason the
                    // two are here together is worth keeping.
                    //
                    // It was tried first, on its own, and measured as doing
                    // nothing — so an earlier version of this comment said it
                    // "does NOT fix it". That was true of the state it was
                    // measured in and wrong as a conclusion. While the items
                    // still stretched, they filled their tracks themselves and
                    // there was no free space for align-content to distribute,
                    // so it had nothing to do.
                    //
                    // Once `items-start` shrank the items, the leftover height
                    // moved somewhere else: `align-content` defaults to
                    // `stretch`, so the ROW TRACKS absorbed it instead. QC
                    // measured 99px tiles sitting in 215.7px tracks — ~117px of
                    // dead space per row, the checkerboard slab replaced by an
                    // empty one. Most obvious at tablet width.
                    //
                    // Two axes, two properties: items-start stops the ITEM
                    // stretching, content-start stops the TRACK stretching.
                    "grid w-full grid-cols-2 content-start items-start gap-x-3 gap-y-4 overflow-y-auto px-2 pt-3 pb-3"
                  : "flex gap-2 overflow-x-auto py-1.5 pl-2"
              }
              style={{ scrollbarWidth: "none" }}
            >
              {photos.map((entry, i) => (
                <Thumb
                  key={entry.id}
                  entry={entry}
                  index={i}
                  isActive={entry.id === activeId}
                  onSelect={() => onSelect(entry)}
                  onRemove={() => onRemove(entry.id)}
                  progress={compressionProgress?.[entry.id]}
                  savings={compressionSavings?.[entry.id]}
                  isModified={modifiedPhotos?.has(entry.id)}
                  selected={selectedIds.has(entry.id)}
                  selectionActive={selectionActive}
                  onToggleSelect={(shiftKey) => {
                    if (
                      shiftKey &&
                      onSelectRange &&
                      rangeAnchorRef.current !== null &&
                      rangeAnchorRef.current !== i
                    ) {
                      const a = Math.min(rangeAnchorRef.current, i);
                      const b = Math.max(rangeAnchorRef.current, i);
                      onSelectRange(photos.slice(a, b + 1).map((p) => p.id));
                    } else {
                      onToggleSelect(entry.id);
                    }
                    rangeAnchorRef.current = i;
                  }}
                  vertical={vertical}
                />
              ))}
            </div>

            <button
              onClick={() =>
                stripRef.current?.scrollBy(
                  vertical
                    ? { top: 220, behavior: "smooth" }
                    : { left: 220, behavior: "smooth" },
                )
              }
              disabled={!canScrollRight}
              className="btn-icon flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label={vertical ? "Scroll down" : "Scroll right"}
            >
              {vertical ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Vertical (master bar): the count readout is pinned to the bottom. */}
          {vertical && (
            <div className="mt-3 flex justify-center border-t border-border pt-3">
              <GalleryCount
                selectionActive={selectionActive}
                selectedCount={selectedIds.size}
                total={photos.length}
                maxPhotos={maxPhotos}
              />
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
