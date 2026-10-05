import { useCallback, useEffect, useRef, useState } from "react";
import { isNetworkPathAllowed } from "@/lib/networkPaths";
import { useCloudAction, useCloudMutation, useCloudQuery } from "@/lib/cloud";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useUIStore } from "@/stores/useUIStore";

/** What a refused job says. */
const ONLINE_FEATURES_OFF_ERROR =
  "Online features are off, so nothing is sent. Turn them on in Settings › Security to use this.";

export type AIJobType = "rembg" | "upscale" | "inpaint" | "ocr" | "alt";

export interface AIResultPixels {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  /** The photo the job was started on — the caller must not apply the
   *  result to any other. */
  photoKey?: string;
}

type Phase = "idle" | "uploading" | "running" | "done" | "error";

/** Decode a PNG/image URL into raw RGBA pixels for the WASM buffer. */
async function urlToPixels(url: string): Promise<AIResultPixels> {
  const blob = await (await fetch(url)).blob();
  const bitmap = await createImageBitmap(blob);
  // Capture BEFORE close() — a closed ImageBitmap reports width/height 0,
  // which used to propagate a 0×0 "result" into loadImageFromPixels and
  // blank the canvas.
  const width = bitmap.width;
  const height = bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const cx = canvas.getContext("2d");
  if (!cx) throw new Error("2D canvas unavailable");
  cx.drawImage(bitmap, 0, 0);
  const data = cx.getImageData(0, 0, width, height);
  bitmap.close?.();
  return { pixels: data.data, width, height };
}

/**
 * Drives a single AI job end-to-end:
 *   upload source PNG (+ optional mask) -> dispatch action -> Convex
 *   subscription on the job row -> when the webhook marks it done, decode the
 *   result and hand pixels back.
 *
 * `onImageResult` receives decoded pixels for image models (rembg/upscale/
 * inpaint); text models surface via the returned `textResult`.
 */
/** A job the backend never settles becomes an Error after this long, instead
 *  of a spinner that runs for ever (Plan C §3). Replicate's own runs finish in
 *  well under a minute; three is generous. */
export const AI_JOB_TIMEOUT_MS = 180_000;
/** Upload + dispatch, before the job exists. */
const AI_UPLOAD_TIMEOUT_MS = 60_000;
export const AI_TIMEOUT_MESSAGE =
  "The AI service didn't answer in time. Your photo is unchanged.";

export function useAIJob(onImageResult: (r: AIResultPixels) => void) {
  const generateUploadUrl = useCloudMutation(api.ai.generateUploadUrl);
  const dispatch = useCloudAction(api.ai.dispatch);

  const [jobId, setJobId] = useState<Id<"ai_jobs"> | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [textResult, setTextResult] = useState<string | null>(null);
  // Guard so a re-render doesn't decode/apply the same finished job twice.
  const consumedRef = useRef<Id<"ai_jobs"> | null>(null);
  // The photo the running job belongs to, carried onto its result.
  const photoKeyRef = useRef<string | undefined>(undefined);

  const job = useCloudQuery(api.aiJobs.getJob, jobId ? { jobId } : "skip");
  // The last request, so an Error can offer "Try again".
  const lastArgsRef = useRef<Parameters<typeof run> | null>(null);

  // Running with no answer for AI_JOB_TIMEOUT_MS → Error. consumedRef makes a
  // late answer for this job a no-op rather than a surprise.
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
      setError(job.error ?? "AI job failed");
      setPhase("error");
      return;
    }
    if (job.status === "done") {
      consumedRef.current = jobId;
      if (job.outputUrl) {
        urlToPixels(job.outputUrl)
          .then((r) => {
            onImageResult({ ...r, photoKey: photoKeyRef.current });
            setPhase("done");
          })
          .catch((e) => {
            setError(e instanceof Error ? e.message : String(e));
            setPhase("error");
          });
      } else {
        // Text model (OCR/alt): output is the raw value.
        setTextResult(
          typeof job.output === "string" ? job.output : JSON.stringify(job.output),
        );
        setPhase("done");
      }
    }
  }, [job, jobId, onImageResult]);

  const run = useCallback(
    async (
      type: AIJobType,
      photoKey: string,
      png: Uint8Array,
      maskPng?: Uint8Array,
    ) => {
      // THE choke point. Every upload a panel can start goes through here, so
      // this is where "Everything in your browser" is enforced rather than
      // only drawn: a tile or button that forgot the switch still cannot send
      // a picture. Read at call time, not captured, so a switch flipped a
      // moment ago counts.
      if (!isNetworkPathAllowed("ai_processing", useUIStore.getState().onlineFeaturesEnabled)) {
        setTextResult(null);
        setError(ONLINE_FEATURES_OFF_ERROR);
        setPhase("error");
        return;
      }
      lastArgsRef.current = [type, photoKey, png, maskPng];
      setError(null);
      setTextResult(null);
      photoKeyRef.current = photoKey;
      setPhase("uploading");
      let uploadTimer: number | undefined;
      try {
        const timedOut = new Promise<never>((_, reject) => {
          uploadTimer = window.setTimeout(() => reject(new Error(AI_TIMEOUT_MESSAGE)), AI_UPLOAD_TIMEOUT_MS);
        });
        // Tag as image/png so the stored blob's content-type is correct —
        // Replicate fetches this URL and some models reject octet-stream.
        const uploadPng = async (bytes: Uint8Array) => {
          const uploadUrl = await generateUploadUrl();
          const resp = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": "image/png" },
            body: bytes.buffer as ArrayBuffer,
          });
          const { storageId } = (await resp.json()) as { storageId: string };
          return storageId as Id<"_storage">;
        };
        const { jobId: newJobId } = await Promise.race([
          (async () => {
            const inputStorageId = await uploadPng(png);
            const maskStorageId = maskPng ? await uploadPng(maskPng) : undefined;
            return dispatch({ photoKey, type, inputStorageId, maskStorageId });
          })(),
          timedOut,
        ]);
        consumedRef.current = null;
        setJobId(newJobId);
        setPhase("running");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      } finally {
        window.clearTimeout(uploadTimer);
      }
    },
    [generateUploadUrl, dispatch],
  );

  /** Run the last request again — the Error state's action. */
  const retry = useCallback(() => {
    const args = lastArgsRef.current;
    if (args) void run(...args);
  }, [run]);

  const reset = useCallback(() => {
    setJobId(null);
    setPhase("idle");
    setError(null);
    setTextResult(null);
    consumedRef.current = null;
  }, []);

  const busy = phase === "uploading" || phase === "running";
  return { run, retry, reset, phase, busy, error, textResult };
}
