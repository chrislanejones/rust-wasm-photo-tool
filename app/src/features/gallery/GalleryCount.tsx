// The gallery count readout — "Selected: # of #" while selecting, otherwise
// "# photos · # max 💡". Its own file because GalleryBar is under the max-lines
// ratchet and this is the one piece of it that is genuinely self-contained:
// four props in, no handlers, one store read (is the tier decided?).
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { TinyNumberBox } from "@/components/ui/tiny-number-box";
import { useDelayedFlag } from "@/hooks/usePhotoSwitching";
import { TIERS } from "@/lib/tiers";
import { useUIStore } from "@/stores/useUIStore";
import { THUMB_SKELETON_DELAY_MS } from "./useThumbImage";

// The widest max any tier can show, as blanks a digit wide (U+2007, FIGURE
// SPACE: digit-width in a tabular face, and CSS never collapses it). It sizes
// the box while the tier is pending, so no digit is ever in the DOM to read.
const WIDEST_MAX_BLANKS = String(TIERS.paid.galleryLimit).replace(/./g, "\u2007");

/**
 * The max while the tier is pending (app/session/useUserMode.ts): an empty
 * number box for the gallery's 300 ms grace, then a `line` skeleton across it.
 * Both layers share one grid cell, sized by the invisible box, so neither the
 * grace, the skeleton nor the paid answer moves "max" — it is the width of
 * the widest max. (A free answer is one digit narrower.)
 */
function PendingMax() {
  const shown = useDelayedFlag(true, THUMB_SKELETON_DELAY_MS);
  return (
    <span data-testid="gallery-max-pending" className="inline-grid items-center">
      <TinyNumberBox aria-hidden="true" className="invisible col-start-1 row-start-1">
        {WIDEST_MAX_BLANKS}
      </TinyNumberBox>
      {shown && (
        <Skeleton variant="line" className="col-start-1 row-start-1 w-full" />
      )}
    </span>
  );
}

export function GalleryCount({
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
  // Not decided yet → do not say "24 max" to someone who may hold 100.
  const tierPending = useUIStore((s) => s.tierPending);
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
            <span>{total === 1 ? "photo" : "photos"}</span>
            {maxPhotos != null && (
              <>
                <span>·</span>
                {tierPending ? <PendingMax /> : <TinyNumberBox>{maxPhotos}</TinyNumberBox>}
                <span>max</span>
                {/* Lightbulb, not (i). Every other explanation in the app
                    hides behind a lightbulb (`InfoTooltip`, SectionHeader,
                    the compress block right here) — this was the one (i)
                    left, so it read as a different KIND of affordance. Now
                    it is the same primitive, not a copy of it (Night 8). */}
                <InfoTooltip
                  label="Gallery limit"
                  info={
                    <>
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
                    </>
                  }
                />
              </>
            )}
          </>
        )}
      </span>
    </h2>
  );
}
