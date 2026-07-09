// TEMPORARY diagnostics — verify the Replicate token + pinned model versions
// without a signed-in user and without exposing the token (it stays inside
// the Convex runtime; only booleans/status codes come back). Safe to delete.
import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const MODELS: [key: string, slug: string, version: string][] = [
  [
    "rembg",
    "cjwbw/rembg",
    "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
  ],
  [
    "ocr",
    "abiruyt/text-extract-ocr",
    "a524caeaa23495bc9edc805ab08ab5fe943afd3febed884a4f3747aa32e9cd61",
  ],
  [
    "inpaint",
    "zylim0702/remove-object",
    "0e3a841c913f597c1e4c321560aa69e2bc1f15c65f8c366caafc379240efd8ba",
  ],
];

export const verifyReplicateSetup = internalAction({
  args: {},
  handler: async () => {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return { tokenPresent: false };
    const headers = { Authorization: `Bearer ${token}` };

    const account = await fetch("https://api.replicate.com/v1/account", {
      headers,
    });

    const results: Record<string, unknown> = {
      tokenPresent: true,
      tokenValid: account.ok,
      accountStatus: account.status,
    };

    for (const [key, slug, version] of MODELS) {
      const r = await fetch(
        `https://api.replicate.com/v1/models/${slug}/versions/${version}`,
        { headers },
      );
      // On a stale pin, also report the model's CURRENT latest version id so
      // the registry in ai.ts can be fixed in one edit.
      let latest: string | null = null;
      if (!r.ok) {
        const m = await fetch(`https://api.replicate.com/v1/models/${slug}`, {
          headers,
        });
        if (m.ok) {
          const body = (await m.json()) as {
            latest_version?: { id?: string };
          };
          latest = body.latest_version?.id ?? null;
        }
      }
      results[key] = { slug, pinnedVersionOk: r.ok, status: r.status, latest };
    }
    return results;
  },
});

// ── Full-pipeline test (rembg) ──────────────────────────────────────────────
// Mirrors ai.dispatch minus the signed-in user: store the PNG, insert a job
// row (on the first existing user), POST a real prediction with the webhook,
// stamp the replicateId. The webhook then exercises signature verification +
// completeJob exactly as production does. Poll the row via getTestJob.

export const insertTestJob = internalMutation({
  args: { inputStorageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").first();
    if (!user) throw new Error("no users row to attach the test job to");
    return await ctx.db.insert("ai_jobs", {
      userId: user._id,
      photoKey: "pipeline-diagnostic",
      type: "rembg" as const,
      status: "running" as const,
      inputStorageId: args.inputStorageId,
      startedAt: Date.now(),
      createdAt: Date.now(),
    });
  },
});

export const getTestJob = internalQuery({
  args: { jobId: v.id("ai_jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    return {
      status: job.status,
      error: job.error ?? null,
      hasOutput: !!job.outputStorageId,
      replicateId: job.replicateId ?? null,
    };
  },
});

export const deleteTestJob = internalMutation({
  args: { jobId: v.id("ai_jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (job?.photoKey !== "pipeline-diagnostic") return;
    if (job.inputStorageId) await ctx.storage.delete(job.inputStorageId);
    if (job.outputStorageId) await ctx.storage.delete(job.outputStorageId);
    await ctx.db.delete(args.jobId);
  },
});

/** Repair a users row created from a JWT with no email claim: stamp the
 *  admin email + tier so devGrantTier / Apply Paid / AI tier gates work. */
export const devFixUser = internalMutation({
  args: { email: v.string(), tier: v.union(v.literal("pro"), v.literal("team")) },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").first();
    if (!user) return { ok: false, message: "no users row" };
    await ctx.db.patch(user._id, {
      email: args.email,
      tier: args.tier,
      updatedAt: Date.now(),
    });
    return { ok: true, message: `patched ${user._id}: email + tier=${args.tier}` };
  },
});

export const runPipelineTest = internalAction({
  args: { pngBase64: v.string() },
  handler: async (ctx, args): Promise<{ jobId: Id<"ai_jobs">; replicateId: string }> => {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) throw new Error("no token");

    const bin = atob(args.pngBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const inputStorageId = await ctx.storage.store(
      new Blob([bytes], { type: "image/png" }),
    );

    const jobId: Id<"ai_jobs"> = await ctx.runMutation(
      internal.testReplicate.insertTestJob,
      { inputStorageId },
    );
    const inputUrl = await ctx.storage.getUrl(inputStorageId);
    if (!inputUrl) throw new Error("stored input has no URL");

    const webhookBase = process.env.CONVEX_SITE_URL;
    const resp = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version:
          "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
        input: { image: inputUrl },
        webhook: webhookBase ? `${webhookBase}/replicate-webhook` : undefined,
        webhook_events_filter: ["completed"],
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text();
      throw new Error(`Replicate ${resp.status}: ${detail.slice(0, 300)}`);
    }
    const prediction = (await resp.json()) as { id: string };
    await ctx.runMutation(internal.aiJobs.setReplicateId, {
      jobId,
      replicateId: prediction.id,
    });
    return { jobId, replicateId: prediction.id };
  },
});
