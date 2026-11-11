// The text tool's settings as the canvas overlay and the engine commit see
// them, plus the two places the text STROKE (outline) crosses a boundary:
// into CSS for the live textarea preview, and into `set_text_stroke`.
//
// Lives here rather than inline because both consumers sit on a max-lines
// ratchet (eslint.config.mjs): AppShell built this object twice, CanvasArea
// declared its type inline, and the stroke would have grown all three.
import type React from "react";
import type { TextAlign, ToolSettings } from "@/lib/types";
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
  /** Line alignment in the box (ADR-104); absent = left. */
  textAlign?: TextAlign;
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
    textAlign: s.textAlign,
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
function textStrokeCss(s: TextOverlaySettings, scale: number): React.CSSProperties {
  const width = Math.max(0, s.textStrokeWidth ?? 0) * scale;
  const opacity = Math.max(0, Math.min(100, s.textStrokeOpacity ?? 100)) / 100;
  if (width <= 0 || opacity <= 0) return {};
  const rgb = hexToRgba(s.textStrokeColor ?? "#000000")?.rgb ?? { r: 0, g: 0, b: 0 };
  return {
    WebkitTextStroke: `${width * 2}px ${formatRgba(rgb, opacity)}`,
    paintOrder: "stroke fill",
  };
}

const ALIGN_ROWS = ["top", "middle", "bottom"] as const;
const ALIGN_COLUMNS = ["left", "center", "right"] as const;

/** A grid cell as (row, column), 0-2 each. Anything unknown is top-left. */
function alignCell(align: TextAlign | undefined): [number, number] {
  if (align === "center") return [1, 1];
  const [row, col] = (align ?? "top-left").split("-");
  const r = ALIGN_ROWS.indexOf(row as (typeof ALIGN_ROWS)[number]);
  const c = ALIGN_COLUMNS.indexOf(col as (typeof ALIGN_COLUMNS)[number]);
  return r < 0 || c < 0 ? [0, 0] : [r, c];
}

/** The engine's alignment byte, `row * 3 + column` (`set_text_align`). */
export function textAlignEngineArg(align: TextAlign | undefined): number {
  const [r, c] = alignCell(align);
  return r * 3 + c;
}

/** Everything the open textarea previews beyond the face and color: the
 *  stroke (`textStrokeCss`) and the column of the text's cell. The textarea
 *  is as wide as the box, so CSS `text-align` puts each line where the engine
 *  will: against the box when it has one, against the widest line when not. */
export function textPreviewCss(s: TextOverlaySettings, scale: number): React.CSSProperties {
  return { ...textStrokeCss(s, scale), textAlign: ALIGN_COLUMNS[alignCell(s.textAlign)[1]] };
}

/** The textarea's padding, with the row of the text's cell: `spare` screen px
 *  of box below the text go above it instead (all for bottom, half for
 *  middle), as the engine places it (`text::grow_to_box_height_aligned`).
 *  The textarea is border-box, so the box stays the same height. */
export function textPreviewPadding(s: TextOverlaySettings, spare: number, padY: number, padX: number): string {
  const top = padY + (Math.max(0, spare) * alignCell(s.textAlign)[0]) / 2;
  return `${top}px ${padX}px ${padY}px`;
}
