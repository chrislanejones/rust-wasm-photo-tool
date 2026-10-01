import { describe, it, expect } from "vitest";
import { TOOL_PERSISTED_FIELDS } from "./useToolStore";

// Paint's `erase` brush mode was DELETED on 10-01-2026 (Chris). It had been
// unreachable for a while — no tile in PAINT_MODES, no palette entry, and
// `setModeOf` refused it — but it was still a legal PERSISTED value, so a
// browser that saved it before the tile went still holds `brushMode: "erase"`
// in IndexedDB today.
//
// ⚠️ THIS IS THE WHOLE SAFETY NET FOR THAT DELETION, so it is worth saying what
// it does and does not cover.
//
// It covers: a stored value that is no longer legal must not land in state as
// something the running code cannot switch on. Every `brushMode` consumer is
// now an exhaustive switch over "paint" | "blur" | "pen"; an "erase" leaking
// through would fall off the end of PaintSettings' switch and render an empty
// panel.
//
// It needs no Dexie migration, and that is a fact about where this lives
// rather than an opinion: `useToolStore` persists through zustand's `persist`
// into `idbStorage`, a hand-rolled string key/value store in its OWN database
// (`image-horse-zustand`), deliberately separate from the originals, edits and
// gallery databases. There is no `.version(n).stores()` to bump, no record
// shape to reshape, and no user content within reach — the worst case is one
// preference resetting to its default.
describe("a persisted brushMode that no longer exists", () => {
  const fallback = "paint" as const;
  const check = TOOL_PERSISTED_FIELDS.brushMode;

  it('a browser that saved "erase" loads as "paint", not as "erase"', () => {
    expect(check("erase", fallback)).toBe("paint");
  });

  it("the three surviving modes still load unchanged", () => {
    for (const mode of ["paint", "blur", "pen"] as const) {
      expect(check(mode, fallback)).toBe(mode);
    }
  });

  it("junk, a missing value and a wrong type all fall back", () => {
    // A blob written before the field existed, and a blob someone edited.
    for (const bad of [undefined, null, "", "ERASE", "pencil", 7, {}, []]) {
      expect(check(bad, fallback)).toBe("paint");
    }
  });

  it("goes red if `erase` is ever put back without a tile", () => {
    // The failure this guards is not deletion, it is a half-revival: adding
    // "erase" back to BRUSH_MODES without restoring its tile would make it a
    // legal persisted value again with nothing to render it.
    expect(check("erase", fallback)).not.toBe("erase");
  });
});
