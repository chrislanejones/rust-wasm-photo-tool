import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

// Pro plan price (test mode). Created via the Stripe API; lookup_key
// "image_horse_pro_monthly". $10/mo USD.
const PRICE_ID_PRO = "price_1Tja8nCy0zfGXBJlOEiYZ7t2";

/** POST to the Stripe REST API with form-encoded body (no SDK — same approach
 *  as the Replicate integration, keeps the Convex runtime lean). */
async function stripePost(
  path: string,
  body: Record<string, string>,
): Promise<Record<string, unknown>> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set on the Convex deployment");
  const resp = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await resp.json()) as Record<string, unknown>;
  if (!resp.ok) {
    throw new Error(`Stripe ${resp.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}

/** Paid signup — OFF. Chris, 09-27-2026: "that stripe area is not ready
 *  disable for now."
 *
 *  THIS is the real gate, not the disabled button in SubscriptionButton.tsx:
 *  a disabled button is a suggestion, and any signed-in user can call a Convex
 *  action straight from the console. Refusing here is what makes it impossible
 *  to charge a card.
 *
 *  `createPortalSession` below is deliberately NOT gated — anyone who already
 *  subscribed must still be able to see and cancel their subscription.
 *
 *  Re-enabling takes this flag AND `PAID_SIGNUP_ENABLED` in
 *  app/src/lib/billing.ts, which is what the UI reads. Two switches on
 *  purpose: one of them flipped alone leaves a button that always errors, or
 *  a gate with no way to reach it — both visible, neither able to take money. */
const PAID_SIGNUP_ENABLED = false;
const PAID_SIGNUP_OFF_MESSAGE = "Pro signups are not open yet.";

/**
 * Create a Stripe Checkout Session for the Pro subscription and return its URL.
 * The client redirects the browser to it. We stamp the Convex user id into the
 * session + subscription metadata so the webhook can map the result back.
 */
export const createCheckoutSession = action({
  args: { origin: v.string() },
  handler: async (ctx, args): Promise<{ url: string }> => {
    if (!PAID_SIGNUP_ENABLED) throw new Error(PAID_SIGNUP_OFF_MESSAGE);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    // Ensure a users row exists; upsert returns its id.
    const userId = await ctx.runMutation(api.users.upsert, {});

    const params: Record<string, string> = {
      mode: "subscription",
      "line_items[0][price]": PRICE_ID_PRO,
      "line_items[0][quantity]": "1",
      success_url: `${args.origin}/?upgraded=1`,
      cancel_url: `${args.origin}/?upgrade=cancelled`,
      client_reference_id: String(userId),
      "metadata[userId]": String(userId),
      "subscription_data[metadata][userId]": String(userId),
      allow_promotion_codes: "true",
    };
    if (identity.email) params.customer_email = identity.email;

    const session = await stripePost("checkout/sessions", params);
    return { url: session.url as string };
  },
});

/**
 * Create a Stripe Billing Portal session so the user can manage / cancel their
 * subscription, and return its URL.
 */
export const createPortalSession = action({
  args: { origin: v.string() },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const sub = await ctx.runQuery(api.subscriptions.getByUser, {});
    if (!sub?.stripeCustomerId) {
      throw new Error("No subscription to manage yet");
    }
    const session = await stripePost("billing_portal/sessions", {
      customer: sub.stripeCustomerId,
      return_url: args.origin,
    });
    return { url: session.url as string };
  },
});
