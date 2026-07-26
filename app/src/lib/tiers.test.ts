// Two vocabularies describe one concept: Convex stores `free | pro | team`
// (convex/schema.ts) and the client gates on `demo | loggedIn | paid`. Nothing
// translated between them and nothing tested the gap, so `AuthModeWatcher`
// reported `loggedIn` for EVERY signed-in user — a pro/team subscriber got
// free-tier caps and no Replicate AI, while the server happily enforced the
// tier they had actually paid for. These pin the translation and the caps it
// unlocks, so the same silence can't happen twice.
import { describe, it, expect } from "vitest";
import { TIERS, userModeForTier, hasReplicateAI } from "./tiers";

describe("userModeForTier: Convex tier -> UI UserMode", () => {
  it("maps the paying tiers to `paid`", () => {
    expect(userModeForTier("pro")).toBe("paid");
    expect(userModeForTier("team")).toBe("paid");
  });

  it("maps the free tier to `loggedIn`", () => {
    expect(userModeForTier("free")).toBe("loggedIn");
  });

  // The Convex query is `"skip"`ped until Convex itself is authenticated, so
  // `null` is the normal in-flight state for a signed-in user, not an error.
  // It must resolve DOWN, never up: a free user seeing a flash of paid
  // features is a worse failure than a paid user waiting one tick.
  it("treats an unresolved tier as loggedIn, never paid", () => {
    expect(userModeForTier(null)).toBe("loggedIn");
    expect(userModeForTier(undefined)).toBe("loggedIn");
  });

  it("treats an unrecognised tier as loggedIn (fail closed)", () => {
    expect(userModeForTier("enterprise")).toBe("loggedIn");
    expect(userModeForTier("")).toBe("loggedIn");
  });
});

describe("the caps a paid account is actually buying", () => {
  // Regression evidence: with the mapping missing, every one of these landed
  // on the loggedIn row for a paying customer.
  it("paid beats loggedIn on every metered dimension", () => {
    expect(TIERS.paid.galleryLimit).toBeGreaterThan(TIERS.loggedIn.galleryLimit);
    expect(TIERS.paid.storageQuotaBytes!).toBeGreaterThan(
      TIERS.loggedIn.storageQuotaBytes!,
    );
    expect(TIERS.paid.layersPerImage).toBeGreaterThan(
      TIERS.loggedIn.layersPerImage,
    );
  });

  it("Replicate AI is the paid-only headline — and only `paid` has it", () => {
    expect(hasReplicateAI("paid")).toBe(true);
    expect(hasReplicateAI("loggedIn")).toBe(false);
    expect(hasReplicateAI("demo")).toBe(false);
  });

  it("a pro subscriber resolves to the tier that unlocks AI", () => {
    expect(hasReplicateAI(userModeForTier("pro"))).toBe(true);
    expect(hasReplicateAI(userModeForTier("team"))).toBe(true);
    expect(hasReplicateAI(userModeForTier("free"))).toBe(false);
  });
});
