// Compare mode's line in the gallery bar (11-12-2026). It sits where the
// Compress buttons were — they go away in compare mode — and reads like the
// count readout ("# photos · # max"): muted text, numbers in TinyNumberBoxes,
// a lightbulb for the explanation and an X to leave, the same tiny close the
// New dialog (Alt + N) has. It replaced a floating pill over the bar's top
// edge. Its own file because GalleryBar is under the max-lines ratchet.
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TinyNumberBox } from "@/components/ui/tiny-number-box";
import { COMPARE_PICKS } from "@/features/canvas/comparePick";
import { useScreenshotCompareStore } from "@/stores/useScreenshotCompareStore";

/** What compare mode is doing, in the old pill's words. */
function CompareStatusText() {
  const picked = useScreenshotCompareStore((s) => s.picks.length);
  const comparingNow = useScreenshotCompareStore((s) => s.otherId !== null);
  const pending = useScreenshotCompareStore((s) => s.pending !== null);
  // The spaces between the spans are for textContent and screen readers; the
  // flex row drops them and spaces the words with its own gap.
  if (picked < COMPARE_PICKS) {
    return (
      <>
        <span>Pick {COMPARE_PICKS} photos to compare</span> <span>·</span>{" "}
        <TinyNumberBox>{picked}</TinyNumberBox> <span>of</span>{" "}
        <TinyNumberBox>{COMPARE_PICKS}</TinyNumberBox>
      </>
    );
  }
  if (comparingNow) {
    return (
      <>
        <span>Comparing</span> <TinyNumberBox>{COMPARE_PICKS}</TinyNumberBox> <span>photos</span>
      </>
    );
  }
  return <span>{pending ? "Opening the second photo…" : `Pick ${COMPARE_PICKS} photos to compare`}</span>;
}

export function GalleryCompareStatus({ vertical }: { vertical?: boolean }) {
  const stop = useScreenshotCompareStore((s) => s.stop);
  return (
    <div
      data-testid="compare-status"
      className={
        vertical
          ? // Where the compact form's compress block was: under a border.
            "flex flex-wrap items-center justify-center gap-2 border-t border-theme-border pt-2.5"
          : "flex items-center gap-2"
      }
    >
      <p role="status" className="flex flex-wrap items-center gap-1 text-xs text-text-muted">
        <CompareStatusText />
      </p>
      <InfoTooltip
        label="Compare"
        info={
          <>
            Tick two photos to compare them. The open photo is B; if neither
            is open, the second one you tick opens.
            <br />
            <br />
            The Compare bar under the photo shows what changed, as an Overlay,
            Side by side, Blink or Slider. Untick one to pick another.
            <br />
            <br />
            The X here, the top bar&apos;s Compare button or a click outside
            the gallery ends compare mode.
          </>
        }
      />
      <Button size="tiny" onClick={stop} aria-label="Stop comparing">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
