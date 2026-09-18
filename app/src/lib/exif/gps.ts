// app/src/lib/exif/gps.ts — GPS-only stripping (metadata mode "location").
//
// Split out of the single 746-line lib/exif.ts. The public entry point is
// still `@/lib/exif` (this directory's index.ts), so no caller changed.

import {
  Bytes,
  findJpegExifSegment,
  findPngChunk,
  isJpeg,
  isPng,
  parseWebpChunks,
  tiffTypeSize,
} from "./codecs";

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
