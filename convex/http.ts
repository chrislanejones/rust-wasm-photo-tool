// .convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const http = httpRouter();

// ── Replicate webhook security helpers ─────────────────────────────────────

const FIVE_MIN_MS = 5 * 60 * 1000;

/** Constant-time string compare (avoids leaking match position via timing). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * Verify a Replicate webhook using the standard (svix-style) scheme:
 * HMAC-SHA256 over `${id}.${timestamp}.${body}`, keyed by the base64-decoded
 * signing secret (env value is prefixed `whsec_`). Returns true only if a
 * provided signature matches AND the timestamp is fresh (replay protection).
 * Fails closed on any malformed input.
 */
async function verifyReplicateSig(
  body: string,
  headers: Headers,
  secret: string,
): Promise<boolean> {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !sigHeader) return false;

  // Replay protection: reject timestamps more than ~5 min from now (either way).
  const tsMs = Number(timestamp) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > FIVE_MIN_MS) {
    return false;
  }

  // Secret is `whsec_<base64>`; strip the prefix and decode the key bytes.
  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(rawSecret);
  } catch {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  const expected = bytesToBase64(sigBuf);

  // Header is a space-separated list of `version,signature` pairs (e.g. `v1,...`).
  for (const part of sigHeader.split(" ")) {
    const comma = part.indexOf(",");
    const provided = comma === -1 ? part : part.slice(comma + 1);
    if (timingSafeEqual(expected, provided)) return true;
  }
  return false;
}

/**
 * SSRF guard for payload-supplied result URLs: only fetch over https from
 * Replicate-hosted domains. Uses proper hostname suffix matching (not substring)
 * so `replicate.delivery.evil.com` is rejected.
 */
function isAllowedReplicateHost(urlStr: string): boolean {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  const allowed = ["replicate.delivery", "replicate.com"];
  return allowed.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * Replicate completion webhook.
 *
 * Replicate POSTs the finished prediction here (configured per-request in
 * ai.dispatch). We look the job up by prediction id — there's no user JWT on
 * this request, so everything goes through internal functions. On success we
 * pull the output image into Convex storage so the client gets a stable,
 * authenticated URL; on failure we record the error.
 *
 * Security: the request is authenticated via `verifyReplicateSig` (HMAC over
 * the raw body, keyed by REPLICATE_WEBHOOK_SIGNING_SECRET) before the payload
 * is trusted; missing secret → fail closed. Output URLs are validated against
 * a Replicate host allowlist before fetch (SSRF / result-spoofing guard).
 */
http.route({
  path: "/replicate-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    // Authenticate before trusting anything in the payload. Read the raw body
    // (HMAC is computed over the exact bytes) — do NOT use req.json() here.
    const body = await req.text();

    const signingSecret = process.env.REPLICATE_WEBHOOK_SIGNING_SECRET;
    if (!signingSecret) {
      // Fail closed: without the secret we cannot authenticate the caller.
      console.warn(
        "REPLICATE_WEBHOOK_SIGNING_SECRET is not set — rejecting webhook (fail closed).",
      );
      return new Response("webhook not configured", { status: 401 });
    }
    if (!(await verifyReplicateSig(body, req.headers, signingSecret))) {
      return new Response("invalid signature", { status: 401 });
    }

    let payload: {
      id?: string;
      status?: string;
      output?: unknown;
      error?: unknown;
    };
    try {
      payload = JSON.parse(body);
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

      // SSRF guard: only fetch result URLs hosted by Replicate.
      if (!isAllowedReplicateHost(outputUrl)) {
        await ctx.runMutation(internal.aiJobs.failJob, {
          jobId: job._id,
          error: `Rejected non-Replicate output host: ${outputUrl.slice(0, 200)}`,
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
