// Batch › Bulk — WHO is in the bulk. A grid of the gallery's own thumbnails,
// each one a toggle: a photo lit and marked with its number is in the pass, a
// dimmed one with a minus is the odd one out and the pass skips it whole.
//
// WHY A PICKER AND NOT THE GALLERY'S CHECKBOXES: those mean "the selection",
// which drives Delete All, Duplicate and Export ZIP. Borrowing them here would
// make two unrelated meanings share one set of marks, and holding a photo back
// from a crop is not the same act as ticking it to delete. So the Bulk panel
// carries its own picker and the gallery is untouched — except for the one
// shortcut below, which READS the selection rather than owning it.
//
// The tiles are numbered in gallery order, which is how a person refers to a
// photo out loud ("two and five"), and named with the file so the number is
// never the only handle on which tile is which.
import { Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolButton } from "@/components/ui/tool-button";
import { useThumbImage } from "@/features/gallery/useThumbImage";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { bulkPhotos, heldCount, useBatchCropStore } from "@/stores/useBatchCropStore";
import type { PhotoEntry } from "@/features/gallery/GalleryBar";

/** One photo: a toggle button carrying its own thumbnail. Split out because
 *  the thumbnail hook cannot run in a loop. */
function BulkTile({
  entry,
  index,
  held,
  onToggle,
}: {
  entry: PhotoEntry;
  /** 1-based position in the gallery, which is the number shown. */
  index: number;
  held: boolean;
  onToggle: () => void;
}) {
  const thumb = useThumbImage(entry.thumbBlob);
  return (
    <ToolButton
      active={!held}
      aria-pressed={!held}
      aria-label={`${index}. ${entry.name}, ${held ? "held out of the bulk" : "in the bulk"}`}
      title={entry.name}
      onClick={onToggle}
      // `aspect-square` is the house tile shape (SubtoolButton, the ratio grid)
      // and it is load-bearing here: the photo is `absolute`, so nothing in flow
      // would give the row a height and the whole grid would collapse to
      // hairlines. `p-0` for the same reason — `inset-0` resolves against the
      // PADDING box, so the base `px-3 py-2` would inset the photo.
      className={`relative aspect-square w-full overflow-hidden p-0 ${
        held ? "border-dashed opacity-50" : ""
      }`}
    >
      {/* Same rule as the gallery tile: a thumbnail is the photo or it is
          nothing. The checkerboard is the "arriving" state; there is no gray
          develop between the two (see Thumb.tsx). */}
      {thumb.src ? (
        <img
          src={thumb.src}
          alt=""
          draggable={false}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true" className="checkerboard absolute inset-0" />
      )}
      {/* The number, top-left. A pill because it sits on an arbitrary photo.
          No z-index: these are positioned siblings that come AFTER the image in
          DOM order, which is already what puts them on top of it — a stacking
          number here would be one more thing to raise later. */}
      <span
        aria-hidden="true"
        className="absolute left-0.5 top-0.5 rounded-md bg-black/70 px-1 text-2xs font-semibold tabular-nums text-on-photo"
      >
        {index}
      </span>
      {held && (
        <span
          aria-hidden="true"
          className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-md bg-black/70 text-on-photo"
        >
          <Minus className="h-3 w-3" />
        </span>
      )}
    </ToolButton>
  );
}

/** The picker's own section. Renders nothing when there is no gallery to pick
 *  from — the Batch rail tile is disabled under two photos anyway. */
export function BulkHeldPicker({ photos }: { photos: PhotoEntry[] }) {
  const held = useBatchCropStore((s) => s.held);
  const toggleHeld = useBatchCropStore((s) => s.toggleHeld);
  const clearHeld = useBatchCropStore((s) => s.clearHeld);
  // Read, never written: the gallery's own multi-select is the handiest way to
  // say "these two", so the panel offers to hold exactly those back. A photo
  // already held is skipped rather than toggled — the button only ever moves
  // photos OUT, so pressing it twice cannot quietly put one back IN.
  const selectedIds = useGalleryStore((s) => s.selectedIds);
  const toHold = [...selectedIds].filter((id) => !held[id]);

  if (photos.length === 0) return null;

  const inBulk = bulkPhotos({ held }, photos).length;
  const outCount = heldCount({ held }, photos);
  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-label="Which photos are in the bulk"
        className="grid grid-cols-4 gap-1"
      >
        {photos.map((entry, i) => (
          <BulkTile
            key={entry.id}
            entry={entry}
            index={i + 1}
            held={held[entry.id] === true}
            onToggle={() => toggleHeld(entry.id)}
          />
        ))}
      </div>
      {/* Count on the left, the two actions on the right — and they WRAP rather
          than squeeze. A 252px column cannot hold "4 in the bulk · 2 held out"
          and two buttons side by side, and a ghost button squeezed to 24px
          breaks its own label across five lines. */}
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="text-2xs text-theme-muted-foreground">
          {outCount === 0
            ? `${photos.length} in the bulk`
            : `${inBulk} in the bulk · ${outCount} held out`}
        </span>
        {toHold.length > 0 && (
          <Button
            variant="ghost"
            className="px-2 py-1 text-2xs"
            onClick={() => {
              for (const id of toHold) toggleHeld(id);
            }}
          >
            {`Hold out ${toHold.length} selected`}
          </Button>
        )}
        {outCount > 0 && (
          <Button
            variant="ghost"
            className="px-2 py-1 text-2xs"
            onClick={clearHeld}
          >
            Put them back
          </Button>
        )}
      </div>
    </div>
  );
}