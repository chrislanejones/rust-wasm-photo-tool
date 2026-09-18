// The autosave's "is there anything to write" rule.
//
// ⚠️ THE BUG THIS PINS COST A USER THEIR UNDO, SILENTLY, ON PRODUCTION.
// The old rule was `undoCount > 0`. Apply one edit (undo 0 → 1, dirty, archive
// written), press Ctrl+Z (undo 1 → 0, **not dirty**), and the autosave effect
// returned early — leaving the EDITED archive on disk. Reload, and the change
// the user had just discarded came back. Measured 2026-09-16 on
// edit.imagehorse.app: screen `77686a30`, archive `b6cb4374`, two different
// documents, and `__ihSaveGuard()` showed zero save attempts across the undo.
//
// Nothing caught it because every existing test drives a layer below this one:
// `saveOwnership.test.ts` calls `savePhotoEdit` directly, and the Rust tests
// drive the engine directly. Neither ever asks "would the app have CALLED
// savePhotoEdit here". That question is this file.

import { describe, it, expect } from "vitest";
import { isDirty } from "@/app/session/useImageSession";

describe("isDirty — the regression", () => {
  it("is dirty after undoing back to zero past a saved edit", () => {
    // The exact production sequence: saved at undo 1, user pressed Ctrl+Z.
    // The old `undoCount > 0` rule returned false here and lost the undo.
    expect(isDirty(0, 1, false, 0)).toBe(true);
  });

  it("is dirty undoing to zero from any saved depth", () => {
    expect(isDirty(0, 5, false, 0)).toBe(true);
  });
});

describe("isDirty — a photo that has never been written", () => {
  it("is clean at undo 0", () => {
    expect(isDirty(0, undefined, false, 0)).toBe(false);
  });

  it("is dirty as soon as there is history", () => {
    expect(isDirty(1, undefined, false, 0)).toBe(true);
  });
});

describe("isDirty — divergence from the saved point", () => {
  it("is clean when the engine is exactly where it was written", () => {
    expect(isDirty(3, 3, false, 0)).toBe(false);
  });

  it("is dirty on a new edit past the saved point", () => {
    expect(isDirty(4, 3, false, 0)).toBe(true);
  });

  it("is dirty on a partial undo above the saved point", () => {
    // Saved at 5, undone to 3 — still a different document than disk holds.
    expect(isDirty(3, 5, false, 0)).toBe(true);
  });

  it("is dirty on redo back up to a point that is not the saved one", () => {
    expect(isDirty(2, 1, false, 0)).toBe(true);
  });
});

describe("isDirty — the other two signals still force a write", () => {
  it("honours hasBeenModified even when the counts agree", () => {
    expect(isDirty(3, 3, true, 0)).toBe(true);
  });

  it("honours a layer edit even when the counts agree", () => {
    // Hiding a second layer moves no undo count — #53 — so layerRevision is
    // the only signal that a layer-panel edit happened at all.
    expect(isDirty(3, 3, false, 1)).toBe(true);
  });

  it("honours both on a never-written photo at undo 0", () => {
    expect(isDirty(0, undefined, true, 0)).toBe(true);
    expect(isDirty(0, undefined, false, 2)).toBe(true);
  });
});
