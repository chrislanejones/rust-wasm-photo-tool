// .convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

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
      // rembg/upscale/inpaint return an image URL (string, or array of URLs).
      const outputUrl = Array.isArray(payload.output)
        ? payload.output[0]
        : payload.output;

      if (typeof outputUrl !== "string") {
        // Non-image output (OCR/alt text) — persist the raw value.
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

export default http;
