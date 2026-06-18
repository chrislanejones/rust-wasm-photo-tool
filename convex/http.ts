// .convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const http = httpRouter();

/**
 * Replicate completion webhook.
 *
 * Replicate POSTs the finished prediction here (configured per-request in
 * ai.dispatch). We look the job up by prediction id — there's no user JWT on
 * this request, so everything goes through internal functions. On success we
 * pull the output image into Convex storage so the client gets a stable,
 * authenticated URL; on failure we record the error.
 *
 * NOTE: signature verification (the `webhook-signature` header against the
 * deployment's signing secret) is not yet enforced — add it before prod.
 */
http.route({
  path: "/replicate-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let payload: {
      id?: string;
      status?: string;
      output?: unknown;
      error?: unknown;
    };
    try {
      payload = await req.json();
    } catch {
      return new Response("bad payload", { status: 400 });
    }

    const replicateId = payload.id;
    if (!replicateId) return new Response("missing id", { status: 400 });

    const job = await ctx.runQuery(internal.aiJobs.findByReplicateId, {
      replicateId,
    });
    // Unknown / already-finalized job → ack so Replicate stops retrying.
    if (!job || job.status === "done" || job.status === "failed") {
      return new Response("ok", { status: 200 });
    }

    if (payload.status === "failed" || payload.status === "canceled") {
      await ctx.runMutation(internal.aiJobs.failJob, {
        jobId: job._id,
        error:
          (typeof payload.error === "string" && payload.error) ||
          `Replicate ${payload.status}`,
      });
      return new Response("ok", { status: 200 });
    }

    if (payload.status === "succeeded") {
      // Text models (OCR / alt text) return the text itself, not an image
      // URL. Persist it directly so the client surfaces it as textResult.
      if (job.type === "ocr" || job.type === "alt") {
        const text = Array.isArray(payload.output)
          ? payload.output.join("\n")
          : payload.output;
        await ctx.runMutation(internal.aiJobs.completeJob, {
          jobId: job._id,
          output: text,
        });
        return new Response("ok", { status: 200 });
      }

      // Image models (rembg/upscale/inpaint) return an image URL (string,
      // or array of URLs).
      const outputUrl = Array.isArray(payload.output)
        ? payload.output[0]
        : payload.output;

      if (typeof outputUrl !== "string") {
        await ctx.runMutation(internal.aiJobs.completeJob, {
          jobId: job._id,
          output: payload.output,
        });
        return new Response("ok", { status: 200 });
      }

      try {
        const imgResp = await fetch(outputUrl);
        if (!imgResp.ok) {
          throw new Error(`fetch output ${imgResp.status}`);
        }
        const blob = await imgResp.blob();
        const outputStorageId = await ctx.storage.store(blob);
        await ctx.runMutation(internal.aiJobs.completeJob, {
          jobId: job._id,
          outputStorageId,
        });
      } catch (err) {
        await ctx.runMutation(internal.aiJobs.failJob, {
          jobId: job._id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return new Response("ok", { status: 200 });
    }

    // Other interim statuses (shouldn't arrive given webhook_events_filter).
    return new Response("ok", { status: 200 });
  }),
});

// ── Stripe billing webhook ─────────────────────────────────────────────────

function mapStripeStatus(s: string): "active" | "canceled" | "past_due" {
  if (s === "active" || s === "trialing") return "active";
  if (s === "past_due" || s === "unpaid") return "past_due";
  return "canceled";
}

/** Verify a Stripe-Signature header against the raw body (Web Crypto HMAC). */
async function verifyStripeSig(
  payload: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i), p.slice(i + 1)];
    }),
  ) as Record<string, string>;
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
  const hex = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === v1;
}

async function stripeGet(path: string): Promise<Record<string, unknown>> {
  const key = process.env.STRIPE_SECRET_KEY!;
  const resp = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  return (await resp.json()) as Record<string, unknown>;
}

http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const body = await req.text();
    if (
      !secret ||
      !(await verifyStripeSig(body, req.headers.get("stripe-signature"), secret))
    ) {
      return new Response("bad signature", { status: 400 });
    }

    const event = JSON.parse(body) as {
      type: string;
      data: { object: Record<string, any> };
    };
    const obj = event.data.object;

    if (event.type === "checkout.session.completed") {
      const userId = obj.metadata?.userId as string | undefined;
      const subId = obj.subscription as string | undefined;
      if (userId && subId) {
        const sub = await stripeGet(`subscriptions/${subId}`);
        await ctx.runMutation(internal.subscriptions.fulfill, {
          userId: userId as Id<"users">,
          stripeCustomerId: String(obj.customer ?? ""),
          stripeSubId: subId,
          plan: "pro",
          status: mapStripeStatus(String(sub.status ?? "")),
          currentPeriodEnd: Number(sub.current_period_end ?? 0) * 1000,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        });
      }
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const userId = obj.metadata?.userId as string | undefined;
      if (userId) {
        const status =
          event.type === "customer.subscription.deleted"
            ? ("canceled" as const)
            : mapStripeStatus(String(obj.status ?? ""));
        await ctx.runMutation(internal.subscriptions.fulfill, {
          userId: userId as Id<"users">,
          stripeCustomerId: String(obj.customer ?? ""),
          stripeSubId: String(obj.id ?? ""),
          plan: "pro",
          status,
          currentPeriodEnd: Number(obj.current_period_end ?? 0) * 1000,
          cancelAtPeriodEnd: Boolean(obj.cancel_at_period_end),
        });
      }
    }

    return new Response("ok", { status: 200 });
  }),
});

export default http;
