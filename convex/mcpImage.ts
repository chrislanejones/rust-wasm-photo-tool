import { ConvexError } from "convex/values";

// ── Getting an image for send_image_to_inbox (ADR-095) ────────────────────────
//
// THE URL IS CHOSEN BY THE AI APP, so this server must not fetch whatever it
// names. https on the default port, no credentials in the URL, no IP literals,
// no internal-looking names, and every redirect is checked by the same rule.
// Convex can't resolve DNS first, so a public name pointing at a private address
// is not caught here: the deployment's network is the backstop for that.

/** Below Transfer's 50 MB: an HTTP action has 64 MiB of memory, and the
 *  download is held twice for a moment (its chunks, then the joined copy). */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
/** A Convex HTTP request tops out near 20 MB, and base64 is a third bigger. */
export const MAX_BASE64_CHARS = 20 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 20_000;

const TOO_BIG = "That image is over the 20 MB limit for a URL.";

export function checkImageUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConvexError("That isn't a valid URL.");
  }
  // One trailing root dot is legal ("localhost.") and would dodge the checks.
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const allowed =
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    (url.port === "" || url.port === "443") &&
    host.includes(".") &&
    !host.startsWith("[") &&
    !/^[\d.]+$/.test(host) &&
    !/(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/.test(host);
  if (!allowed) throw new ConvexError("That address can't be fetched. Use a public https:// image URL, or send the image as base64.");
  return url;
}

async function readCapped(response: Response): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_IMAGE_BYTES) throw new ConvexError(TOO_BIG);
  if (!response.body) throw new ConvexError("That URL returned nothing.");

  // The header is the sender's word. The count below is the limit.
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new ConvexError(TOO_BIG);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes;
}

export async function fetchImage(raw: string): Promise<Uint8Array<ArrayBuffer>> {
  let url = checkImageUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const response = await fetch(url.href, { redirect: "manual", signal: controller.signal });
      if (response.status >= 300 && response.status < 400) {
        const next = response.headers.get("location");
        if (!next) break;
        url = checkImageUrl(new URL(next, url).href);
        continue;
      }
      if (!response.ok) throw new ConvexError(`That URL answered ${response.status}.`);
      return await readCapped(response);
    }
    throw new ConvexError("That URL redirected too many times.");
  } catch (error) {
    if (error instanceof ConvexError) throw error;
    throw new ConvexError("That URL couldn't be fetched.");
  } finally {
    clearTimeout(timer);
  }
}

export function decodeBase64Image(raw: string): Uint8Array<ArrayBuffer> {
  const data = raw.replace(/^data:[^,]*,/, "").replace(/\s/g, "");
  if (data.length > MAX_BASE64_CHARS) {
    throw new ConvexError("That image is too big to send as base64 (about 15 MB at most). Send a public https:// URL instead.");
  }
  let binary: string;
  try {
    binary = atob(data);
  } catch {
    throw new ConvexError("That isn't valid base64.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const ascii = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));

/** What the bytes actually are, with its extension, or null. The sender's word
 *  isn't asked. SVG is refused here: it's text that can carry script, and there
 *  is no signature to recognize. */
export function sniffImage(bytes: Uint8Array): { mime: string; ext: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === "PNG") return { mime: "image/png", ext: "png" };
  if (ascii(bytes, 0, 4) === "GIF8") return { mime: "image/gif", ext: "gif" };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12);
    if (brand === "avif" || brand === "avis") return { mime: "image/avif", ext: "avif" };
    if (["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(brand)) return { mime: "image/heic", ext: "heic" };
  }
  return null;
}

/** The stored name always ends in what the bytes are. */
export function imageFileName(raw: string | undefined, ext: string): string {
  const base = (raw ?? "").split(/[\\/]/).pop()!.trim().replace(/\.[a-z0-9]{1,5}$/i, "") || "Image";
  return `${base.slice(0, 190)}.${ext}`;
}

/** The Inbox's "from" line. An app's own name is only ever shown marked as an
 *  AI app, so it can't pass for one of the user's phones. */
export function senderLabel(raw: string | undefined): string {
  const name = (raw ?? "").replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 40);
  return name ? `${name} (AI app)` : "AI app";
}
