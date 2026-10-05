// The /features page renders a hand-written card per feature, keyed by the
// feature's NAME in docs/Features.md (generated into marketing features.ts).
// Rename a feature and its card silently falls back to the raw repo line —
// which is what the Bulk → Crop renames did twice in one week. This pins it:
// every card key must still match a feature name.
import { describe, it, expect } from "vitest";
import { unmatchedCardKeys } from "../../../marketing/src/data/featureCards";

describe("marketing feature cards", () => {
  it("every card is keyed by a feature name that still exists", () => {
    expect(unmatchedCardKeys()).toEqual([]);
  });
});
