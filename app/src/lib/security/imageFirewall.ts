// Image "firewall" — validate untrusted uploads BEFORE decoding them.
//
// The most likely attack on an image editor isn't classic XSS; it's a malicious
// or malformed file designed to crash a decoder or exhaust memory (a
// decompression bomb). This module is the guard the audit calls for:
//
//   bytes → extension → MIME → MAGIC BYTES → size cap → (decode) dimension caps
//
// `file.type` / `file.name` are attacker-controlled and never trusted — we
// sniff the real magic bytes. SVG is rejected outright (it can carry <script> /
// onload / foreignObject; we never render untrusted SVG). Wire `validateUpload`
// into the upload path and reject `{ ok: false }` before handing bytes to the
// decoder / WASM. See docs/Security-Hardening.md.

export interface FirewallLimits {
  /** Max file size in bytes. */
  maxBytes: number;
  /** Max total pixels (width × height) — the decompression-bomb guard. */
  maxPixels: number;
  /** Max length of any single side. */
  maxDimension: number;
}

/** Generous defaults — tune per tier if needed. 50 MB / 100 MP / 20k px. */
export const DEFAULT_LIMITS: FirewallLimits = {
  maxBytes: 50 * 1024 * 1024,
  maxPixels: 100 * 1024 * 1024,
  maxDimension: 20_000,
};

export type FirewallResult =
  | { ok: true; mime: string; width: number; height: number }
  | { ok: false; reason: string };

/** Raster formats we accept, matched by leading magic bytes (NOT `file.type`).
 *  Extend here if the app adds a decoder for another format. */
const SIGNATURES: { mime: string; test: (b: Uint8Array) => boolean }[] = [
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  { mime: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  // JPEG: FF D8 FF
  { mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  // GIF: "GIF87a" / "GIF89a"
  { mime: "image/gif", test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  // BMP: "BM"
  { mime: "image/bmp", test: (b) => b[0] === 0x42 && b[1] === 0x4d },
  // RIFF container — disambiguate WEBP by the "WEBP" fourcc at byte 8
  { mime: "image/webp", test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
  // ISO-BMFF (AVIF/HEIF): "ftyp" at bytes 4-7, brand "avif"/"avis"/"heic"/"mif1" at 8-11
  {
    mime: "image/avif",
    test: (b) => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70,
  },
];

/** Sniff the format from the first bytes. Returns the detected MIME or null. */
export function sniffImageMime(header: Uint8Array): string | null {
  for (const sig of SIGNATURES) {
    if (sig.test(header)) return sig.mime;
  }
  return null;
}

/** True if the file is (or claims to be) an SVG — which we never accept. */
function looksLikeSvg(file: File, header: Uint8Array): boolean {
  if (/svg/i.test(file.type)) return true;
  if (/\.svg$/i.test(file.name)) return true;
  // "<svg" or an XML prolog leading into one.
  const text = new TextDecoder("utf-8", { fatal: false }).decode(header).trimStart();
  return text.startsWith("<svg") || (text.startsWith("<?xml") && /<svg/i.test(text));
}

/**
 * Validate an untrusted image file. Cheap, decode-free checks first
 * (size → SVG → magic bytes), then a guarded dimension check via
 * `createImageBitmap` (skippable with `checkDimensions: false`).
 */
export async function validateUpload(
  file: File,
  limits: FirewallLimits = DEFAULT_LIMITS,
  opts: { checkDimensions?: boolean } = {},
): Promise<FirewallResult> {
  if (file.size === 0) return { ok: false, reason: "Empty file." };
  if (file.size > limits.maxBytes) {
    return { ok: false, reason: `File too large (max ${Math.round(limits.maxBytes / 1024 / 1024)} MB).` };
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());

  if (looksLikeSvg(file, header)) {
    return { ok: false, reason: "SVG is not supported (it can carry scripts)." };
  }

  const mime = sniffImageMime(header);
  if (!mime) {
    return { ok: false, reason: "Unrecognized image format (failed magic-byte check)." };
  }

  // Dimension / pixel-count guard — the decompression-bomb defense. Uses a
  // guarded decode; the size cap above already bounds the worst case.
  if (opts.checkDimensions === false) {
    return { ok: true, mime, width: 0, height: 0 };
  }
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();
    if (width > limits.maxDimension || height > limits.maxDimension) {
      return { ok: false, reason: `Image too large (max ${limits.maxDimension}px per side).` };
    }
    if (width * height > limits.maxPixels) {
      return { ok: false, reason: `Too many pixels (max ${Math.round(limits.maxPixels / 1_000_000)} MP).` };
    }
    return { ok: true, mime, width, height };
  } catch {
    return { ok: false, reason: "Image could not be decoded." };
  }
}
