// QC F3 (09-24-2026): the AI caps come from ENTITLEMENT. An admin is entitled
// to paid, so an admin on a free row gets paid caps — the same answer
// `users.me` gives the UI. Anything not entitled to paid gets 0, which is the
// gate ("AI tools require a paid plan").
import { describe, it, expect } from "vitest";
import { AI_CAPS, aiCapsFor } from "../../../convex/aiCaps";
import { entitlementOf } from "../../../convex/entitlement";

describe("aiCapsFor", () => {
  it("free and signed-out entitlement: no AI", () => {
    expect(aiCapsFor("free", "free")).toEqual({ daily: 0, monthly: 0 });
    expect(aiCapsFor(null, "none")).toEqual({ daily: 0, monthly: 0 });
  });

  it("paid tiers keep their own caps", () => {
    expect(aiCapsFor("pro", "paid")).toEqual(AI_CAPS.pro);
    expect(aiCapsFor("team", "paid")).toEqual(AI_CAPS.team);
    expect(AI_CAPS.pro).toEqual({ daily: 50, monthly: 300 });
    expect(AI_CAPS.team).toEqual({ daily: 200, monthly: 1500 });
  });

  it("THE BUG: an admin on a free row is entitled to paid, so gets paid caps", () => {
    const entitlement = entitlementOf("free", "admin", true);
    expect(entitlement).toBe("paid");
    expect(aiCapsFor("free", entitlement)).toEqual(AI_CAPS.pro);
  });

  it("a stored paid tier is not enough on its own — the entitlement decides", () => {
    // Belt and braces: callers pass entitlementOf's answer, and a row that
    // somehow says "pro" with a non-paid entitlement stays closed.
    expect(aiCapsFor("pro", "free")).toEqual({ daily: 0, monthly: 0 });
  });
});
