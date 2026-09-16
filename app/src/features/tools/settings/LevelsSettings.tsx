// Enhance › Levels — black point, white point and midtones, with the photo
// updating as you drag.
//
// The engine does the work (src/levels.rs): opening this panel starts a preview
// on a copy of the layer, every slider move recomputes from that copy, Apply
// commits ONE undo step (recorded as `Op::Levels`), and leaving the panel
// without applying cancels the preview and puts the photo back. This file only
// holds three numbers and draws the histogram they are set against.
import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { SizeSlider } from "@/components/SizeSlider";
import { Button } from "@/components/ui/button";
import type { LevelsControls } from "@/hooks/useTransforms";

/** The identity. Gamma is held ×100 so the slider stays integer. */
const BLACK = 0;
const WHITE = 255;
const GAMMA = 100;

// 120, not 64. At 64 the graph was a short strip sitting above three
// full-height slider rows and the panel read as controls with a thumbnail
// attached. Matching the stack's height lets the two halves read as one block.
// Kept in sync with the `h-30` below so the viewBox maps 1:1 to rendered
// pixels — `preserveAspectRatio="none"` means the SHAPE is identical at any
// HIST_H (the path is normalised against `max`), so this value exists to keep
// stroke widths and the midtone dash predictable, not to change the curve.
const HIST_H = 120;

interface LevelsSettingsProps {
  levels?: LevelsControls;
  imageReady: boolean;
}

/** Luma bins → an SVG area path, 256 wide and HIST_H tall. Scaled to the
 *  tallest bin EXCLUDING the two ends, because a photo with clipped blacks or
 *  whites piles thousands of pixels into bin 0 or 255 and would flatten the
 *  rest of the curve to nothing. */
function histogramPath(bins: Uint32Array | null): string | null {
  if (!bins || bins.length < 1024) return null;
  const luma = bins.subarray(768, 1024);
  let max = 0;
  for (let i = 1; i < 255; i++) max = Math.max(max, luma[i]);
  if (max === 0) return null;
  let d = `M0 ${HIST_H}`;
  for (let i = 0; i < 256; i++) {
    const y = HIST_H - Math.min(1, luma[i] / max) * HIST_H;
    d += ` L${i} ${y.toFixed(1)}`;
  }
  return `${d} L255 ${HIST_H} Z`;
}

/** Where the midtones marker sits: the input value that the curve maps to
 *  mid-grey, i.e. `black + (white - black) · 0.5^gamma`. */
function midtoneX(black: number, white: number, gamma: number): number {
  return black + (white - black) * Math.pow(0.5, gamma);
}

export function LevelsSettings({ levels, imageReady }: LevelsSettingsProps) {
  const [black, setBlack] = useState(BLACK);
  const [white, setWhite] = useState(WHITE);
  const [gamma, setGamma] = useState(GAMMA);
  const [bins, setBins] = useState<Uint32Array | null>(null);

  // One preview for as long as the panel is open on an image. The cleanup
  // cancels it, which is what makes "leave without applying" put the photo
  // back. `levels` has a stable identity (useTransforms), so this does not
  // re-run in the middle of a drag.
  useEffect(() => {
    if (!levels || !imageReady) return;
    let alive = true;
    void (async () => {
      await levels.begin();
      const h = await levels.histogram();
      if (alive) setBins(h);
    })();
    return () => {
      alive = false;
      void levels.cancel();
    };
  }, [levels, imageReady]);

  const isIdentity = black === BLACK && white === WHITE && gamma === GAMMA;

  const move = (b: number, w: number, g: number) => {
    levels?.preview(b, w, g / 100);
  };
  // Black stays below white and white above black, so the curve never folds.
  const onBlack = (v: number) => {
    const b = Math.min(v, white - 1);
    setBlack(b);
    move(b, white, gamma);
  };
  const onWhite = (v: number) => {
    const w = Math.max(v, black + 1);
    setWhite(w);
    move(black, w, gamma);
  };
  const onGamma = (v: number) => {
    setGamma(v);
    move(black, white, v);
  };
  const reset = () => {
    setBlack(BLACK);
    setWhite(WHITE);
    setGamma(GAMMA);
    move(BLACK, WHITE, GAMMA);
  };
  const apply = async () => {
    if (!levels || isIdentity) return;
    await levels.apply(black, white, gamma / 100);
    setBlack(BLACK);
    setWhite(WHITE);
    setGamma(GAMMA);
    // Keep working: a fresh preview on the new pixels, and their histogram.
    await levels.begin();
    setBins(await levels.histogram());
  };

  const path = histogramPath(bins);
  const mid = midtoneX(black, white, gamma / 100);

  return (
    <div className="space-y-3 -mt-2">
      <SectionHeader
        title="Levels"
        info="Drag Black point and White point in to set the darkest and brightest tones, and Midtones to lift or deepen everything between. The photo updates as you drag. Apply makes it one undo step; leave the panel without applying and the photo goes back."
      />

      <div className="rounded-md border border-theme-border bg-theme-muted p-2">
        {path ? (
          <svg
            viewBox={`0 0 255 ${HIST_H}`}
            preserveAspectRatio="none"
            className="block h-30 w-full text-theme-muted-foreground"
            role="img"
            aria-label="Histogram of the photo's brightness, with the black point, midtones and white point marked"
          >
            <path d={path} fill="currentColor" opacity={0.55} />
            {[black, mid, white].map((x, i) => (
              <line
                key={i}
                x1={x}
                x2={x}
                y1={0}
                y2={HIST_H}
                className="text-theme-primary"
                stroke="currentColor"
                strokeWidth={i === 1 ? 1 : 1.5}
                strokeDasharray={i === 1 ? "3 2" : undefined}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        ) : (
          <p className="grid h-30 place-items-center text-center text-xs text-theme-muted-foreground">
            {imageReady ? "Reading the photo…" : "Open a photo to see its histogram."}
          </p>
        )}
      </div>

      <SizeSlider
        label="Black point"
        labelInfo="Everything this dark or darker becomes black."
        value={black}
        onChange={onBlack}
        min={0}
        max={254}
        disabled={!imageReady}
        valueDisplay={String(black)}
      />
      <SizeSlider
        label="Midtones"
        labelInfo="Above 1.00 lifts the tones between black and white; below 1.00 deepens them."
        value={gamma}
        onChange={onGamma}
        min={10}
        max={500}
        disabled={!imageReady}
        valueDisplay={(gamma / 100).toFixed(2)}
      />
      <SizeSlider
        label="White point"
        labelInfo="Everything this bright or brighter becomes white."
        value={white}
        onChange={onWhite}
        min={1}
        max={255}
        disabled={!imageReady}
        valueDisplay={String(white)}
      />

      <div className="flex gap-2">
        <Button
          size="large"
          className="flex-1"
          onClick={reset}
          disabled={!imageReady || isIdentity}
        >
          Reset
        </Button>
        <Button
          size="large"
          className="flex-1"
          onClick={() => void apply()}
          disabled={!imageReady || isIdentity}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}
