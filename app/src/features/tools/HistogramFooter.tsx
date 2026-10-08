// The histogram as a fixed footer on Enhance › Adjustments, Levels and
// Presets (10-08). It sits OUTSIDE the sidebar's scrolling body, so it stays
// still while the sliders above it — down to Highlights, Blur and Sharpen —
// scroll. Same chart as Review › Histogram (HistogramView), same inputs.
import { HistogramView } from "@/features/canvas/HistogramView";

export interface HistogramFooterProps {
  getHistogram: () => Promise<Uint32Array | null>;
  /** Changes whenever the pixels may have — the chart re-reads on a change. */
  signature: string;
  photoKey: string;
}

export function HistogramFooter({ getHistogram, signature, photoKey }: HistogramFooterProps) {
  return (
    // A THIRD of the card, not a fixed 144px (10-08): sized like Review's
    // histogram when it holds one of three slots — measured 187 / 220 / 280px
    // of chart at 800 / 900 / 1080px windows, where the fixed footer drew 110
    // at every size. Less 13px: Review's section head is taller than this
    // label, so a plain third drew the chart 13px taller than Review's. The
    // 9rem floor keeps a short window readable.
    <div
      data-testid="histogram-footer"
      className="flex shrink-0 basis-[calc(33.333%_-_13px)] min-h-36 flex-col gap-1.5 border-t border-border px-panel pt-3"
    >
      <span className="text-2xs text-theme-muted-foreground">Histogram</span>
      <HistogramView getHistogram={getHistogram} signature={signature} photoKey={photoKey} active />
    </div>
  );
}
