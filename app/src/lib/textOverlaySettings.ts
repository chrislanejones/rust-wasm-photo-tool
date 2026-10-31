// The text tool's settings as the canvas overlay and the engine commit see
// them, plus the two places the text STROKE (outline) crosses a boundary:
// into CSS for the live textarea preview, and into `set_text_stroke`.
//
// Lives here rather than inline because both consumers sit on a max-lines
// ratchet (eslint.config.mjs): AppShell built this object twice, CanvasArea
// declared its type inline, and the stroke would have grown all three.
import type React from "react";
import type { ToolSettings } from "@/lib/types";
import { formatRgba, hexToRgba } from "@/lib/colorConvert";

/** What `CanvasArea` reads to draw the open textarea and its live preview. */
export interface TextOverlaySettings {
  fontSize: number;
  /** ⚠️ Not read by the overlay — the face comes from `textFontId`. Kept
   *  for the recent-text chips only. */
  fontFamily?: string;
  /** Engine typeface id; `""` = the embedded Liberation Sans. */
  textFontId?: string;
  fontWeight: string;
  textColor: string;
  /** Background-preview fields. The open textarea renders a live preview
   *  using these so the user can configure their BG before committing. */
  bgKind?: "none" | "rect" | "bubble";
  bgColor?: string;
  bgOpacity?: number;
  bgPadding?: number;
  bgCornerRadius?: number;
  /** Speech-bubble tail angle in degrees (0-359). */
  bgTail?: number;
  /** Text stroke preview: width in canvas px (0 = none), hex color, 0-100. */
  textStrokeWidth?: number;
  textStrokeColor?: string;
  textStrokeOpacity?: number;
}

/** The overlay's slice of the tool settings. */
export function textOverlaySettings(s: ToolSettings): TextOverlaySettings {
  return {
    fontSize: s.fontSize,
    fontFamily: s.fontFamily,
    textFontId: s.textFontId,
    fontWeight: s.fontWeight,
    textColor: s.textColor,
    bgKind: s.bgKind,
    bgColor: s.bgColor,
    bgOpacity: s.bgOpacity,
    bgPadding: s.bgPadding,
    bgCornerRadius: s.bgCornerRadius,
    bgTail: s.bgTail,
    textStrokeWidth: s.textStrokeWidth,
    textStrokeColor: s.textStrokeColor,
    textStrokeOpacity: s.textStrokeOpacity,
  };
}

/** `set_text_stroke`'s arguments after the id: width px, hex, alpha 0-255. */
export function textStrokeEngineArgs(
  s: Pick<ToolSettings, "textStrokeWidth" | "textStrokeColor" | "textStrokeOpacity">,
): [number, string, number] {
  const opacity = Math.max(0, Math.min(100, s.textStrokeOpacity ?? 100));
  return [
    Math.max(0, Math.round(s.textStrokeWidth ?? 0)),
    s.textStrokeColor ?? "#000000",
    Math.round(opacity * 2.55),
  ];
}

/** The stroke as CSS for the textarea, `scale` screen px per canvas px.
 *
 *  The engine draws the stroke OUTSIDE the glyphs (`outline_glyphs`,
 *  src/layer.rs). `-webkit-text-stroke` is centered on the glyph edge, so it
 *  is drawn twice as wide and painted UNDER the fill: what shows is exactly
 *  the outer half, the same band the engine commits. */
export function textStrokeCss(s: TextOverlaySettings, scale: number): React.CSSProperties {
  const width = Math.max(0, s.textStrokeWidth ?? 0) * scale;
  const opacity = Math.max(0, Math.min(100, s.textStrokeOpacity ?? 100)) / 100;
  if (width <= 0 || opacity <= 0) return {};
  const rgb = hexToRgba(s.textStrokeColor ?? "#000000")?.rgb ?? { r: 0, g: 0, b: 0 };
  return {
    WebkitTextStroke: `${width * 2}px ${formatRgba(rgb, opacity)}`,
    paintOrder: "stroke fill",
  };
}
