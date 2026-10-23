// The Shapes edit overlay's live interior-fill preview: the SVG `fill` value
// and the <defs> it points at. Moved out of ShapeEditOverlay.tsx unchanged
// (the max-lines ratchet) when the overlay learned to yield to the panels.
import type React from "react";
import type { ShapeDrawSettings } from "./ShapeEditOverlay";

type FillSettings = Pick<
  ShapeDrawSettings,
  "fillMode" | "fillColor" | "fillColor2" | "gradientAngle"
>;

/** `cfg` is the shape's captured style on reselect, or the live panel for a
 *  new shape — both carry fill, so a reselected shape previews its fill too.
 *  `canFill` is false for the line, the one shape that encloses no area. */
export function shapeFillPreview(
  cfg: FillSettings | undefined,
  canFill: boolean,
): { fill: string; defs: React.ReactNode } {
  if (!cfg || !canFill) return { fill: "none", defs: null };
  if (cfg.fillMode === "solid") return { fill: cfg.fillColor, defs: null };
  if (cfg.fillMode === "gradient") {
    const ang = ((cfg.gradientAngle ?? 0) * Math.PI) / 180;
    const dx = 0.5 * Math.cos(ang);
    const dy = 0.5 * Math.sin(ang);
    return {
      fill: "url(#draw-fill-grad)",
      defs: (
        <defs>
          <linearGradient
            id="draw-fill-grad"
            x1={0.5 - dx} y1={0.5 - dy} x2={0.5 + dx} y2={0.5 + dy}
          >
            <stop offset="0%" stopColor={cfg.fillColor} />
            <stop offset="100%" stopColor={cfg.fillColor2} />
          </linearGradient>
        </defs>
      ),
    };
  }
  if (cfg.fillMode === "pixelate") {
    // A true live mosaic isn't practical in SVG — preview a checker
    // hint; the real pixelation is applied to the pixels on commit.
    return {
      fill: "url(#draw-fill-pixelate)",
      defs: (
        <defs>
          <pattern
            id="draw-fill-pixelate"
            width="8" height="8"
            patternUnits="userSpaceOnUse"
          >
            <rect width="8" height="8" fill="rgba(120,120,120,0.4)" />
            <rect width="4" height="4" fill="rgba(40,40,40,0.5)" />
            <rect x="4" y="4" width="4" height="4" fill="rgba(40,40,40,0.5)" />
          </pattern>
        </defs>
      ),
    };
  }
  return { fill: "none", defs: null };
}
