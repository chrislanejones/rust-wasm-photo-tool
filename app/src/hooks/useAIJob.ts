import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type AIJobType = "rembg" | "upscale" | "inpaint" | "ocr" | "alt";

export interface AIResultPixels {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
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
export function useAIJob(onImageResult: (r: AIResultPixels) => void) {
  const generateUploadUrl = useMutation(api.ai.generateUploadUrl);
  const dispatch = useAction(api.ai.dispatch);

  const [jobId, setJobId] = useState<Id<"ai_jobs"> | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [textResult, setTextResult] = useState<string | null>(null);
  // Guard so a re-render doesn't decode/apply the same finished job twice.
  const consumedRef = useRef<Id<"ai_jobs"> | null>(null);

  const job = useQuery(api.aiJobs.getJob, jobId ? { jobId } : "skip");

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
            onImageResult(r);
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
      setError(null);
      setTextResult(null);
      setPhase("uploading");
      try {
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
        const inputStorageId = await uploadPng(png);
        const maskStorageId = maskPng ? await uploadPng(maskPng) : undefined;
        const { jobId: newJobId } = await dispatch({
          photoKey,
          type,
          inputStorageId,
          maskStorageId,
        });
        consumedRef.current = null;
        setJobId(newJobId);
        setPhase("running");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    },
    [generateUploadUrl, dispatch],
  );

  const reset = useCallback(() => {
    setJobId(null);
    setPhase("idle");
    setError(null);
    setTextResult(null);
    consumedRef.current = null;
  }, []);

  const busy = phase === "uploading" || phase === "running";
  return { run, reset, phase, busy, error, textResult };
}
