// app/src/lib/exif/index.ts — export policy and EXIF reading. The public surface.
//
// Split out of the single 746-line lib/exif.ts. The public entry point is
// still `@/lib/exif` (this directory's index.ts), so no caller changed.

import {
  Bytes,
  ExifMode,
  extractJpegExifTiff,
  extractPngExifTiff,
  extractWebpExifTiff,
  injectJpegExif,
  injectWebpExif,
  isJpeg,
  isPng,
  isWebp,
  stripJpegMetadata,
  stripPngMetadata,
  stripWebpMetadata,
  tiffTypeSize,
} from "./codecs";
import type { ExportFormat } from "@/lib/exportImage";
import { stripJpegGps, stripPngGps, stripWebpGps } from "./gps";

// `extractWebpExifTiff` was a public export of the original single-file module
// and moved into ./codecs with the rest of the WebP surgery. Re-exported here so
// `@/lib/exif` keeps the exact surface it had — dropping it silently broke two
// tests, which is the only reason this line is not an oversight twice.
export { extractWebpExifTiff } from "./codecs";

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

