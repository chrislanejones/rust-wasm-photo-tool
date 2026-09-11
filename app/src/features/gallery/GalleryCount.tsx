// The gallery count readout — "Selected: # of #" while selecting, otherwise
// "# of # — # max 💡". Its own file because GalleryBar is under the max-lines
// ratchet and this is the one piece of it that is genuinely self-contained:
// four props in, no handlers, no state.
import { Lightbulb } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TinyNumberBox } from "@/components/ui/tiny-number-box";
import { TIERS } from "@/lib/tiers";

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
                {/* Lightbulb, not (i). Every other explanation in the app
                    hides behind a lightbulb (`InfoTooltip`, SectionHeader,
                    the compress block right here) — this was the one (i)
                    left, so it read as a different KIND of affordance. */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Why this limit?"
                      className="text-theme-muted-foreground hover:text-theme-foreground transition"
                    >
                      <Lightbulb className="h-3.5 w-3.5" />
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
