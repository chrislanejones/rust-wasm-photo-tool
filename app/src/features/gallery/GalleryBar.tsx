import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { slideFromBottom, slideFromLeft, springStandard, instantTransition } from "@/lib/animations";
import { Thumb } from "./Thumb";
import { usePhotoSwitching } from "@/hooks/usePhotoSwitching";
import { Zap, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Trash2, Download, SquareX } from "lucide-react";
import { PanelCloseButton } from "@/components/ui/panel-close-button";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { GalleryCount } from "./GalleryCount";
import { PendingImportTile } from "./PendingImportTile";
import { GalleryLoadingRegion } from "./GalleryLoadingRegion";
import { useGalleryLoading } from "./useGalleryLoading";
import { useActivityWhile } from "@/lib/activity";
import { useGalleryStore } from "@/stores/useGalleryStore";
import { PANEL_OPEN_GUTTER } from "@/lib/layout";
import { MASTER_BAR_CONTENT_BOX } from "@/components/master-bar/constants";

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
  /** Quality (1..100) the stored bytes were last LOSSY-encoded at, by Apply
   *  Compression or Auto Compress. Undefined for an untouched upload (its
   *  camera/encoder quality is unknown) and for a lossless PNG. Persisted with
   *  the gallery manifest, so it survives a reload for anonymous and signed-in
   *  sessions alike. Two readers: the Resize & Compress panel models a pending
   *  quality change RELATIVE to it (a file already at 75 does not shrink by
   *  25% again at 75), and "Apply Resize" re-encodes at it instead of at 100,
   *  which used to inflate an already-compressed photo several times over. */
  encodeQuality?: number;
}


interface Props {
  photos: PhotoEntry[];
  activeId: string | null;
  onSelect: (entry: PhotoEntry) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  /** Show the hover-reveal close in the top-left corner. Wide desktop layout
   *  only — AppShell passes false whenever the dock, the narrow drawers or the
   *  compact top bar are in play, where the chrome owns open/close instead. */
  closable?: boolean;
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
  /** Auto Compress & Resize — the same handler the Resize panel calls, so the
   *  two surfaces cannot drift. "selected" means the active photo when nothing
   *  is selected. */
  onAutoCompress?: (scope: "selected" | "all") => void;
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


/**
 * The gallery's right-hand action bar.
 *
 * THREE ARRANGEMENTS, ONE FOR EACH SELECTION STATE, because the same button
 * means different things depending on what is selected and a label that says
 * "Delete Selected" when nothing is selected is how people delete the wrong
 * thing. The scope is in the button text, always:
 *
 *   nothing selected   (i) [Compress Image] [Compress All]
 *                      │ [Delete All] [Export or Share Image]
 *   one selected       (i) [Compress Selected]
 *                      │ [Unselect] [Delete Image] [Export or Share Image]
 *   many selected      (i) [Compress Selected]
 *                      │ [Unselect] [Delete Selected] [Export or Share Images]
 *
 * Nothing here is new behavior — every handler already existed. `onAutoCompress`
 * is the same one the Resize panel calls, so the two surfaces cannot drift.
 */
function GalleryActions({
  selectedCount,
  totalCount,
  vertical,
  onAutoCompress,
  onClearSelection,
  onDeleteAll,
  onDeleteSelected,
  onExportSelected,
  only,
}: {
  selectedCount: number;
  totalCount: number;
  vertical?: boolean;
  onAutoCompress?: (scope: "selected" | "all") => void;
  onClearSelection?: () => void;
  onDeleteAll?: () => void;
  onDeleteSelected?: () => void;
  onExportSelected?: () => void;
  /** Render ONE half. The horizontal header places the compress block and the
   *  action block in separate grid columns, so it asks for them one at a time;
   *  compact renders both and stacks them. */
  only?: "compress" | "actions";
}) {
  const some = selectedCount > 0;
  const many = selectedCount > 1;
  // The WIDE row is a plain `Button size="default"` with nothing overridden
  // (Chris, 09-30-2026: "fix if not the standard ui buttons"). It used to be
  // size="large" with `px-2.5 py-1.5` pasted over it — a third size that is
  // neither `default` (px-3 py-2) nor `large` (px-4 py-2.5), so these seven
  // buttons were the only ones in the app at that measurement.

  /**
   * COMPACT USES THE SELECTION PANEL'S SHAPE: an equal-height grid of tiles,
   * icon above label, three to a row — the same read as Select's
   * All / Deselect / Delete / Copy / Cut. Wide keeps the single inline row,
   * where there is space for icon-beside-label.
   */
  const actionRow = vertical
    ? "grid grid-cols-3 gap-2 [grid-auto-rows:1fr] [&>button]:h-full [&>button]:w-full [&>button]:flex-col [&>button]:gap-1"
    : "flex items-center gap-1.5";
  // COMPACT is the exception that stays: a 3-up tile grid in a narrow column,
  // icon over label, where `default`'s horizontal padding would wrap every
  // label. It overrides padding on purpose and says so.
  const actionBtn = vertical ? "px-1.5 py-2 text-2xs" : undefined;
  /** Compact stacks icon over label, so the label must not be hidden there. */
  // sr-only, not hidden. `hidden` is display:none, which takes the text out of
  // the ACCESSIBILITY tree as well as off the screen — so below 640px every one
  // of these buttons was icon-only with a flaky `title` as its only name.
  // sr-only looks identical (gone below sm, shown above) but a screen reader
  // still reads the label. Seven buttons fixed by this one string.
  const label = vertical ? "inline" : "sr-only sm:not-sr-only";

  const actions = (
    <>
      {/* ── selection / delete / export ── */}
      <div className={actionRow}>
        {some && onClearSelection && (
          <Button size="default" onClick={onClearSelection} title="Clear selection" className={actionBtn}>
            <SquareX className="h-3.5 w-3.5" />
            <span className={label}>Unselect</span>
          </Button>
        )}

        {some
          ? onDeleteSelected && (
              <Button size="default" onClick={onDeleteSelected} title={many ? "Delete selected images" : "Delete this image"} className={actionBtn}>
                <Trash2 className="h-3.5 w-3.5" />
                <span className={label}>{many ? "Delete Selected" : vertical ? "Delete" : "Delete Image"}</span>
              </Button>
            )
          : onDeleteAll && (
              <Button size="default" onClick={onDeleteAll} title="Delete all images" className={actionBtn}>
                <Trash2 className="h-3.5 w-3.5" />
                <span className={label}>Delete All</span>
              </Button>
            )}

        {onExportSelected && (
          <Button size="default" onClick={onExportSelected} title={many ? "Export or share images" : "Export or share image"} className={actionBtn}>
            <Download className="h-3.5 w-3.5" />
            <span className={label}>
              {vertical ? "Export" : many ? "Export or Share Images" : "Export or Share Image"}
            </span>
          </Button>
        )}
      </div>
    </>
  );

  const compress = (
    <>
      {/* ── Compress — moved here from Enhance › Resize & Compress ──
          Plain Buttons, matching Delete All and Export beside them. There is no
          heading: the lightbulb carries what "compress" means here, which is
          the no-permanent-paragraphs rule the tool panels already follow, and
          the button text says the scope so a title would only repeat it. */}
      {onAutoCompress && (
        <div
          className={
            vertical
              ? "flex flex-col gap-1.5 border-t border-theme-border pt-2.5"
              : "flex flex-wrap items-center gap-1.5"
          }
        >
          <InfoTooltip
            label="Compress"
            info={
              <>
                One click, aiming at a web-ready file (~200&nbsp;KB): it re-encodes
                the photo, and if either side is over <strong>2500&nbsp;px</strong> it
                scales the image down as well.
                <br />
                <br />
                It stops at 1280&nbsp;px on the long edge, so it will never shrink a
                photo to mush chasing the target. The green badge on the thumbnail
                shows what you saved.
              </>
            }
          />
          {/* GRID, not a flex row: `auto-cols-fr` gives Compress Image and
              Compress All the SAME width whatever their labels measure, and
              `justify-center` centers the pair as a block. A flex row sized
              each button to its own text, so the two sat off-center and
              visibly mismatched.
              COMPACT STACKS. One column, full-width buttons — the vertical
              bar has no room to put two beside each other without clipping
              the labels. */}
          <div
            className={
              vertical
                ? "grid grid-cols-1 gap-1.5 [&>button]:w-full"
                : "grid grid-flow-col auto-cols-fr justify-center gap-1.5 [&>button]:w-full"
            }
          >
            {some ? (
              <Button size="default" onClick={() => onAutoCompress("selected")} title="Compress the selected photos">
                <Zap className="h-3.5 w-3.5" />
                <span className={label}>Compress Selected</span>
              </Button>
            ) : (
              <>
                <Button size="default" onClick={() => onAutoCompress("selected")} title="Compress the photo on the canvas">
                  <Zap className="h-3.5 w-3.5" />
                  <span className={label}>Compress Image</span>
                </Button>
                {/* Bolt, not the gallery icon. All three of these run the SAME
                    operation and differ only in scope, so the icon is the verb
                    ("compress") and the label is the scope — the gallery icon
                    made Compress All read as a different kind of action than
                    the button beside it. */}
                {totalCount > 1 && (
                  <Button size="default" onClick={() => onAutoCompress("all")} title="Compress every photo in the gallery">
                    <Zap className="h-3.5 w-3.5" />
                    <span className={label}>Compress All</span>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );

  // One half only — the horizontal grid asks for each column separately.
  if (only === "compress") return compress;
  if (only === "actions") return actions;

  return (
    <div
      className={
        vertical
          ? "flex flex-col gap-3"
          : "flex flex-wrap items-center justify-end gap-x-2 gap-y-1.5"
      }
    >
      {/* COMPACT stacks the actions on top and the compress block underneath,
          with a border instead of a rule. The horizontal arrangement is the
          header's three-column grid (see GalleryBar), not this. */}
      {vertical ? actions : compress}
      {!vertical && <span aria-hidden className="status-divider shrink-0" />}
      {vertical ? compress : actions}
    </div>
  );
}

export function GalleryBar({
  onClose,
  photos,
  activeId,
  onSelect,
  onRemove,
  showTools,
  showHistory,
  reduceMotion,
  narrow,
  closable = false,
  compressionProgress,
  compressionSavings,
  modifiedPhotos,
  maxPhotos,
  onDeleteAll,
  onDeleteSelected,
  onExportSelected,
  onAutoCompress,
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

  // True from the click until the requested photo's pixels are in the engine.
  // The gallery is the one surface that can show the gap, because it lights the
  // photo you asked for while the canvas still holds the previous one.
  const switching = usePhotoSwitching();

  // ONE busy flag for the gallery. Thirty tiles each announcing "Loading" is a
  // screen reader reading out a list of boxes, which is why the tile
  // placeholders are `decorative` and the strip's aria-busy plus the region's
  // one status are the only things that speak.
  // Files still being opened by an import — drawn as skeleton tiles after the
  // real ones, and part of the gallery's one aria-busy.
  const pendingImports = useGalleryStore((s) => s.pendingImports);
  // The card loads like Tools: past 300 ms with a tile in view still empty (or
  // an import in flight) the chrome goes skeleton in place and inert.
  const gallery = useGalleryLoading({
    itemIds: photos.map((p) => p.id),
    pendingImports: pendingImports.length,
  });
  // The status bar's loading indicator, while any tile is still decoding.
  useActivityWhile(gallery.busy);
  const chromeInert = gallery.loading || undefined;
  // The strip is both the scroll target (stripRef) and the observer root.
  const { setRoot } = gallery;
  const stripRefCallback = useCallback(
    (el: HTMLDivElement | null) => {
      stripRef.current = el;
      setRoot(el);
    },
    [setRoot],
  );

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
            MASTER_BAR_CONTENT_BOX
          : "fixed left-0 right-0 bottom-[var(--panel-bottom)] z-[var(--z-panel)] pointer-events-none"
      }
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
        transition={reduceMotion ? instantTransition : springStandard}
        style={vertical ? undefined : { position: "relative" }}
        className={
          vertical
            ? "flex min-h-0 flex-1 flex-col overflow-hidden"
            : "group pointer-events-auto bg-bg-secondary/90 backdrop-blur-sm rounded-xl shadow-2xl border border-border"
        }
      >
        {/* Hover the bar and a close appears top-left; the top bar's Gallery
            toggle brings it back. The docked (vertical) form is closed from the
            master bar's tabs instead. */}
        {closable && <PanelCloseButton label="Close Gallery" onClose={onClose} />}
        <GalleryLoadingRegion state={gallery} className={vertical ? "flex min-h-0 flex-1 flex-col p-3" : "p-4"}>
          <div
            inert={chromeInert}
            data-gallery-chrome=""
            className={
              vertical
                ? // Divider + padding so the photos never crowd the count/actions
                  // (the header grows when a selection appears).
                  "mb-3 flex flex-col gap-2 border-b border-border pb-3"
                : // THREE COLUMNS: count · compress · actions. `1fr auto 1fr`
                  // rather than `grid-cols-3` so the middle is centered on the
                  // BAR, not on whatever width the other two happened to leave
                  // — with equal thirds the compress block drifted whenever the
                  // count grew ("Selected: 3 of 12") or an action appeared.
                  // The sides take only what they need and push nothing.
                  "grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 mb-3"
            }
          >
            {/* Horizontal: count far left. Vertical: it moves to a footer at
                the bottom of the bar (rendered below). */}
            {!vertical && (
              <div className="justify-self-start">
                <GalleryCount
                  selectionActive={selectionActive}
                  selectedCount={selectedIds.size}
                  total={photos.length}
                  maxPhotos={maxPhotos}
                />
              </div>
            )}
            {vertical ? (
              <GalleryActions
                selectedCount={selectedIds.size}
                totalCount={photos.length}
                vertical
                onAutoCompress={onAutoCompress}
                onClearSelection={onClearSelection}
                onDeleteAll={onDeleteAll}
                onDeleteSelected={onDeleteSelected}
                onExportSelected={onExportSelected}
              />
            ) : (
              <>
                <div className="justify-self-center">
                  <GalleryActions
                    only="compress"
                    selectedCount={selectedIds.size}
                    totalCount={photos.length}
                    onAutoCompress={onAutoCompress}
                  />
                </div>
                <div className="justify-self-end">
                  <GalleryActions
                    only="actions"
                    selectedCount={selectedIds.size}
                    totalCount={photos.length}
                    onClearSelection={onClearSelection}
                    onDeleteAll={onDeleteAll}
                    onDeleteSelected={onDeleteSelected}
                    onExportSelected={onExportSelected}
                  />
                </div>
              </>
            )}
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
            <Button
              size="tiny"
              inert={chromeInert}
              data-gallery-chrome=""
              onClick={() =>
                stripRef.current?.scrollBy(
                  vertical
                    ? { top: -220, behavior: "smooth" }
                    : { left: -220, behavior: "smooth" },
                )
              }
              disabled={!canScrollLeft}
              className="flex-shrink-0"
              aria-label={vertical ? "Scroll up" : "Scroll left"}
            >
              {vertical ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>

            <div
              ref={stripRefCallback}
              aria-busy={gallery.busy}
              data-skeleton-skip
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
                    // ⚠️ GAPS, not padding. Reported as "images stacked together
                    // too closely" in compact. Measured before changing: 99px
                    // tiles with only 12px between columns and 16px between
                    // rows, and the tile's own hover ring is painted INSIDE its
                    // border, so nothing else was holding them apart. The
                    // selected/active ring needs somewhere to land, and two
                    // photos 12px apart read as one strip rather than two
                    // pictures. Now 20px both ways, with the side padding
                    // raised to match so the left column is not tighter to the
                    // panel edge than it is to its neighbour.
                    "grid w-full grid-cols-2 content-start items-start gap-x-5 gap-y-5 overflow-y-auto px-3 pt-3 pb-3"
                  : "flex gap-2 overflow-x-auto py-1.5 px-2"
              }
              style={{ scrollbarWidth: "none" }}
            >
              {photos.map((entry, i) => (
                <Thumb
                  key={entry.id}
                  entry={entry}
                  onPendingChange={gallery.reportPending}
                  loading={switching && entry.id === activeId}
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
              {pendingImports.map((p) => (
                <PendingImportTile key={p.id} name={p.name} vertical={vertical} />
              ))}
            </div>

            <Button
              size="tiny"
              inert={chromeInert}
              data-gallery-chrome=""
              onClick={() =>
                stripRef.current?.scrollBy(
                  vertical
                    ? { top: 220, behavior: "smooth" }
                    : { left: 220, behavior: "smooth" },
                )
              }
              disabled={!canScrollRight}
              className="flex-shrink-0"
              aria-label={vertical ? "Scroll down" : "Scroll right"}
            >
              {vertical ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Vertical (master bar): the count readout is pinned to the bottom. */}
          {vertical && (
            <div inert={chromeInert} data-gallery-chrome="" className="mt-3 flex justify-center border-t border-border pt-3">
              <GalleryCount
                selectionActive={selectionActive}
                selectedCount={selectedIds.size}
                total={photos.length}
                maxPhotos={maxPhotos}
              />
            </div>
          )}
        </GalleryLoadingRegion>
      </motion.div>
    </motion.div>
  );
}
