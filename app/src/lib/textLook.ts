// A text's BOX LOOK as Text panel fields: its background, drop shadow,
// outline and box border. What `holdTextLookForEdit` puts in the panel while
// that text is open in the editor, so committing it — retyping a stamp, say —
// keeps the look it had instead of taking whatever the panel last held
// (ADR-109). The engine JSON is the source: `annotations_to_json`'s fields.
import type { ToolSettings } from "@/lib/types";

/** The panel fields one text's look occupies. */
export const TEXT_LOOK_FIELDS = [
  "bgKind", "bgColor", "bgOpacity", "bgPadding", "bgCornerRadius", "bgTail",
  "shadowBox", "shadowText", "shadowColor", "shadowOpacity",
  "shadowOffsetX", "shadowOffsetY", "shadowBlur",
  "textStrokeWidth", "textStrokeColor", "textStrokeOpacity",
  "textBorderWidth", "textBorderColor", "textBorderOpacity",
] as const satisfies readonly (keyof ToolSettings)[];

export type TextLook = Pick<ToolSettings, (typeof TEXT_LOOK_FIELDS)[number]>;

/** The look fields of an engine text annotation (`get_text_annotations`).
 *  Every field is optional: a payload from an older engine lacks the newer
 *  ones, and each absent value means what it meant then — no shadow, no
 *  outline, no border. */
export interface AnnotationLook {
  background_kind?: number;
  bg_r?: number; bg_g?: number; bg_b?: number; bg_a?: number;
  bg_padding?: number;
  bg_corner_radius?: number;
  bg_tail?: number;
  shadow_box?: boolean;
  shadow_text?: boolean;
  shadow_r?: number; shadow_g?: number; shadow_b?: number; shadow_a?: number;
  shadow_dx?: number;
  shadow_dy?: number;
  shadow_blur?: number;
  stroke_width?: number;
  stroke_r?: number; stroke_g?: number; stroke_b?: number; stroke_a?: number;
  border_width?: number;
  border_r?: number; border_g?: number; border_b?: number; border_a?: number;
}

const BG_KINDS = ["none", "rect", "bubble"] as const;

function hex(r = 0, g = 0, b = 0): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Alpha 0-255 → the panel's 0-100. The panel sends `round(pct * 2.55)`, and
 *  that map is one-to-one on whole percents, so an alpha the panel wrote comes
 *  back as the exact percent that wrote it and re-commits unchanged. */
function pct(a = 255): number {
  return Math.round(Math.max(0, Math.min(255, a)) / 2.55);
}

/** The panel fields that reproduce `a`'s look on commit. */
export function textLookOf(a: AnnotationLook): TextLook {
  return {
    bgKind: BG_KINDS[a.background_kind ?? 0] ?? "none",
    bgColor: hex(a.bg_r, a.bg_g, a.bg_b),
    bgOpacity: pct(a.bg_a),
    bgPadding: a.bg_padding ?? 0,
    bgCornerRadius: a.bg_corner_radius ?? 0,
    bgTail: a.bg_tail ?? 0,
    shadowBox: a.shadow_box ?? false,
    shadowText: a.shadow_text ?? false,
    shadowColor: hex(a.shadow_r, a.shadow_g, a.shadow_b),
    shadowOpacity: pct(a.shadow_a ?? 0),
    shadowOffsetX: a.shadow_dx ?? 0,
    shadowOffsetY: a.shadow_dy ?? 0,
    shadowBlur: a.shadow_blur ?? 0,
    textStrokeWidth: a.stroke_width ?? 0,
    textStrokeColor: hex(a.stroke_r, a.stroke_g, a.stroke_b),
    textStrokeOpacity: a.stroke_width ? pct(a.stroke_a) : 100,
    textBorderWidth: a.border_width ?? 0,
    textBorderColor: hex(a.border_r, a.border_g, a.border_b),
    textBorderOpacity: a.border_width ? pct(a.border_a) : 100,
  };
}

/** The look fields of `s`, for putting back after the edit. */
export function pickTextLook(s: ToolSettings): TextLook {
  return Object.fromEntries(TEXT_LOOK_FIELDS.map((k) => [k, s[k]])) as TextLook;
}
