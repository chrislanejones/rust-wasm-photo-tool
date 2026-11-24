import { describe, it, expect } from "vitest";
import { TEXT_COLORS } from "./colors";
import { stampAnchor, stampBox, stampTextHeight, stampWord, STAMP_PRESETS } from "./stamps";

describe("stamps", () => {
  it("the word is trimmed, single-spaced and in capitals; blank is nothing", () => {
    expect(stampWord("  sold   out \n")).toBe("SOLD OUT");
    expect(stampWord("   ")).toBe("");
  });

  it("the box scales with the size and the border stays in the engine's 2-20 px", () => {
    expect(stampBox(48)).toEqual({ padding: 14, border: 4, radius: 6 });
    expect(stampBox(8).border).toBe(2);
    expect(stampBox(400).border).toBe(20);
  });

  it("one line's height is the engine's tile rule (matches src/text.rs at 32, 48, 96)", () => {
    // Read off `build_annotation_tile` for "REJECTED", bold, kind 1, pad 0.3 em:
    // tiles 78, 115 and 231 px tall at 32, 48 and 96.
    for (const [size, tile] of [[32, 78], [48, 115], [96, 231]] as const) {
      expect(stampTextHeight(size) + 2 * stampBox(size).padding).toBe(tile);
    }
  });

  it("the anchor puts the TILTED box's center on the click", () => {
    const [w, h, tilt] = [282, 115, -5];
    const [x, y] = stampAnchor(500, 400, w, h, tilt);
    const a = (tilt * Math.PI) / 180;
    // The engine pivots on the anchor: center = anchor + R·(w/2, h/2).
    const cx = x + (w / 2) * Math.cos(a) - (h / 2) * Math.sin(a);
    const cy = y + (w / 2) * Math.sin(a) + (h / 2) * Math.cos(a);
    expect(Math.abs(cx - 500)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(cy - 400)).toBeLessThanOrEqual(0.5);
  });

  it("five presets, each a capital word in a color the panel's swatches offer", () => {
    expect(STAMP_PRESETS.map((p) => p.label)).toEqual(["APPROVED", "REJECTED", "DRAFT", "CONFIDENTIAL", "UNDER REVIEW"]);
    for (const p of STAMP_PRESETS) expect(TEXT_COLORS as readonly string[]).toContain(p.color);
  });
});
