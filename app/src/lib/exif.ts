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

import type { ExportFormat } from "@/lib/exportImage";

export type ExifMode = "keep" | "strip";

// All buffers we produce/consume are exact, ArrayBuffer-backed views.
type Bytes = Uint8Array<ArrayBuffer>;

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

const EXIF_ID = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"

function isJpeg(b: Bytes): boolean {
  return b.length > 3 && b[0] === 0xff && b[1] === 0xd8;
}

/**
 * Locate a JPEG's EXIF (APP1) segment — shared by `extractJpegExifTiff`
 * (read) and `stripJpegGps` (in-place GPS-only rewrite) below, the two
 * places that need to find *that one specific segment* rather than walk
 * every marker (unlike `stripJpegMetadata`, which keeps/drops each segment
 * as it goes and has its own walk for that reason).
 */
function findJpegExifSegment(b: Bytes): { tiffStart: number; segEnd: number } | null {
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

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

function isPng(b: Bytes): boolean {
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
function findPngChunk(b: Bytes, type: string): { dataStart: number; dataEnd: number } | null {
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

const ASCII = (s: string) => s.split("").map((c) => c.charCodeAt(0));

function isWebp(b: Bytes): boolean {
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

function parseWebpChunks(b: Bytes): WebpChunk[] | null {
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
function buildWebp(parts: Array<{ fourcc: string; data: Bytes }>): Bytes {
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

// ── GPS-only stripping (mode "location") ────────────────────────────────────
// Removes just the GPS sub-IFD from a raw TIFF/Exif block, in place (output
// is the same length): the IFD0 entry that points at the GPS sub-IFD is
// neutralized (tag zeroed — tag 0 is universally skipped/ignored, so no
// conformant reader, including ours, will find it), and the GPS sub-IFD's own
// entries plus any external values they reference (e.g. the lat/lon RATIONAL
// triples, 24 bytes each — too big to fit inline) are zeroed too. That erases
// the actual coordinate bytes, not just the pointer to them. Everything else
// in the block (make, model, lens, timestamp, exposure…) is untouched.
//
// KNOWN GAP: this only scrubs GPS carried in binary EXIF (the TIFF GPS IFD).
// GPS coordinates embedded in XMP (RDF/XML, e.g. `exif:GPSLatitude` inside an
// iTXt/APP1-XMP block) are NOT parsed or touched here — see ADR (metadata
// scrub) for the honest gap writeup. "all" mode is unaffected: it drops the
// whole XMP block regardless of what's inside it.
const GPS_IFD_TAG = 0x8825;

/** Zero `count` bytes at `off` in place. No-op if the range is out of bounds. */
function zeroRange(view: Uint8Array, off: number, count: number): void {
  if (off < 0 || count <= 0 || off + count > view.length) return;
  view.fill(0, off, off + count);
}

/**
 * Zero a GPS sub-IFD's own entry table (count + entries + next-IFD pointer)
 * plus any external values its entries reference (the lat/lon RATIONAL
 * triples don't fit in the inline 4-byte value slot, so they live elsewhere
 * in the buffer). No-op if `gpsPtr` isn't a well-formed in-bounds sub-IFD.
 */
function zeroGpsSubIfd(
  out: Uint8Array,
  u16: (o: number) => number,
  u32: (o: number) => number,
  gpsPtr: number,
): void {
  if (gpsPtr <= 0 || gpsPtr + 2 > out.length) return;
  const gn = u16(gpsPtr);
  const gpsEntriesStart = gpsPtr + 2;
  const gpsEntriesEnd = gpsEntriesStart + gn * 12;
  if (gpsEntriesEnd > out.length) return;

  for (let j = 0; j < gn; j++) {
    const gp = gpsEntriesStart + j * 12;
    const gSize = tiffTypeSize(u16(gp + 2)) * u32(gp + 4);
    if (gSize > 4) zeroRange(out, u32(gp + 8), gSize);
  }
  zeroRange(out, gpsPtr, 2 + gn * 12 + 4);
}

/** Strip the GPS sub-IFD from a raw TIFF/Exif block. Returns a same-length copy. */
function stripGpsFromTiff(tiff: Bytes): Bytes {
  const out = tiff.slice(); // always operate on (and return) a fresh copy
  if (out.length < 8) return out;
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const bom = dv.getUint16(0, false);
  const le = bom === 0x4949; // "II" little-endian, "MM" big-endian
  if (!le && bom !== 0x4d4d) return out; // not a TIFF header — nothing to do
  if (dv.getUint16(2, le) !== 42) return out;

  const u16 = (o: number) => dv.getUint16(o, le);
  const u32 = (o: number) => dv.getUint32(o, le);

  const ifd0Off = u32(4);
  if (ifd0Off <= 0 || ifd0Off + 2 > out.length) return out;
  const n = u16(ifd0Off);
  const entriesStart = ifd0Off + 2;
  if (entriesStart + n * 12 > out.length) return out;

  for (let i = 0; i < n; i++) {
    const p = entriesStart + i * 12;
    if (u16(p) !== GPS_IFD_TAG) continue;

    // GPSInfo is always type LONG (4) / count 1 (a single 4-byte offset that
    // fits inline in the entry's value field) — read it directly. Anything
    // else is a malformed/non-standard entry; skip it rather than guess.
    const type = u16(p + 2);
    const count = u32(p + 4);
    const gpsPtr = type === 4 && count === 1 ? u32(p + 8) : 0;
    zeroGpsSubIfd(out, u16, u32, gpsPtr);

    // Neutralize the IFD0 entry itself (tag → 0) so nothing points at GPS.
    zeroRange(out, p, 12);
    break; // GPSInfo is single-valued — only one entry to find.
  }
  return out;
}

/** Remove GPS only from a JPEG's EXIF (APP1); camera/timestamp tags survive. */
export function stripJpegGps(b: Bytes): Bytes {
  if (!isJpeg(b)) return b;
  const hit = findJpegExifSegment(b);
  if (!hit) return b.slice(); // no EXIF APP1 found — nothing to strip
  const out = b.slice();
  out.set(stripGpsFromTiff(b.slice(hit.tiffStart, hit.segEnd)), hit.tiffStart);
  return out;
}

// PNG CRC-32 (the zlib/ISO-3309 table) — only needed here: `stripPngMetadata`
// above just drops whole chunks (no recompute needed), but `stripPngGps`
// rewrites the eXIf chunk's payload in place, so its CRC must be redone.
let pngCrcTable: Uint32Array | null = null;
function pngCrc32(bytes: Uint8Array): number {
  if (!pngCrcTable) {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    pngCrcTable = t;
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = pngCrcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Remove GPS only from a PNG's eXIf chunk (if any); other chunks survive. */
export function stripPngGps(b: Bytes): Bytes {
  if (!isPng(b)) return b;
  const hit = findPngChunk(b, "eXIf");
  if (!hit) return b.slice();
  const { dataStart, dataEnd } = hit; // dataEnd == the CRC field's own offset

  const out = b.slice();
  const outDv = new DataView(out.buffer, out.byteOffset, out.byteLength);
  // Scrub exactly the chunk's data bytes — NOT the trailing CRC.
  out.set(stripGpsFromTiff(b.slice(dataStart, dataEnd)), dataStart);
  // CRC covers type(4 bytes, at dataStart-4) + data.
  outDv.setUint32(dataEnd, pngCrc32(out.subarray(dataStart - 4, dataEnd)));
  return out;
}

/** Remove GPS only from a WebP's EXIF chunk (if any); other chunks survive. */
export function stripWebpGps(b: Bytes): Bytes {
  const chunks = parseWebpChunks(b);
  if (!chunks) return b;
  const exif = chunks.find((c) => c.fourcc === "EXIF");
  if (!exif) return b.slice();
  const scrubbed = stripGpsFromTiff(b.slice(exif.dataStart, exif.dataEnd));
  const out = b.slice();
  out.set(scrubbed, exif.dataStart);
  return out;
}

/** Which tags a metadata scrub removes — see `stripMetadata`. */
export type MetadataStripMode = "all" | "location";

/**
 * Format-aware metadata scrub, auto-detected from the file's own signature
 * bytes (JPEG/PNG/WebP). This is the tested "scrub core":
 *   • 'all'      — EXIF, GPS, maker notes, embedded EXIF thumbnail, XMP, IPTC.
 *                  ICC is deliberately kept (see the DECISION note above
 *                  `stripJpegMetadata`).
 *   • 'location' — GPS tags only; camera/lens/timestamp/software survive.
 * Pixels are never touched. Unknown/unsupported formats (AVIF, GIF, …) are a
 * documented gap — returned unchanged rather than guessed at.
 */
export function stripMetadata(bytes: Bytes, mode: MetadataStripMode): Bytes {
  try {
    if (isJpeg(bytes)) return mode === "all" ? stripJpegMetadata(bytes) : stripJpegGps(bytes);
    if (isPng(bytes)) return mode === "all" ? stripPngMetadata(bytes) : stripPngGps(bytes);
    if (isWebp(bytes)) return mode === "all" ? stripWebpMetadata(bytes) : stripWebpGps(bytes);
  } catch {
    return bytes.slice(); // fail-safe — never emit a corrupt image
  }
  return bytes.slice(); // AVIF / unknown — not yet supported, logged as a gap
}

// ── High-level policy ──────────────────────────────────────────────────────

/** Pull a reusable TIFF/Exif block out of a stored original (JPEG/PNG/WebP). */
export function readExifTiff(bytes: Bytes, mime: string): Bytes | null {
  try {
    if (mime === "image/jpeg") return extractJpegExifTiff(bytes);
    if (mime === "image/webp") return extractWebpExifTiff(bytes);
    if (mime === "image/png") return extractPngExifTiff(bytes);
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Apply the EXIF policy to a *re-encoded* export (pixels → format). Re-encoded
 * bytes never carry the source EXIF, so STRIP is a no-op; KEEP transplants the
 * supplied source TIFF where the target format supports it (JPEG/WebP).
 */
export function applyExifToReencoded(
  encoded: Bytes,
  format: ExportFormat,
  mode: ExifMode,
  sourceTiff: Bytes | null,
  width: number,
  height: number,
): Bytes {
  if (mode === "strip" || !sourceTiff) return encoded;
  try {
    if (format === "jpeg") return injectJpegExif(encoded, sourceTiff);
    if (format === "webp") return injectWebpExif(encoded, sourceTiff, width, height);
  } catch {
    /* fall through — never corrupt the export */
  }
  return encoded; // png / avif can't carry standard EXIF
}

/**
 * Apply the EXIF policy to a *verbatim* original being exported as-is.
 * `stripMode` (default 'all', matching the pre-existing behavior exactly)
 * only matters when `mode === "strip"`: 'all' is the original full scrub,
 * 'location' is the newer GPS-only scrub (Settings → Security).
 */
export function applyExifToVerbatim(
  bytes: Bytes,
  mime: string,
  mode: ExifMode,
  stripMode: MetadataStripMode = "all",
): Bytes {
  if (mode === "keep") return bytes;
  if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp") {
    return stripMetadata(bytes, stripMode);
  }
  return bytes; // avif / unknown — left as-is
}

// ── EXIF reading (for display) ─────────────────────────────────────────────
// A minimal TIFF/EXIF tag reader over the raw block from readExifTiff(). Enough
// to populate the Diagnostics "Current Image Meta" tab: camera, lens, capture
// time, exposure, and GPS. Not a full parser — unknown tags are ignored.

export interface ExifSummary {
  make?: string;
  model?: string;
  lens?: string;
  software?: string;
  /** Capture time, normalized to "YYYY-MM-DD HH:MM". */
  dateTaken?: string;
  orientation?: number;
  iso?: number;
  /** e.g. "1/250s". */
  exposure?: string;
  /** e.g. "f/2.8". */
  fNumber?: string;
  /** e.g. "50mm". */
  focalLength?: string;
  /** Decimal degrees. */
  gps?: { lat: number; lon: number };
}

interface TiffEntry {
  tag: number;
  type: number;
  count: number;
  valueAt: number; // offset of the 4-byte value/pointer field
}

function tiffTypeSize(t: number): number {
  switch (t) {
    case 1: case 2: case 6: case 7: return 1;
    case 3: case 8: return 2;
    case 4: case 9: case 11: return 4;
    case 5: case 10: case 12: return 8;
    default: return 1;
  }
}

function normalizeExifDate(s: string): string {
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` : s.trim();
}

function parseExifTiff(tiff: Bytes): ExifSummary | null {
  if (tiff.length < 8) return null;
  const dv = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const bom = dv.getUint16(0, false);
  const le = bom === 0x4949; // "II" little-endian, "MM" big-endian
  if (!le && bom !== 0x4d4d) return null;
  if (dv.getUint16(2, le) !== 42) return null;

  const u16 = (o: number) => dv.getUint16(o, le);
  const u32 = (o: number) => dv.getUint32(o, le);
  const s32 = (o: number) => dv.getInt32(o, le);

  const readIfd = (off: number): Map<number, TiffEntry> => {
    const m = new Map<number, TiffEntry>();
    if (off <= 0 || off + 2 > tiff.length) return m;
    const n = u16(off);
    let p = off + 2;
    for (let i = 0; i < n && p + 12 <= tiff.length; i++, p += 12) {
      m.set(u16(p), { tag: u16(p), type: u16(p + 2), count: u32(p + 4), valueAt: p + 8 });
    }
    return m;
  };

  const dataAt = (e: TiffEntry): number =>
    tiffTypeSize(e.type) * e.count <= 4 ? e.valueAt : u32(e.valueAt);

  const asStr = (e?: TiffEntry): string | undefined => {
    if (!e || e.type !== 2) return undefined;
    const off = dataAt(e);
    if (off + e.count > tiff.length) return undefined;
    let s = "";
    for (let i = 0; i < e.count; i++) {
      const c = tiff[off + i];
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s.trim() || undefined;
  };

  const asNum = (e?: TiffEntry): number | undefined => {
    if (!e) return undefined;
    const o = dataAt(e);
    switch (e.type) {
      case 3: return u16(o);
      case 4: return u32(o);
      case 9: return s32(o);
      case 5: { const d = u32(o + 4); return d ? u32(o) / d : undefined; }
      case 10: { const d = s32(o + 4); return d ? s32(o) / d : undefined; }
      default: return undefined;
    }
  };

  const triple = (e?: TiffEntry): number[] | undefined => {
    if (!e || (e.type !== 5 && e.type !== 10) || e.count < 3) return undefined;
    const o = dataAt(e);
    if (o + 24 > tiff.length) return undefined;
    const out: number[] = [];
    for (let i = 0; i < 3; i++) {
      const num = e.type === 5 ? u32(o + i * 8) : s32(o + i * 8);
      const den = e.type === 5 ? u32(o + i * 8 + 4) : s32(o + i * 8 + 4);
      out.push(den ? num / den : 0);
    }
    return out;
  };

  const ifd0 = readIfd(u32(4));
  const out: ExifSummary = {};
  out.make = asStr(ifd0.get(0x010f));
  out.model = asStr(ifd0.get(0x0110));
  out.software = asStr(ifd0.get(0x0131));
  const orient = asNum(ifd0.get(0x0112));
  if (orient) out.orientation = orient;
  let dt = asStr(ifd0.get(0x0132));

  const exifPtr = asNum(ifd0.get(0x8769));
  if (exifPtr) {
    const ex = readIfd(exifPtr);
    const dto = asStr(ex.get(0x9003)); // DateTimeOriginal
    if (dto) dt = dto;
    out.lens = asStr(ex.get(0xa434));
    const iso = asNum(ex.get(0x8827));
    if (iso) out.iso = Math.round(iso);
    const exp = asNum(ex.get(0x829a)); // ExposureTime
    if (exp) out.exposure = exp >= 1 ? `${exp}s` : `1/${Math.round(1 / exp)}s`;
    const fn = asNum(ex.get(0x829d)); // FNumber
    if (fn) out.fNumber = `f/${fn.toFixed(1).replace(/\.0$/, "")}`;
    const fl = asNum(ex.get(0x920a)); // FocalLength
    if (fl) out.focalLength = `${Math.round(fl)}mm`;
  }
  if (dt) out.dateTaken = normalizeExifDate(dt);

  const gpsPtr = asNum(ifd0.get(0x8825));
  if (gpsPtr) {
    const g = readIfd(gpsPtr);
    const lat = triple(g.get(0x0002));
    const lon = triple(g.get(0x0004));
    if (lat && lon) {
      let latD = lat[0] + lat[1] / 60 + lat[2] / 3600;
      let lonD = lon[0] + lon[1] / 60 + lon[2] / 3600;
      if (asStr(g.get(0x0001)) === "S") latD = -latD;
      if (asStr(g.get(0x0003)) === "W") lonD = -lonD;
      out.gps = { lat: latD, lon: lonD };
    }
  }

  return Object.keys(out).length > 0 ? out : null;
}

/** Parse a human-readable EXIF summary from a stored original (JPEG/WebP). */
export function parseExifFromImage(bytes: Bytes, mime: string): ExifSummary | null {
  try {
    const tiff = readExifTiff(bytes, mime);
    return tiff ? parseExifTiff(tiff) : null;
  } catch {
    return null;
  }
}
