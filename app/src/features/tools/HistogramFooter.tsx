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
    <div
      data-testid="histogram-footer"
      className="flex h-36 shrink-0 flex-col gap-1.5 border-t border-border px-panel pt-3"
    >
      <span className="text-2xs text-theme-muted-foreground">Histogram</span>
      <HistogramView getHistogram={getHistogram} signature={signature} photoKey={photoKey} active />
    </div>
  );
}
