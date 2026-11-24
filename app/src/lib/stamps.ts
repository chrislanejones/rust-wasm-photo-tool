// Stamps (ADR-109): APPROVED, REJECTED, or any word, as a TEXT annotation in
// a stamp's style — a bold capital word in a bordered, transparent box, tilted
// a few degrees, in the stamp's color.
//
// Until v17 a stamp was burned into the pixels the moment it was clicked: a
// separate Rust renderer drew the label at a fixed 48 px, scaled it to the
// brush size (soft when big), and a window CustomEvent carried the pick from
// the panel. Now it is a text like any other, so it can be moved, rotated,
// retyped, recolored and resized afterwards, and it stays sharp at any size.
// Stamps placed before v17 are already pixels and stay as they are.
import type { ImageHorseTool } from "stamp_tool";
import { joinedSetters } from "@/lib/commitSteps";
import { measureTextAwaited } from "@/lib/engine/textMetricsCache";
import { PALETTE } from "@/lib/colors";

export interface StampPreset {
  id: string;
  /** The word as stamped. */
  label: string;
  /** Its name on the panel's tile, in the toolbar's title case. */
  name: string;
  color: string;
}

/** The five classics, in the shared palette's colors so the panel's Color
 *  swatches show which one a preset picked. Any other word or color is a
 *  custom stamp. */
export const STAMP_PRESETS: readonly StampPreset[] = [
  { id: "approved", label: "APPROVED", name: "Approved", color: PALETTE.green },
  { id: "rejected", label: "REJECTED", name: "Rejected", color: PALETTE.red },
  { id: "draft", label: "DRAFT", name: "Draft", color: PALETTE.orange },
  { id: "confidential", label: "CONFIDENTIAL", name: "Confidential", color: PALETTE.red },
  { id: "review", label: "UNDER REVIEW", name: "Under Review", color: PALETTE.blue },
];

/** A rubber stamp's tilt, degrees; negative is counter-clockwise. The old
 *  pixel stamp's angle, kept so a new stamp looks like the ones before it. */
export const STAMP_TILT_DEG = -5;

/** A stamp's box, from its font size: the padding around the word, the
 *  border's width, and a slight rounding of the corners. All in canvas px. */
export function stampBox(size: number): { padding: number; border: number; radius: number } {
  return {
    padding: Math.round(size * 0.3),
    // The engine clamps a border to 20 px (`MAX_TEXT_STROKE_WIDTH`).
    border: Math.max(2, Math.min(20, Math.round(size * 0.08))),
    radius: Math.round(size * 0.12),
  };
}

/** What to stamp: the word, its color, and its font size. */
export interface StampChoice {
  label: string;
  color: string;
  size: number;
}

/** The stamp's word as it is placed: trimmed, capitals, one line. Empty means
 *  there is nothing to place. */
export function stampWord(label: string): string {
  return label.replace(/\s+/g, " ").trim().toUpperCase();
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  return Number.isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The height the engine draws one line of text at `size`, padding included:
 *  `text::render_text_aligned` (src/text.rs) lays lines at a 1.3 × size
 *  pitch inside a 0.25 em pad. NOT `measure_text`'s height, which uses the
 *  face's ascent − descent and comes out ~0.3 em shorter — centering on that
 *  put a 48 px stamp 7 px low (e2e/stamps.spec.ts measures the tile). */
export function stampTextHeight(size: number): number {
  return Math.ceil(size * 1.3) + 2 * Math.ceil(size * 0.25);
}

/** Where the text's anchor goes so the tilted box is centered on (cx, cy).
 *  The engine rotates a text about its anchor, the box's top-left (ADR-050),
 *  so the box's center lands at anchor + R·(w/2, h/2). */
export function stampAnchor(
  cx: number,
  cy: number,
  boxW: number,
  boxH: number,
  tiltDeg: number,
): [number, number] {
  const a = (tiltDeg * Math.PI) / 180;
  const [hw, hh] = [boxW / 2, boxH / 2];
  return [
    Math.round(cx - (hw * Math.cos(a) - hh * Math.sin(a))),
    Math.round(cy - (hw * Math.sin(a) + hh * Math.cos(a))),
  ];
}

/** Place a stamp centered on canvas point (cx, cy) as ONE undo step: the text,
 *  its centering and its border join the step the text opens (lib/commitSteps).
 *  Resolves with the new text's id, or null when there was nothing to place. */
export async function placeStamp(
  tool: ImageHorseTool,
  choice: StampChoice,
  cx: number,
  cy: number,
): Promise<number | null> {
  const word = stampWord(choice.label);
  if (!word) return null;
  const size = Math.max(8, Math.round(choice.size));
  const { padding, border, radius } = stampBox(size);
  const [r, g, b] = rgb(choice.color);
  // The width, measured in the face it is drawn in (the embedded bold).
  const m = await measureTextAwaited(tool, word, size, true, "");
  const w = m && m.length >= 1 ? m[0]! : size * word.length * 0.7;
  const [x, y] = stampAnchor(cx, cy, w + padding * 2, stampTextHeight(size) + padding * 2, STAMP_TILT_DEG);
  const id = await joinedSetters(
    tool,
    async () =>
      await tool.add_text_annotation(
        word, size, r, g, b, true, x, y, STAMP_TILT_DEG,
        // A box (kind 1) in the stamp's color at alpha 0: the box is there to
        // carry the border, and the photo shows through it like ink.
        1, r, g, b, 0,
        padding, radius, 0, "",
      ),
    [
      async (id) => {
        if (id >= 0) await tool.set_text_align(id, 1);
      },
      async (id) => {
        if (id >= 0) await tool.set_text_border(id, border, choice.color, 255);
      },
    ],
  );
  return id >= 0 ? id : null;
}
