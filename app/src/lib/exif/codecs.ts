// app/src/lib/exif/codecs.ts — byte-level surgery for JPEG, PNG and WebP.
//
// Split out of the single 746-line lib/exif.ts. The public entry point is
// still `@/lib/exif` (this directory's index.ts), so no caller changed.

// app/src/lib/exif.ts
//
// Dependency-free EXIF / metadata muxing for the export pipeline.
//
// The export "padlock" (Compress tab) lets the user either KEEP or STRIP photo
// metadata at export time:
//   • KEEP  — verbatim originals pass through untouched, and a freshly
//             re-encoded JPEG/WebP gets the source's EXIF transplanted back in.
//   • STRIP — EXIF/XMP/IPTC are removed from any JPEG/WebP/PNG so no GPS,
//             camera, or timestamp data leaks out.
//
// Re-encoded pixels (canvas edits, compression) never carry the source's EXIF
// to begin with, so STRIP on that path is a no-op and KEEP must re-inject.
//
// PNG and AVIF can't carry standard EXIF in a way common viewers read, so KEEP
// leaves them clean. Every operation is best-effort and FAIL-SAFE: on any parse
// error we return the input unchanged (KEEP) rather than emit a corrupt image.


export type ExifMode = "keep" | "strip";

// All buffers we produce/consume are exact, ArrayBuffer-backed views.
export type Bytes = Uint8Array<ArrayBuffer>;

/** Concatenate a set of [start,end) byte ranges from `b` into a fresh array. */
function concatRanges(b: Bytes, ranges: Array<[number, number]>): Bytes {
  let total = 0;
  for (const [s, e] of ranges) total += e - s;
  const out = new Uint8Array(total);
  let o = 0;
  for (const [s, e] of ranges) {
    out.set(b.subarray(s, e), o);
    o += e - s;
  }
  return out;
}

// ── JPEG ─────────────────────────────────────────────────────────────────
// SOI (FFD8) then marker segments. APPn = FFE0..FFEF, each followed by a
// 2-byte big-endian length (which counts itself). EXIF lives in APP1 (FFE1)
// behind an "Exif\0\0" identifier; XMP also rides APP1; IPTC/Photoshop is APP13
// (FFED). SOS (FFDA) begins the compressed scan — no metadata after it.

export const EXIF_ID = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"

export function isJpeg(b: Bytes): boolean {
  return b.length > 3 && b[0] === 0xff && b[1] === 0xd8;
}

/**
 * Locate a JPEG's EXIF (APP1) segment — shared by `extractJpegExifTiff`
 * (read) and `stripJpegGps` (in-place GPS-only rewrite) below, the two
 * places that need to find *that one specific segment* rather than walk
 * every marker (unlike `stripJpegMetadata`, which keeps/drops each segment
 * as it goes and has its own walk for that reason).
 */
export function findJpegExifSegment(b: Bytes): { tiffStart: number; segEnd: number } | null {
  let pos = 2;
  while (pos + 4 <= b.length) {
    if (b[pos] !== 0xff) return null;
    const marker = b[pos + 1];
    if (marker === 0xda || marker === 0xd9) return null; // SOS / EOI — no more markers
    if (marker >= 0xd0 && marker <= 0xd7) {
      pos += 2;
      continue;
    }
    const len = (b[pos + 2] << 8) | b[pos + 3];
    if (len < 2) return null;
    const segStart = pos + 4;
    const segEnd = pos + 2 + len;
    if (segEnd > b.length) return null;
    if (marker === 0xe1 && EXIF_ID.every((v, i) => b[segStart + i] === v)) {
      return { tiffStart: segStart + EXIF_ID.length, segEnd };
    }
    pos = segEnd;
  }
  return null;
}

/** Raw TIFF/Exif block (bytes after "Exif\0\0") from a JPEG, or null. */
export function extractJpegExifTiff(b: Bytes): Bytes | null {
  if (!isJpeg(b)) return null;
  const hit = findJpegExifSegment(b);
  return hit ? b.slice(hit.tiffStart, hit.segEnd) : null;
}

// DECISION (2026-07-10, mode "all"): the ICC color profile (JPEG APP2 /
// PNG iCCP) is deliberately KEPT even under a full "strip everything" pass —
// only EXIF/GPS/maker-notes/embedded-thumbnail (APP1) and IPTC (APP13) are
// dropped. A generic embedded ICC profile is not personally identifying (it
// describes a color space, not the photographer), while dropping it can
// visibly shift rendered colors in downstream viewers that don't assume
// sRGB. Trade-off: a bespoke/rare ICC profile is a (very weak) device
// fingerprint, so a future "paranoid" mode could still offer ICC-strip as an
// opt-in — not implemented here.

/** Drop EXIF/XMP (APP1) and IPTC/Photoshop (APP13); keep JFIF + ICC + image. */
export function stripJpegMetadata(b: Bytes): Bytes {
  if (!isJpeg(b)) return b;
  const keep: Array<[number, number]> = [[0, 2]]; // SOI
  let pos = 2;
  while (pos + 4 <= b.length) {
    if (b[pos] !== 0xff) {
      keep.push([pos, b.length]);
      return concatRanges(b, keep);
    }
    const marker = b[pos + 1];
    if (marker === 0xda) {
      // SOS — keep the entire remaining scan data verbatim.
      keep.push([pos, b.length]);
      return concatRanges(b, keep);
    }
    if (marker === 0xd9) {
      keep.push([pos, pos + 2]);
      break;
    }
    if (marker >= 0xd0 && marker <= 0xd7) {
      keep.push([pos, pos + 2]);
      pos += 2;
      continue;
    }
    const len = (b[pos + 2] << 8) | b[pos + 3];
    const segEnd = pos + 2 + len;
    if (len < 2 || segEnd > b.length) {
      keep.push([pos, b.length]);
      return concatRanges(b, keep);
    }
    const drop = marker === 0xe1 || marker === 0xed; // APP1 (EXIF/XMP), APP13
    if (!drop) keep.push([pos, segEnd]);
    pos = segEnd;
  }
  return concatRanges(b, keep);
}

/** Insert an EXIF APP1 segment (built from a TIFF block) right after SOI. */
export function injectJpegExif(jpeg: Bytes, tiff: Bytes): Bytes {
  if (!isJpeg(jpeg)) return jpeg;
  const clean = stripJpegMetadata(jpeg); // avoid duplicate EXIF/XMP
  const segLen = 2 + EXIF_ID.length + tiff.length; // length field counts itself
  if (segLen > 0xffff) return clean; // too big for one APP1 (rare) — skip
  const app1 = new Uint8Array(2 + segLen);
  app1[0] = 0xff;
  app1[1] = 0xe1;
  app1[2] = (segLen >> 8) & 0xff;
  app1[3] = segLen & 0xff;
  app1.set(EXIF_ID, 4);
  app1.set(tiff, 4 + EXIF_ID.length);
  const out = new Uint8Array(clean.length + app1.length);
  out.set(clean.subarray(0, 2), 0);
  out.set(app1, 2);
  out.set(clean.subarray(2), 2 + app1.length);
  return out;
}

// ── PNG ──────────────────────────────────────────────────────────────────
// 8-byte signature then length(4 BE) + type(4) + data + crc(4) chunks.

export const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

export function isPng(b: Bytes): boolean {
  return b.length > 8 && PNG_SIG.every((v, i) => b[i] === v);
}

/**
 * Locate a PNG chunk of `type` (after the 8-byte signature) — shared by the
 * two eXIf-only readers/rewriters below (`extractPngExifTiff`, `stripPngGps`)
 * so the chunk-walk isn't duplicated between them. `stripPngMetadata` above
 * has its own walk: it needs every chunk's bounds (to keep or drop each one),
 * not just one match, and a different truncated-tail fallback, so it isn't a
 * good fit for this same helper.
 */
export function findPngChunk(b: Bytes, type: string): { dataStart: number; dataEnd: number } | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let pos = 8;
  while (pos + 12 <= b.length) {
    const len = dv.getUint32(pos);
    const t = String.fromCharCode(b[pos + 4], b[pos + 5], b[pos + 6], b[pos + 7]);
    const dataStart = pos + 8;
    const dataEnd = dataStart + len;
    const end = dataEnd + 4; // + CRC
    if (end > b.length) return null;
    if (t === type) return { dataStart, dataEnd };
    if (t === "IEND") return null;
    pos = end;
  }
  return null;
}

/** Raw TIFF/Exif block from a PNG's eXIf chunk, or null. Unlike JPEG's APP1,
 *  a PNG eXIf chunk holds the raw TIFF directly — no "Exif\0\0" prefix. */
export function extractPngExifTiff(b: Bytes): Bytes | null {
  if (!isPng(b)) return null;
  const hit = findPngChunk(b, "eXIf");
  return hit ? b.slice(hit.dataStart, hit.dataEnd) : null;
}

/** Drop textual/EXIF/time chunks from a PNG (eXIf, tEXt, zTXt, iTXt, tIME). */
export function stripPngMetadata(b: Bytes): Bytes {
  if (!isPng(b)) return b;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const drop = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
  const keep: Array<[number, number]> = [[0, 8]];
  let pos = 8;
  while (pos + 12 <= b.length) {
    const len = dv.getUint32(pos);
    const type = String.fromCharCode(b[pos + 4], b[pos + 5], b[pos + 6], b[pos + 7]);
    const end = pos + 12 + len;
    if (end > b.length) {
      keep.push([pos, b.length]);
      break;
    }
    if (!drop.has(type)) keep.push([pos, end]);
    pos = end;
    if (type === "IEND") break;
  }
  return concatRanges(b, keep);
}

// ── WebP ─────────────────────────────────────────────────────────────────
// RIFF: "RIFF" size(4 LE) "WEBP" then FourCC(4) size(4 LE) data pad(→even)
// chunks. EXIF lives in an "EXIF" chunk (raw TIFF), XMP in "XMP ". The
// extended container "VP8X" carries a flags byte; EXIF=0x08, XMP=0x04,
// alpha=0x10. Simple "VP8 "/"VP8L" files must be upgraded to VP8X to hold EXIF.

export const ASCII = (s: string) => s.split("").map((c) => c.charCodeAt(0));

export function isWebp(b: Bytes): boolean {
  return (
    b.length > 16 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  );
}

interface WebpChunk {
  fourcc: string;
  start: number; // offset of the FourCC
  dataStart: number;
  dataEnd: number; // exclusive, excludes pad
  next: number; // offset of the following chunk (includes pad)
}

export function parseWebpChunks(b: Bytes): WebpChunk[] | null {
  if (!isWebp(b)) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const chunks: WebpChunk[] = [];
  let pos = 12;
  while (pos + 8 <= b.length) {
    const fourcc = String.fromCharCode(b[pos], b[pos + 1], b[pos + 2], b[pos + 3]);
    const size = dv.getUint32(pos + 4, true);
    const dataStart = pos + 8;
    const dataEnd = dataStart + size;
    if (dataEnd > b.length) return null;
    const next = dataEnd + (size & 1); // chunks are padded to even length
    chunks.push({ fourcc, start: pos, dataStart, dataEnd, next });
    pos = next;
  }
  return chunks;
}

/** Reassemble a WebP RIFF container from a list of chunk byte-payloads. */
export function buildWebp(parts: Array<{ fourcc: string; data: Bytes }>): Bytes {
  let body = 4; // "WEBP"
  for (const p of parts) body += 8 + p.data.length + (p.data.length & 1);
  const out = new Uint8Array(8 + body);
  out.set(ASCII("RIFF"), 0);
  new DataView(out.buffer).setUint32(4, body, true);
  out.set(ASCII("WEBP"), 8);
  let o = 12;
  const dv = new DataView(out.buffer);
  for (const p of parts) {
    out.set(ASCII(p.fourcc), o);
    dv.setUint32(o + 4, p.data.length, true);
    out.set(p.data, o + 8);
    o += 8 + p.data.length;
    if (p.data.length & 1) out[o++] = 0; // pad byte
  }
  return out;
}

/** Raw TIFF/Exif block from a WebP's EXIF chunk, or null. */
export function extractWebpExifTiff(b: Bytes): Bytes | null {
  const chunks = parseWebpChunks(b);
  if (!chunks) return null;
  const exif = chunks.find((c) => c.fourcc === "EXIF");
  return exif ? b.slice(exif.dataStart, exif.dataEnd) : null;
}

/** Drop EXIF + XMP chunks and clear their VP8X flag bits. */
export function stripWebpMetadata(b: Bytes): Bytes {
  const chunks = parseWebpChunks(b);
  if (!chunks) return b;
  const parts = chunks
    .filter((c) => c.fourcc !== "EXIF" && c.fourcc !== "XMP ")
    .map((c) => {
      const data = b.slice(c.dataStart, c.dataEnd);
      if (c.fourcc === "VP8X" && data.length >= 1) data[0] &= ~0x0c; // clear EXIF|XMP
      return { fourcc: c.fourcc, data };
    });
  return buildWebp(parts);
}

/** Read the alpha flag from a VP8L bitstream (lossless). */
function vp8lHasAlpha(data: Bytes): boolean {
  // 1 signature byte (0x2f), then 14b width-1, 14b height-1, then alpha bit.
  if (data.length < 5 || data[0] !== 0x2f) return false;
  const bits = data[1] | (data[2] << 8) | (data[3] << 16) | (data[4] << 24);
  return ((bits >>> 28) & 1) === 1; // bit after the two 14-bit dimensions
}

/** Inject EXIF into a (typically simple) WebP, upgrading to VP8X as needed. */
export function injectWebpExif(
  b: Bytes,
  tiff: Bytes,
  width: number,
  height: number,
): Bytes {
  const chunks = parseWebpChunks(b);
  if (!chunks) return b;

  const existingVp8x = chunks.find((c) => c.fourcc === "VP8X");
  const bitstream = chunks.find((c) => c.fourcc === "VP8 " || c.fourcc === "VP8L");

  const parts: Array<{ fourcc: string; data: Bytes }> = [];
  if (existingVp8x) {
    // Already extended: keep all chunks (sans old EXIF), set the EXIF flag.
    for (const c of chunks) {
      if (c.fourcc === "EXIF") continue;
      const data = b.slice(c.dataStart, c.dataEnd);
      if (c.fourcc === "VP8X" && data.length >= 1) data[0] |= 0x08; // EXIF flag
      parts.push({ fourcc: c.fourcc, data });
    }
  } else {
    if (!bitstream || width <= 0 || height <= 0) return b;
    let flags = 0x08; // EXIF
    if (
      bitstream.fourcc === "VP8L" &&
      vp8lHasAlpha(b.slice(bitstream.dataStart, bitstream.dataEnd))
    ) {
      flags |= 0x10; // alpha
    }
    const vp8x = new Uint8Array(10);
    vp8x[0] = flags;
    const w = width - 1;
    const h = height - 1;
    vp8x[4] = w & 0xff; vp8x[5] = (w >> 8) & 0xff; vp8x[6] = (w >> 16) & 0xff;
    vp8x[7] = h & 0xff; vp8x[8] = (h >> 8) & 0xff; vp8x[9] = (h >> 16) & 0xff;
    parts.push({ fourcc: "VP8X", data: vp8x });
    for (const c of chunks) {
      if (c.fourcc === "EXIF") continue;
      parts.push({ fourcc: c.fourcc, data: b.slice(c.dataStart, c.dataEnd) });
    }
  }
  // EXIF chunk goes last (after the image data), per the WebP container spec.
  parts.push({ fourcc: "EXIF", data: tiff });
  return buildWebp(parts);
}

/** Byte width of a TIFF field type. Shared: the GPS scrubber walks the same
 *  IFD structure the reader does, so this lives beside the format helpers
 *  rather than in either caller. */
export function tiffTypeSize(t: number): number {
  switch (t) {
    case 1: case 2: case 6: case 7: return 1;
    case 3: case 8: return 2;
    case 4: case 9: case 11: return 4;
    case 5: case 10: case 12: return 8;
    default: return 1;
  }
}
