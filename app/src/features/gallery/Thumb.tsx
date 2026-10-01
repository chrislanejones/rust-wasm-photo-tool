import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Zap, Trash2, ImageOff } from "lucide-react";
import { springPop, thumbEnter, hoverPop, fadeIn } from "@/lib/animations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes } from "@/lib/format";
import { sizeDeltaPercent } from "@/lib/sizeDelta";
import { useThumbImage } from "./useThumbImage";
import { BatchCropThumbShade } from "./BatchCropThumbShade";
import type { PhotoEntry } from "./GalleryBar";

export interface ThumbProps {
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
  /** Report whether this tile still has no pixels, for the gallery's one `aria-busy`. */
  onPendingChange: (id: string, pending: boolean) => void;
}

export function Thumb({ entry, index, isActive, onSelect, onRemove, progress, savings, isModified, selected, selectionActive, onToggleSelect, vertical, onPendingChange }: ThumbProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  // A thumbnail is either a placeholder or the photo — never a gray photo.
  // The object URL, the decode and the grace period all live in the hook.
  const thumb = useThumbImage(entry.thumbBlob);

  // One `aria-busy` belongs to the gallery, not to thirty tiles, so each tile
  // reports whether it has pixels yet and the container sums them. Cleared on
  // unmount: a tile removed mid-decode must not leave the gallery busy for ever.
  useEffect(() => {
    onPendingChange(entry.id, thumb.pending);
  }, [onPendingChange, entry.id, thumb.pending]);
  useEffect(() => () => onPendingChange(entry.id, false), [onPendingChange, entry.id]);

  const isCompressing = progress !== undefined && progress >= 0 && progress < 100;
  const isDone = progress === 100;
  const isError = progress === -1;
  // `savingsPercent` is SIGNED: positive = smaller than the upload, negative =
  // bigger. Both are worth showing — the badge used to require > 0, so a photo
  // that GREW (an upscale, or a quality raised past the original) showed no
  // badge at all and looked untouched. Growth is unbounded and routinely passes
  // 100%: a file 2.5x the upload reads "+150%".
  //
  // Read from the entry's own sizes first. The separate `savings` map used to
  // be the only source, and it drifted: Auto Compress measured against the
  // CURRENT file rather than the upload (so a second run reset the badge), and
  // Apply Compression flashed an area×quality guess. The map is kept only as a
  // fallback for an entry with no recorded upload size.
  const sizeDelta = sizeDeltaPercent(entry) ?? savings?.savingsPercent ?? 0;
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
          whileHover="hover"
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
      {/* Only once there is a picture. Rendered unconditionally it shows
          THROUGH the placeholder, which is a checkerboard where a photo is
          supposed to be arriving — the exact "failed image load" reading the
          comment above spent twenty lines fixing. */}
      {thumb.src && <div className="absolute inset-0 checkerboard rounded-lg" />}

      {/* ⚠️ EVERY BRANCH HERE IS IN FLOW AT THE SAME SIZE, and that is
          load-bearing rather than tidy. The vertical grid is `items-start
          content-start` (see the container below), so a tile's row height
          comes from its in-flow child. An absolutely-positioned placeholder
          leaves the tile with no in-flow content, the row collapses, and every
          tile under it jumps when the photo lands. `w-full aspect-square` is
          also exactly right in the strip, whose tile is a fixed 96×96.

          The image pops inside the clipped card — hoverPop from
          lib/animations.ts, the same definition the tool tiles use. There is no
          develop any more: a thumbnail is a placeholder or the photo. */}
      {thumb.src ? (
        <motion.img
          ref={imgRef}
          variants={hoverPop}
          src={thumb.src}
          alt={entry.name}
          draggable={false}
          decoding="async"
        />
      ) : thumb.failed ? (
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
        <Skeleton variant="tile" decorative loading={thumb.showSkeleton} className="w-full">
          <div className="w-full aspect-square" aria-hidden="true" />
        </Skeleton>
      )}
      <BatchCropThumbShade entry={entry} isActive={isActive} cover={Boolean(vertical)} />

      <AnimatePresence>
        {isCompressing && (
          <motion.div
            key="compressing"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
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
            transition={springPop}
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
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
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
        aria-label="Remove image"
        title="Remove"
        // focus-visible:opacity-100 — this button is opacity-0 until hover, so a
        // keyboard user tabbing through the gallery landed on it completely
        // INVISIBLE: opacity 0, and opacity hides an element's outline too, so
        // the global button:focus-visible ring could not show (WCAG 2.4.7,
        // measured in QC 09-27-2026). The Select toggle beside it gets the same.
        className="absolute bottom-1 left-1 z-30 flex h-5 w-5 items-center justify-center rounded-md bg-red-600/90 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all"
      >
        <Trash2 className="h-3 w-3" />
      </button>

      {/* Multi-select checkbox — bottom-right; shows on hover, and stays
          visible for every thumb once a selection has started. */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelect(e.shiftKey); }}
        // A toggle: a stable name, with aria-pressed saying which way it is.
        // The only name used to be this flipping title.
        aria-label="Select image"
        aria-pressed={selected}
        title={selected ? "Deselect" : "Select"}
        /* ⚠️ `bg-accent` IS NOT THE BROWN, and that was the bug. Tailwind's
           `accent` maps to `--accent-ui` — a pale cream SURFACE (#ece6db light,
           #2b2b2b dark) — while the brand brown is `--accent` / `--primary`,
           which has no `accent` utility. A white check on #ece6db measures
           1.24:1: invisible in light mode. It survived because the same class
           gives 14.16:1 in dark, so the bug only existed for half the users.

           A BROWN CHIP WITH A DARK TICK was the obvious fix and measures
           worse where it matters. The tick is fine (4.54:1 light), but the
           CHIP is only 2.81:1 against a white card — so on the checkerboard
           behind a transparent thumbnail the chip itself disappears, which is
           the complaint this started from. A control you cannot find is not
           improved by the tick inside it being legible.

           So: `theme-primary-foreground` (#3a3128) as the CHIP with a white
           tick. 12.73:1 for the tick AND 12.73:1 for the chip against the card,
           and — because that token is the same value in both themes — the
           control looks identical in light and dark instead of flipping. The
           border stays `theme-primary` so the chip still echoes the brown ring
           that marks a selected thumbnail.

           ⚠️ Using a *-foreground token as a background is deliberate, not a
           slip. This chip sits on an arbitrary PHOTO, so it needs a color that
           does not follow the panel — and that token is the only theme-stable
           dark the palette has.

           The unselected state stays a scrim-plus-border rather than a theme
           color: it sits on an arbitrary photo, so it needs to work against
           unknown pixels rather than against the panel. The border is stronger
           now, and the tick is faintly present instead of fully transparent so
           the control reads as a checkbox before you hover it. */
        className={`absolute bottom-1 right-1 z-30 flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
          selected
            ? "bg-theme-primary-foreground border-theme-primary text-white opacity-100"
            : "bg-black/55 border-white/80 text-white/45"
        } ${selectionActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"}`}
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
