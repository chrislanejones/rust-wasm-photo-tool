// New › Create AI Image, wired to the backend (10-08). Text-to-image runs as
// an "generate" ai_job (convex/ai.ts `generate`): the server checks the
// allowance and the Paid tier BEFORE anything is sent to Replicate, the
// completion webhook stores the image, and this hook downloads it as a File
// so the New menu can add it to the gallery like an upload.
import { useCallback, useEffect, useRef, useState } from "react";
import { isNetworkPathAllowed } from "@/lib/networkPaths";
import { useCloudAction, useCloudMutation, useCloudQuery } from "@/lib/cloud";
import { useUIStore } from "@/stores/useUIStore";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AI_JOB_TIMEOUT_MS, AI_TIMEOUT_MESSAGE } from "./useAIJob";

export type GeneratePhase = "idle" | "sending" | "running" | "done" | "error";

/** Downscale a reference so its longest edge is at most `edge`, as PNG. */
async function downscalePng(file: File, edge: number): Promise<Blob> {
  const bm = await createImageBitmap(file);
  const s = Math.min(1, edge / Math.max(bm.width, bm.height));
  const w = Math.max(1, Math.round(bm.width * s));
  const h = Math.max(1, Math.round(bm.height * s));
  const c = new OffscreenCanvas(w, h);
  c.getContext("2d")!.drawImage(bm, 0, 0, w, h);
  bm.close?.();
  return await c.convertToBlob({ type: "image/png" });
}

export function useImageGeneration(onImage: (file: File) => void) {
  const generateUploadUrl = useCloudMutation(api.ai.generateUploadUrl);
  const generate = useCloudAction(api.ai.generate);
  /** null signed out; `daily.cap > 0` ⇔ a plan that includes AI (Paid). */
  const usage = useCloudQuery(api.aiJobs.usage, {});
  const canGenerate = !!usage && usage.daily.cap > 0;

  const [jobId, setJobId] = useState<Id<"ai_jobs"> | null>(null);
  const [phase, setPhase] = useState<GeneratePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const consumedRef = useRef<Id<"ai_jobs"> | null>(null);
  const job = useCloudQuery(api.aiJobs.getJob, jobId ? { jobId } : "skip");

  useEffect(() => {
    if (phase !== "running" || !jobId) return;
    const t = window.setTimeout(() => {
      if (consumedRef.current === jobId) return;
      consumedRef.current = jobId;
      setError(AI_TIMEOUT_MESSAGE);
      setPhase("error");
    }, AI_JOB_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [phase, jobId]);

  useEffect(() => {
    if (!job || !jobId || consumedRef.current === jobId) return;
    if (job.status === "failed") {
      consumedRef.current = jobId;
      setError(job.error ?? "Generation failed");
      setPhase("error");
      return;
    }
    if (job.status === "done" && job.outputUrl) {
      consumedRef.current = jobId;
      void (async () => {
        try {
          const blob = await (await fetch(job.outputUrl!)).blob();
          const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
          onImage(new File([blob], `ai-image-${Date.now()}.${ext}`, { type: blob.type || "image/png" }));
          setPhase("done");
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          setPhase("error");
        }
      })();
    }
  }, [job, jobId, onImage]);

  const run = useCallback(
    async (req: { model: string; prompt: string; aspectRatio: string; references: File[]; referenceEdge: number }) => {
      if (!isNetworkPathAllowed("ai_processing", useUIStore.getState().onlineFeaturesEnabled)) {
        setError("Online features are off, so nothing is sent. Turn them on in Settings › Security.");
        setPhase("error");
        return;
      }
      setError(null);
      setPhase("sending");
      try {
        const referenceStorageIds: Id<"_storage">[] = [];
        for (const f of req.references) {
          const png = await downscalePng(f, req.referenceEdge);
          const uploadUrl = await generateUploadUrl();
          const resp = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "image/png" }, body: png });
          const { storageId } = (await resp.json()) as { storageId: Id<"_storage"> };
          referenceStorageIds.push(storageId);
        }
        const { jobId: id } = await generate({
          // The panel only offers the six models the action accepts.
          model: req.model as Parameters<typeof generate>[0]["model"],
          prompt: req.prompt,
          aspectRatio: req.aspectRatio as Parameters<typeof generate>[0]["aspectRatio"],
          referenceStorageIds: referenceStorageIds.length ? referenceStorageIds : undefined,
        });
        consumedRef.current = null;
        setJobId(id);
        setPhase("running");
      } catch (e) {
        setError(e instanceof Error ? e.message.replace(/^.*Uncaught Error: /, "") : String(e));
        setPhase("error");
      }
    },
    [generateUploadUrl, generate],
  );

  return { run, phase, error, canGenerate, signedIn: usage !== null && usage !== undefined };
}
