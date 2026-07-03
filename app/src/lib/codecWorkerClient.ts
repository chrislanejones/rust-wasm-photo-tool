// app/src/lib/codecWorkerClient.ts
//
// Main-thread facade over the codec Web Worker (codec.worker.ts).
//
// Contract: these helpers return a Blob when the worker handled the job, or
// `null` when the worker is unavailable — callers MUST fall back to their
// existing main-thread path on null. The worker is an accelerator, never a
// replacement, until verified in a real browser.
//
// Transfer semantics: pixel buffers cross to the worker ONLY as transferables
// (Comlink.transfer), never structured-clone. A successful call therefore
// DETACHES the caller's buffer. Availability is probed with a cheap ping()
// BEFORE any real transfer, so a construction/load failure is caught without
// consuming a caller's pixels. Call sites that still need the pixels afterwards
// must copy before calling (handled explicitly at those sites).

import * as Comlink from "comlink";
import type { CodecAPI } from "@/workers/codec.worker";

let worker: Worker | null = null;
let api: Comlink.Remote<CodecAPI> | null = null;
let readiness: Promise<boolean> | null = null;
let warned = false;

/** Fire the "worker unavailable" warning at most once per session. */
function warnOnce(): void {
  if (warned) return;
  warned = true;
  console.warn("codec worker unavailable, using main thread");
}

/**
 * Construct + probe the worker exactly once. Memoized so N concurrent callers
 * (e.g. a multi-image gallery import) share a single probe. Resolves false —
 * and disables the worker for the rest of the session — on construction throw,
 * a module load error (worker.onerror), a ping rejection, or a 3s hang (a
 * worker that failed to load never answers a Comlink message).
 */
function ensureReady(): Promise<boolean> {
  if (readiness) return readiness;
  readiness = new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (!ok) {
        warnOnce();
        try {
          worker?.terminate();
        } catch {
          /* noop */
        }
        worker = null;
        api = null;
      }
      resolve(ok);
    };

    try {
      const w = new Worker(new URL("../workers/codec.worker.ts", import.meta.url), {
        type: "module",
      });
      w.onerror = () => finish(false);
      w.onmessageerror = () => finish(false);
      worker = w;
      api = Comlink.wrap<CodecAPI>(w);

      const timeout = setTimeout(() => finish(false), 3000);
      api
        .ping()
        .then(() => {
          clearTimeout(timeout);
          finish(true);
        })
        .catch(() => {
          clearTimeout(timeout);
          finish(false);
        });
    } catch {
      finish(false);
    }
  });
  return readiness;
}

/** Normalize any RGBA view to a Uint8Array whose buffer we can transfer. */
function asTransferable(pixels: Uint8Array | Uint8ClampedArray): Uint8Array {
  return pixels instanceof Uint8Array
    ? pixels
    : new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
}

/**
 * Encode RGBA → Blob on the worker. Returns null (→ caller falls back) if the
 * worker is unavailable. On success the input buffer is DETACHED.
 */
export async function encodeViaWorker(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  type: string,
  quality: number,
): Promise<Blob | null> {
  if (!(await ensureReady()) || !api) return null;
  try {
    const u8 = asTransferable(pixels);
    return await api.encodeImage(
      Comlink.transfer(u8, [u8.buffer]),
      width,
      height,
      type,
      quality,
    );
  } catch {
    // Post-probe failure: disable the worker for future calls and let this
    // caller fall back. (The buffer may already be detached — call sites that
    // reuse their pixels copy before calling, so their fallback stays valid.)
    warnOnce();
    readiness = Promise.resolve(false);
    return null;
  }
}

/**
 * Build a small WebP thumbnail on the worker. Returns null (→ caller falls
 * back) if the worker is unavailable. On success the input buffer is DETACHED.
 */
export async function thumbnailViaWorker(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  maxEdge: number,
): Promise<Blob | null> {
  if (!(await ensureReady()) || !api) return null;
  try {
    const u8 = asTransferable(pixels);
    return await api.makeThumbnail(
      Comlink.transfer(u8, [u8.buffer]),
      width,
      height,
      maxEdge,
    );
  } catch {
    warnOnce();
    readiness = Promise.resolve(false);
    return null;
  }
}
