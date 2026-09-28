import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PAID_SIGNUP_ENABLED, PAID_SIGNUP_OFF_NOTE } from "./billing";

/* Paid signup is OFF (Chris, 09-27-2026), and it stays off until someone
 * deliberately turns it back on.
 *
 * The thing being gated takes money, so this file pins BOTH switches. The
 * client flag alone is not a gate — `useAction(api.stripe.createCheckoutSession)`
 * can be called from the browser console by any signed-in user, so the Convex
 * action has to refuse on its own. A test that only checked the constant would
 * pass on a build where the button was hidden and the action still charged.
 */

const stripeTs = readFileSync(
  join(__dirname, "..", "..", "..", "convex", "stripe.ts"),
  "utf8",
);
const panel = readFileSync(
  join(__dirname, "..", "components", "SubscriptionButton.tsx"),
  "utf8",
);

describe("paid signup is off", () => {
  it("the client flag is off", () => {
    expect(PAID_SIGNUP_ENABLED).toBe(false);
  });

  it("and says so in one plain sentence", () => {
    expect(PAID_SIGNUP_OFF_NOTE).toMatch(/\S/);
    expect(PAID_SIGNUP_OFF_NOTE.length).toBeLessThan(80);
  });

  it("the Convex action refuses BEFORE it authenticates or reads a price", () => {
    // Order matters: the refusal has to come first, or a disabled signup still
    // creates a users row and touches Stripe config on every attempt.
    const handler = stripeTs.slice(stripeTs.indexOf("export const createCheckoutSession"));
    const refusal = handler.indexOf("PAID_SIGNUP_ENABLED");
    const auth = handler.indexOf("getUserIdentity");
    const price = handler.indexOf("PRICE_ID_PRO");
    expect(refusal, "no PAID_SIGNUP_ENABLED gate in createCheckoutSession").toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(auth);
    expect(refusal).toBeLessThan(price);
  });

  it("the server flag is off too — two switches, not one", () => {
    expect(stripeTs).toMatch(/const PAID_SIGNUP_ENABLED = false;/);
  });

  it("the BILLING PORTAL is deliberately NOT gated", () => {
    // An existing subscriber must still be able to cancel. Gating this would
    // be worse than leaving signup open.
    const portal = stripeTs.slice(stripeTs.indexOf("export const createPortalSession"));
    expect(portal).not.toContain("PAID_SIGNUP_ENABLED");
  });

  it("the panel only offers checkout when the flag allows it", () => {
    // The button must sit behind the flag — not merely be `disabled`, which
    // still renders something that looks broken rather than not-yet-open.
    const idx = panel.indexOf('redirect("checkout")');
    expect(idx).toBeGreaterThan(-1);
    const before = panel.slice(0, idx);
    expect(before).toContain("PAID_SIGNUP_ENABLED");
  });
});
