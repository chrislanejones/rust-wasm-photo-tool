import { describe, expect, it } from "vitest";
import {
  isLiveCrop,
  isPreCrop,
  showsOriginalFraming,
  type ActiveCrop,
} from "./useBatchCropStore";

// Batch › Crop re-apply, PARKING_LOT 09-29-2026: the last live crop is known by
// the engine's history identity (`history_node`) within one load of the
// document, not by the undo count. Node numbers below are what the engine
// mints: the load is 0, every new edit takes the next one, undo/redo carry a
// state's number with it.

const rec: ActiveCrop = {
  before: { node: 0, revision: 7 },
  after: { node: 1, revision: 7 },
  steps: 1,
};
const s = { activeCrop: { a: rec }, baselines: {} as Record<string, string> };

describe("batch crop identity", () => {
  it("the crop's own state is the live crop, and hides the original framing", () => {
    expect(isLiveCrop(s, "a", { node: 1, revision: 7 })).toBe(true);
    expect(showsOriginalFraming(s, "a", "key", { node: 1, revision: 7 })).toBe(false);
  });

  it("crop → undo → one new edit is NOT the crop, though the undo count matches", () => {
    // Undo puts node 0 back; the stroke mints node 2 at the crop's depth.
    expect(isLiveCrop(s, "a", { node: 2, revision: 7 })).toBe(false);
    expect(showsOriginalFraming(s, "a", "key", { node: 2, revision: 7 })).toBe(true);
  });

  it("a reload of the document breaks the identity, whatever number comes back", () => {
    expect(isLiveCrop(s, "a", { node: 1, revision: 8 })).toBe(false);
  });

  it("the rewind is checked against the state the crop was applied to", () => {
    expect(isPreCrop(s, "a", { node: 0, revision: 7 })).toBe(true);
    expect(isPreCrop(s, "a", { node: 5, revision: 7 })).toBe(false);
  });

  it("a photo with no live crop is judged by its baseline only", () => {
    expect(isLiveCrop(s, "b", { node: 1, revision: 7 })).toBe(false);
    expect(showsOriginalFraming(s, "b", "key", { node: 1, revision: 7 })).toBe(true);
    const replaced = { ...s, baselines: { b: "upload" } };
    expect(showsOriginalFraming(replaced, "b", "cropped", { node: 1, revision: 7 })).toBe(false);
  });
});
