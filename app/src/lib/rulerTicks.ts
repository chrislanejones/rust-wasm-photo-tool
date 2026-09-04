// Ruler tick maths — which values get a tick, and what the label reads.
//
// Split out of CanvasGuidesOverlay so it can be tested without a canvas: the
// overlay does projection and SVG, this does arithmetic and formatting.
//
// EVERYTHING HERE IS IN IMAGE PIXELS on the way in and out. A unit is only a
// lens: inches and centimetres change which pixel offsets earn a tick and what
// the label says, never the geometry. That keeps the overlay's projection
// (`left + ix * sx`) identical for all three units.
import { RULER_DPI, type RulerUnit } from "@/lib/preferences";

/** Image pixels per one of each unit. Inches and centimetres are derived from
 *  the fixed 96 DPI reference — a web image has no inherent physical size, so
 *  this is a consistent convention, not a claim about print output. */
export const PX_PER_UNIT: Record<RulerUnit, number> = {
  px: 1,
  in: RULER_DPI,
  cm: RULER_DPI / 2.54,
};

/** Tick intervals worth landing on, per unit, in that unit's own terms.
 *
 *  Pixels get the familiar 1/2/5 decade ladder. Inches get binary fractions,
 *  because that is how rulers are actually divided and 0.1" is not a mark
 *  anybody looks for. Centimetres get the metric ladder. */
const NICE_STEPS: Record<RulerUnit, readonly number[]> = {
  px: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  in: [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 5, 10, 20, 50, 100],
  cm: [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100, 250],
};

/**
 * The smallest tick interval — **in image pixels** — whose on-screen spacing is
 * at least `minScreen` px.
 *
 * `scale` is screen px per image px (the zoom). Falls back to the coarsest step
 * rather than looping forever when even that is too tight, which is what
 * happens at extreme zoom-out.
 */
export function niceStep(scale: number, minScreen: number, unit: RulerUnit = "px"): number {
  const perUnit = PX_PER_UNIT[unit];
  const steps = NICE_STEPS[unit];
  for (const s of steps) {
    const imagePx = s * perUnit;
    if (imagePx * scale >= minScreen) return imagePx;
  }
  return steps[steps.length - 1] * perUnit;
}

/**
 * The label for a tick at `imagePx` along the axis.
 *
 * Pixels read as whole numbers, the way they always did. Inches and centimetres
 * carry only as many decimals as their step actually needs — a 1/4" ladder
 * reads 0.25 / 0.5 / 0.75, and a 1" ladder reads 1 / 2 / 3 rather than
 * 1.00 / 2.00. Trailing zeros are dropped for the same reason.
 */
export function tickLabel(imagePx: number, unit: RulerUnit, stepImagePx: number): string {
  if (unit === "px") return String(Math.round(imagePx));
  const perUnit = PX_PER_UNIT[unit];
  const value = imagePx / perUnit;
  const stepInUnits = stepImagePx / perUnit;
  // Decimals needed to tell one tick from the next, capped at 2 — a ruler
  // label is read at a glance, not measured off.
  let decimals = 0;
  if (stepInUnits < 1) decimals = stepInUnits < 0.2 ? 2 : stepInUnits < 0.5 ? 2 : 1;
  const fixed = value.toFixed(decimals);
  // "0.50" → "0.5", "2.00" → "2"; a ruler should not shout precision it does
  // not have.
  return decimals > 0 ? fixed.replace(/\.?0+$/, "") : fixed;
}
