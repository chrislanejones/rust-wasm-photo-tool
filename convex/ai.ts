import { v } from "convex/values";
import { action, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./users";
import type { Id } from "./_generated/dataModel";

// ── Replicate model registry ───────────────────────────────────────────────
// Each entry pins a model version and builds the `input` payload from the
// signed URL of the source frame. Add a new model here + a `type` literal in
// schema.ts/aiJobs.ts to extend the pipeline.
//
// NOTE: version hashes drift as models are re-published. Verify the rembg hash
// against https://replicate.com/cjwbw/rembg/versions before first deploy.
type ModelType = "rembg" | "upscale" | "inpaint" | "ocr" | "alt";

const MODELS: Partial<
  Record<
    ModelType,
    { version: string; buildInput: (imageUrl: string, maskUrl?: string) => unknown }
  >
> = {
  rembg: {
    version:
      "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
    buildInput: (imageUrl) => ({ image: imageUrl }),
  },
  ocr: {
    version:
      "a524caeaa23495bc9edc805ab08ab5fe943afd3febed884a4f3747aa32e9cd61",
    buildInput: (imageUrl) => ({ image: imageUrl }),
  },
  inpaint: {
    version:
      "0e3a841c913f597c1e4c321560aa69e2bc1f15c65f8c366caafc379240efd8ba",
    buildInput: (imageUrl, maskUrl) => ({ image: imageUrl, mask: maskUrl }),
  },
  // upscale / inpaint / ocr land here as the pattern is cloned (milestone 2+).
};

/** Short-lived upload URL for the source frame (current canvas PNG).
 *  Auth-gated: only signed-in users can mint upload URLs (prevents anonymous
 *  clients from pushing orphaned blobs into storage). */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Dispatch an AI job to Replicate.
 *
 * 1. `startJob` (transactional): auth + tier + daily-cap check, insert the job
 *    row (status "running"), and hand back a signed URL for the input frame.
 * 2. POST to Replicate with a completion webhook pointed at this deployment.
 * 3. Stamp the prediction id so the webhook can find the row.
 *
 * Returns the jobId; the client subscribes via `aiJobs.getJob`.
 */
export const dispatch = action({
  args: {
    photoKey: v.string(),
    type: v.union(
      v.literal("rembg"),
      v.literal("upscale"),
      v.literal("inpaint"),
      v.literal("ocr"),
      v.literal("alt"),
    ),
    inputStorageId: v.id("_storage"),
    maskStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args): Promise<{ jobId: Id<"ai_jobs"> }> => {
    const model = MODELS[args.type as ModelType];
    if (!model) {
      throw new Error(`AI model "${args.type}" is not wired up yet`);
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      throw new Error("REPLICATE_API_TOKEN is not set on the Convex deployment");
    }

    if (args.type === "inpaint" && !args.maskStorageId) {
      throw new Error("Object removal requires a mask");
    }

    const { jobId, inputUrl, maskUrl } = await ctx.runMutation(
      internal.aiJobs.startJob,
      {
        photoKey: args.photoKey,
        type: args.type,
        inputStorageId: args.inputStorageId,
        maskStorageId: args.maskStorageId,
      },
    );

    try {
      const webhookBase = process.env.CONVEX_SITE_URL;
      const resp = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: model.version,
          input: model.buildInput(inputUrl, maskUrl ?? undefined),
          webhook: webhookBase
            ? `${webhookBase}/replicate-webhook`
            : undefined,
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
    } catch (err) {
      await ctx.runMutation(internal.aiJobs.failJob, {
        jobId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    return { jobId };
  },
});

// ── Text-to-image (New › Create AI Image, 10-08) ─────────────────────────────
//
// The six models the panel offers (app/src/features/upload/aiImageDraft.ts).
// Each is run by its MODEL endpoint (`/v1/models/{owner}/{name}/predictions`)
// so no version hash goes stale. Input names come from each model's published
// schema (replicate.com/<model>/llms.txt, read 10-08): all take `prompt` and
// `aspect_ratio`; Ideogram has no `output_format`; the reference input is
// `input_image` (Kontext), `image` (SD 3.5) and `style_reference_images`
// (Ideogram). The completion webhook stores the image exactly as it does for
// background removal (it accepts a single URL or an array).
const GENERATE_MODELS = {
  "black-forest-labs/flux-schnell": { png: true, refs: "none" },
  "black-forest-labs/flux-dev": { png: true, refs: "none" },
  "black-forest-labs/flux-1.1-pro": { png: true, refs: "none" },
  "black-forest-labs/flux-kontext-pro": { png: true, refs: "input_image" },
  "stability-ai/stable-diffusion-3.5-large": { png: true, refs: "image" },
  "ideogram-ai/ideogram-v3-turbo": { png: false, refs: "style_reference_images" },
} as const;

type GenerateModel = keyof typeof GENERATE_MODELS;

/** Replicate input for one generate job. Pure, so it is unit-testable. */
export function buildGenerateInput(
  model: GenerateModel,
  prompt: string,
  aspectRatio: string,
  referenceUrls: string[],
): Record<string, unknown> {
  const spec = GENERATE_MODELS[model];
  const input: Record<string, unknown> = { prompt, aspect_ratio: aspectRatio };
  if (spec.png) input.output_format = "png";
  if (referenceUrls.length > 0) {
    if (spec.refs === "input_image") input.input_image = referenceUrls[0];
    else if (spec.refs === "image") input.image = referenceUrls[0];
    else if (spec.refs === "style_reference_images") input.style_reference_images = referenceUrls.slice(0, 3);
  }
  return input;
}

export const generate = action({
  args: {
    model: v.union(
      v.literal("black-forest-labs/flux-schnell"),
      v.literal("black-forest-labs/flux-dev"),
      v.literal("black-forest-labs/flux-1.1-pro"),
      v.literal("black-forest-labs/flux-kontext-pro"),
      v.literal("stability-ai/stable-diffusion-3.5-large"),
      v.literal("ideogram-ai/ideogram-v3-turbo"),
    ),
    prompt: v.string(),
    aspectRatio: v.union(
      v.literal("1:1"),
      v.literal("16:9"),
      v.literal("9:16"),
      v.literal("4:3"),
      v.literal("3:2"),
    ),
    referenceStorageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args): Promise<{ jobId: Id<"ai_jobs"> }> => {
    const prompt = args.prompt.trim();
    if (prompt.length === 0) throw new Error("Describe the image first");
    if (prompt.length > 2000) throw new Error("The prompt is too long (2,000 characters at most)");

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      throw new Error("REPLICATE_API_TOKEN is not set on the Convex deployment");
    }

    const spec = GENERATE_MODELS[args.model];
    // A model that cannot read references is never sent them — the panel's
    // consent line already says so (attachmentsSent).
    const refs = spec.refs === "none" ? [] : (args.referenceStorageIds ?? []).slice(0, 3);

    // Allowance and paid-tier check happen here, server-side, before any spend.
    const { jobId, referenceUrls } = await ctx.runMutation(internal.aiJobs.startGenerateJob, {
      prompt,
      model: args.model,
      referenceStorageIds: refs,
    });

    try {
      const webhookBase = process.env.CONVEX_SITE_URL;
      const resp = await fetch(`https://api.replicate.com/v1/models/${args.model}/predictions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: buildGenerateInput(args.model, prompt, args.aspectRatio, referenceUrls),
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
    } catch (err) {
      await ctx.runMutation(internal.aiJobs.failJob, {
        jobId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
    return { jobId };
  },
});
