// The phone side of Transfer (ADR-102), as plain functions: no React, no
// engine, nothing that imports `stamp_tool`. A phone never loads the engine
// (#288), and this file is what the phone's Send to computer runs.
import { withTimeout } from "@/lib/withTimeout";

/** One of the five labels the server keeps (convex/transfers.ts DEVICE_LABELS). */
export type DeviceLabel = "iPhone" | "iPad" | "Android phone" | "Android tablet" | "Phone";

/** The Inbox's "from" label, from the user agent. Anything unrecognized is
 *  just "Phone". An iPad on iPadOS 13+ says "Macintosh"; touch points tell it
 *  apart from a real Mac. */
export function deviceLabel(ua: string, maxTouchPoints = 0): DeviceLabel {
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return "iPad";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android phone" : "Android tablet";
  return "Phone";
}

const TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
  svg: "image/svg+xml",
};

/** The `Content-Type` the upload is sent with, which is what `_storage`
 *  records. The file's own type, or the extension's when the browser gave
 *  none (some Android browsers do that for HEIC). */
export function uploadContentType(file: { name: string; type: string }): string {
  if (file.type) return file.type;
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase() ?? "";
  return TYPE_BY_EXTENSION[ext] ?? "application/octet-stream";
}

/** Same limits as the server (convex/transfers.ts). Checked here too, so a
 *  phone doesn't upload 80 MB just to be told it is too big. */
export const MAX_BYTES = 50 * 1024 * 1024;

/** An upload's backstop: a minute, plus time for the file at a slow 100 KB/s.
 *  A flat minute (the share snapshot's) is too short for a 30 MB photo on a
 *  phone signal. */
export function uploadTimeoutMs(bytes: number): number {
  return 60_000 + Math.ceil(bytes / 100);
}

export type SendOutcome =
  | { ok: true; bytes: number; expiresAt: number }
  | { ok: false; message: string; canceled?: boolean };

/** What `sendOne` needs from Convex: the two mutations, as plain calls. */
export interface SendDeps {
  generateUploadUrl: () => Promise<string>;
  create: (args: {
    storageId: string;
    name: string;
    fromDevice: string;
  }) => Promise<{ ok: true; bytes: number; expiresAt: number } | { ok: false; message: string }>;
  fetch?: typeof fetch;
}

/** The server's refusal text, or a short line for anything else. */
function errorText(err: unknown): string {
  // ConvexError carries the readable line in `data`.
  const data = (err as { data?: unknown })?.data;
  if (typeof data === "string") return data;
  if (err instanceof Error) {
    if (/timed out/i.test(err.message)) return "Upload timed out. Try again.";
    if (/Not authenticated/i.test(err.message)) return "Sign in to send photos to your computer.";
    return err.message;
  }
  return "Something went wrong. Try again.";
}

/**
 * Send one photo: an upload URL, the upload (canceled, not abandoned, on the
 * timer or on `signal`), then `create`. The server's answer decides; a
 * refusal comes back with its message.
 */
export async function sendOne(
  file: File,
  fromDevice: DeviceLabel,
  deps: SendDeps,
  signal?: AbortSignal,
): Promise<SendOutcome> {
  if (file.size > MAX_BYTES) {
    return { ok: false, message: `Too big: ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 50 MB a photo.` };
  }
  if (signal?.aborted) return { ok: false, message: "Canceled.", canceled: true };
  try {
    const url = await deps.generateUploadUrl();
    const abort = new AbortController();
    const onCancel = () => abort.abort();
    signal?.addEventListener("abort", onCancel);
    let resp: Response;
    try {
      resp = await withTimeout(
        (deps.fetch ?? fetch)(url, {
          method: "POST",
          headers: { "Content-Type": uploadContentType(file) },
          body: file,
          signal: abort.signal,
        }),
        uploadTimeoutMs(file.size),
        "Photo upload",
        { abort, message: "Upload timed out. Try again." },
      );
    } finally {
      signal?.removeEventListener("abort", onCancel);
    }
    if (!resp.ok) return { ok: false, message: `Upload failed (${resp.status}). Try again.` };
    const { storageId } = (await resp.json()) as { storageId: string };
    if (signal?.aborted) {
      // Landed, but the person canceled: the row is never made, and the
      // orphan sweep collects the file (ADR-083).
      return { ok: false, message: "Canceled.", canceled: true };
    }
    const result = await deps.create({ storageId, name: file.name, fromDevice });
    return result.ok ? { ok: true, bytes: result.bytes, expiresAt: result.expiresAt } : { ok: false, message: result.message };
  } catch (err) {
    if (signal?.aborted) return { ok: false, message: "Canceled.", canceled: true };
    return { ok: false, message: errorText(err) };
  }
}

/** "4 photos sent. They'll wait 7 days." / "3 of 4 sent." */
export function resultLine(sent: number, total: number): string {
  if (total === 0) return "";
  if (sent === 0) return total === 1 ? "The photo was not sent." : "No photos were sent.";
  const noun = sent === 1 ? "photo" : "photos";
  if (sent === total) return `${sent} ${noun} sent. ${sent === 1 ? "It'll" : "They'll"} wait 7 days.`;
  return `${sent} of ${total} sent. ${sent === 1 ? "It'll" : "They'll"} wait 7 days.`;
}
