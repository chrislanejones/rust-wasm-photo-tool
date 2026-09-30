// Paid signup — OFF. Chris, 09-27-2026: "that stripe area is not ready
// disable for now."
//
// This is the INVERSE of the repo's usual flag shape. `ih_patchmatch` and the
// op-log switches are defaults-ON with a "0" kill; this one is defaults-OFF,
// because the thing being gated takes money. A flag that fails open would
// charge a real card the first time anything went wrong with it.
//
// WHAT IS OFF: starting a NEW subscription. `createCheckoutSession` is refused
// in the Convex action itself (convex/stripe.ts) — this constant only decides
// what the UI offers, and a disabled button is not a gate. Anyone can call a
// Convex action from the console.
//
// WHAT STAYS ON, deliberately: the billing portal. If an existing subscriber
// exists, they must still be able to see and CANCEL their subscription;
// taking that away would be worse than leaving signup open. `Manage
// subscription` therefore renders whenever the account is already paid.
//
// Also still on: the Super User tier toggle in Settings, which is how tiers
// get granted for testing and does not involve Stripe at all.
//
// TO RE-ENABLE: flip this to `true` AND remove the matching refusal in
// convex/stripe.ts's `createCheckoutSession`. Both, or checkout still fails —
// that is the point of having two.
export const PAID_SIGNUP_ENABLED = false;

/** What the Pro card says while signup is off. One sentence, no apology, and
 *  no date we would then have to keep. */
export const PAID_SIGNUP_OFF_NOTE = "Pro isn't open for signups yet.";
