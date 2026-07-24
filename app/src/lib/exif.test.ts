// Task B — metadata scrub core. Fixtures are built here from scratch (not via
// the production code under test) so the tests actually prove something: a
// TIFF/JPEG/PNG/WebP writer independent of `lib/exif.ts`'s own reader/writer
// logic, feeding real EXIF+GPS bytes through `stripMetadata` and back out
// through the production reader (`parseExifFromImage`).
//
// PIXEL-INTEGRITY NOTE: this suite runs under vitest's "node" environment
// (see vitest.config.ts) — there's no `OffscreenCanvas`/`createImageBitmap`
// here to actually decode a JPEG/PNG and hash the resulting pixels the way a
// browser test could. Instead we assert something strictly stronger: the
// scrubbers never touch the compressed pixel region at all (JPEG SOS→EOF,
// PNG IDAT) — proven by exact byte-identity of that region before/after
// every strip — which guarantees "decode both, compare a pixel hash" would
// pass, without needing an image codec in the test harness.
import { describe, expect, it } from "vitest";
import zlib from "node:zlib";
import {
  stripMetadata,
  parseExifFromImage,
  extractWebpExifTiff,
  type MetadataStripMode,
} from "@/lib/exif";

// ── A tiny, independent TIFF/Exif writer (test-only) ────────────────────────

type TiffType = 2 | 3 | 4 | 5; // ASCII, SHORT, LONG, RATIONAL
interface RawEntry {
  tag: number;
  type: TiffType;
  count: number;
  data: Uint8Array; // pre-encoded element bytes, length === element size * count
}

function asciiEntry(tag: number, s: string): RawEntry {
  const bytes = new Uint8Array(s.length + 1); // trailing NUL
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return { tag, type: 2, count: bytes.length, data: bytes };
}
function longEntry(tag: number, v: number): RawEntry {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, v, true);
  return { tag, type: 4, count: 1, data: b };
}
function rationalEntry(tag: number, pairs: Array<[number, number]>): RawEntry {
  const b = new Uint8Array(8 * pairs.length);
  const dv = new DataView(b.buffer);
  pairs.forEach(([n, d], i) => {
    dv.setUint32(i * 8, n, true);
    dv.setUint32(i * 8 + 4, d, true);
  });
  return { tag, type: 5, count: pairs.length, data: b };
}

/** Lay out one IFD (entries sorted by tag) at `baseOffset` within the final
 *  TIFF buffer: the fixed count+entry-table+next-IFD-pointer part, plus any
 *  external (>4 byte) value data (RATIONAL arrays, longer ASCII strings)
 *  appended after it, addressed by absolute offset per the TIFF spec. */
function layoutIfd(baseOffset: number, entries: RawEntry[]): Uint8Array {
  const sorted = [...entries].sort((a, b) => a.tag - b.tag);
  const fixedLen = 2 + sorted.length * 12 + 4; // count + entries + next-IFD ptr
  let dataOffset = fixedLen;
  const out = new Uint8Array(
    fixedLen + sorted.reduce((n, e) => n + (e.data.length > 4 ? e.data.length : 0), 0),
  );
  const dv = new DataView(out.buffer);
  dv.setUint16(0, sorted.length, true);
  sorted.forEach((e, i) => {
    const p = 2 + i * 12;
    dv.setUint16(p, e.tag, true);
    dv.setUint16(p + 2, e.type, true);
    dv.setUint32(p + 4, e.count, true);
    if (e.data.length <= 4) {
      out.set(e.data, p + 8);
    } else {
      dv.setUint32(p + 8, baseOffset + dataOffset, true);
      out.set(e.data, dataOffset);
      dataOffset += e.data.length;
    }
  });
  dv.setUint32(fixedLen - 4, 0, true); // next-IFD offset = 0 (none)
  return out;
}

function patchLong(buf: Uint8Array, tag: number, value: number): void {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const n = dv.getUint16(0, true);
  for (let i = 0; i < n; i++) {
    const p = 2 + i * 12;
    if (dv.getUint16(p, true) === tag) {
      dv.setUint32(p + 8, value, true);
      return;
    }
  }
  throw new Error(`patchLong: tag 0x${tag.toString(16)} not found`);
}

const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_LENS = 0xa434;

/** Build a full little-endian TIFF/Exif block with camera + GPS tags. */
function buildExifTiff(): Uint8Array {
  // IFD0 at offset 8 (right after the 8-byte header).
  const ifd0Entries = [
    asciiEntry(TAG_MAKE, "TestCam"),
    asciiEntry(TAG_MODEL, "Model X"),
    longEntry(TAG_EXIF_IFD, 0), // patched below
    longEntry(TAG_GPS_IFD, 0), // patched below
  ];
  const ifd0 = layoutIfd(8, ifd0Entries);

  const gpsOffset = 8 + ifd0.length;
  const gpsEntries = [
    asciiEntry(0x0001, "N"), // GPSLatitudeRef
    rationalEntry(0x0002, [
      [37, 1],
      [46, 1],
      [30, 1],
    ]), // GPSLatitude
    asciiEntry(0x0003, "W"), // GPSLongitudeRef
    rationalEntry(0x0004, [
      [122, 1],
      [25, 1],
      [10, 1],
    ]), // GPSLongitude
  ];
  const gps = layoutIfd(gpsOffset, gpsEntries);

  const exifOffset = gpsOffset + gps.length;
  const exifEntries = [asciiEntry(TAG_LENS, "50mm f/1.8")];
  const exif = layoutIfd(exifOffset, exifEntries);

  patchLong(ifd0, TAG_EXIF_IFD, exifOffset);
  patchLong(ifd0, TAG_GPS_IFD, gpsOffset);

  const header = new Uint8Array(8);
  const hdv = new DataView(header.buffer);
  header[0] = 0x49; // "I"
  header[1] = 0x49; // "I"
  hdv.setUint16(2, 42, true);
  hdv.setUint32(4, 8, true); // IFD0 offset

  const out = new Uint8Array(header.length + ifd0.length + gps.length + exif.length);
  out.set(header, 0);
  out.set(ifd0, header.length);
  out.set(gps, header.length + ifd0.length);
  out.set(exif, header.length + ifd0.length + gps.length);
  return out;
}

// ── JPEG fixture ─────────────────────────────────────────────────────────

const EXIF_ID = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];

/** A deterministic "compressed scan" payload — arbitrary bytes standing in
 *  for pixel data. Never parsed as real JPEG entropy data by our code (the
 *  scrubbers stop at SOS and copy everything after it verbatim). */
function fakeScanBytes(seed: number, len = 64): Uint8Array {
  const b = new Uint8Array(len);
  for (let i = 0; i < len; i++) b[i] = (seed * 31 + i * 17) & 0xff;
  return b;
}

function buildJpeg(opts: { withExif: boolean }): Uint8Array {
  const parts: number[][] = [[0xff, 0xd8]]; // SOI

  if (opts.withExif) {
    const tiff = buildExifTiff();
    const app1Len = 2 + EXIF_ID.length + tiff.length;
    parts.push([0xff, 0xe1, (app1Len >> 8) & 0xff, app1Len & 0xff, ...EXIF_ID, ...tiff]);

    // APP13 — Photoshop/IPTC marker, dummy payload (just needs to be present).
    const iptc = new TextEncoder().encode("Photoshop 3.0\0IPTC-DATA-HERE");
    const app13Len = 2 + iptc.length;
    parts.push([0xff, 0xed, (app13Len >> 8) & 0xff, app13Len & 0xff, ...iptc]);
  }

  const scan = fakeScanBytes(7);
  parts.push([0xff, 0xda, 0x00, 0x02, ...scan, 0xff, 0xd9]); // SOS(minimal) + scan + EOI

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** The byte range from the SOS marker onward — proves pixel data survives. */
function jpegScanRegion(b: Uint8Array): Uint8Array {
  for (let i = 2; i + 1 < b.length; i++) {
    if (b[i] === 0xff && b[i + 1] === 0xda) return b.slice(i);
  }
  throw new Error("no SOS marker found");
}

// ── PNG fixture ──────────────────────────────────────────────────────────

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

// Deliberately re-implemented rather than imported from lib/exif.ts's own
// (unexported) `pngCrc32`: the standard PNG/zlib CRC-32 is ~10 lines and
// well-known, and an independent implementation is what actually caught a
// real bug during development (the production code was writing the
// recomputed CRC 4 bytes past the correct chunk offset — this exact
// assertion caught it). Importing the same function under test here would
// make that check tautological.
let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    crcTable = t;
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crc = crc32(out.subarray(4, 8 + data.length));
  dv.setUint32(8 + data.length, crc);
  return out;
}

/** A real, decodable 2×2 RGB PNG (genuine zlib-deflated scanlines via Node's
 *  `zlib`), optionally carrying an eXIf + tEXt chunk. */
function buildPng(opts: { withExif: boolean }): Uint8Array {
  const w = 2;
  const h = 2;
  const ihdr = new Uint8Array(13);
  const idv = new DataView(ihdr.buffer);
  idv.setUint32(0, w);
  idv.setUint32(4, h);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Two scanlines, each: filter byte(0) + 3 RGB pixels... (2 px * 3 bytes).
  const raw = new Uint8Array((1 + w * 3) * h);
  raw.set([0, 255, 0, 0, 0, 0, 255, 0], 0); // row 0: filter=0, red, green... (7 bytes for w=2*3+1=7)
  raw.set([0, 0, 0, 255, 128, 128, 128], 7); // row 1
  const idatData = zlib.deflateSync(Buffer.from(raw));

  const chunks: Uint8Array[] = [
    new Uint8Array(PNG_SIG),
    pngChunk("IHDR", ihdr),
  ];
  if (opts.withExif) {
    chunks.push(pngChunk("eXIf", buildExifTiff()));
    chunks.push(pngChunk("tEXt", new TextEncoder().encode("Comment\0hello")));
  }
  chunks.push(pngChunk("IDAT", new Uint8Array(idatData)));
  chunks.push(pngChunk("IEND", new Uint8Array(0)));

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

interface ParsedPngChunk {
  type: string;
  data: Uint8Array;
}
function parsePngChunks(b: Uint8Array): ParsedPngChunk[] {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: ParsedPngChunk[] = [];
  let pos = 8;
  while (pos + 12 <= b.length) {
    const len = dv.getUint32(pos);
    const type = String.fromCharCode(b[pos + 4], b[pos + 5], b[pos + 6], b[pos + 7]);
    const dataStart = pos + 8;
    const end = dataStart + len;
    out.push({ type, data: b.slice(dataStart, end) });
    pos = end + 4; // + CRC
    if (type === "IEND") break;
  }
  return out;
}

// ── WebP fixture (metadata-chunk only — no real VP8/VP8L bitstream decode) ──

function buildWebp(opts: { withExif: boolean }): Uint8Array {
  const bitstream = new Uint8Array([0x2f, 0, 0, 0, 0]); // VP8L-shaped stub, not decoded
  const chunks: Array<{ fourcc: string; data: Uint8Array }> = [
    { fourcc: "VP8L", data: bitstream },
  ];
  if (opts.withExif) chunks.push({ fourcc: "EXIF", data: buildExifTiff() });

  let body = 4;
  for (const c of chunks) body += 8 + c.data.length + (c.data.length & 1);
  const out = new Uint8Array(8 + body);
  const dv = new DataView(out.buffer);
  out.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  dv.setUint32(4, body, true);
  out.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  let o = 12;
  for (const c of chunks) {
    for (let i = 0; i < 4; i++) out[o + i] = c.fourcc.charCodeAt(i);
    dv.setUint32(o + 4, c.data.length, true);
    out.set(c.data, o + 8);
    o += 8 + c.data.length;
    if (c.data.length & 1) o++;
  }
  return out;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("stripMetadata — JPEG", () => {
  it("'all' removes every identifying tag (EXIF, GPS, IPTC)", () => {
    const jpeg = buildJpeg({ withExif: true });
    const out = stripMetadata(jpeg, "all");
    expect(parseExifFromImage(out, "image/jpeg")).toBeNull();
    // APP13 (IPTC) marker bytes gone too.
    expect(Buffer.from(out).includes(Buffer.from([0xff, 0xed]))).toBe(false);
  });

  it("'location' removes GPS but keeps camera tags", () => {
    const jpeg = buildJpeg({ withExif: true });
    const out = stripMetadata(jpeg, "location");
    const exif = parseExifFromImage(out, "image/jpeg");
    expect(exif).not.toBeNull();
    expect(exif!.gps).toBeUndefined();
    expect(exif!.make).toBe("TestCam");
    expect(exif!.model).toBe("Model X");
    expect(exif!.lens).toBe("50mm f/1.8");
  });

  it("is a no-op on a JPEG with no metadata (still structurally valid)", () => {
    const jpeg = buildJpeg({ withExif: false });
    for (const mode of ["all", "location"] as MetadataStripMode[]) {
      const out = stripMetadata(jpeg, mode);
      expect(out[0]).toBe(0xff);
      expect(out[1]).toBe(0xd8); // SOI
      expect(out[out.length - 2]).toBe(0xff);
      expect(out[out.length - 1]).toBe(0xd9); // EOI
      expect(parseExifFromImage(out, "image/jpeg")).toBeNull();
    }
  });

  it("never touches the compressed scan region (pixel data unchanged)", () => {
    const jpeg = buildJpeg({ withExif: true });
    const originalScan = jpegScanRegion(jpeg);
    for (const mode of ["all", "location"] as MetadataStripMode[]) {
      const out = stripMetadata(jpeg, mode);
      expect(jpegScanRegion(out)).toEqual(originalScan);
    }
  });
});

describe("stripMetadata — PNG", () => {
  it("'all' drops eXIf + tEXt but keeps IDAT byte-identical", () => {
    const png = buildPng({ withExif: true });
    const originalIdat = parsePngChunks(png).find((c) => c.type === "IDAT")!.data;
    const out = stripMetadata(png, "all");
    const chunks = parsePngChunks(out);
    expect(chunks.find((c) => c.type === "eXIf")).toBeUndefined();
    expect(chunks.find((c) => c.type === "tEXt")).toBeUndefined();
    expect(chunks.find((c) => c.type === "IDAT")!.data).toEqual(originalIdat);
    expect(chunks.find((c) => c.type === "IHDR")).toBeDefined();
    expect(parseExifFromImage(out, "image/png")).toBeNull();
  });

  it("'location' removes GPS but keeps camera tags and the tEXt chunk", () => {
    const png = buildPng({ withExif: true });
    const out = stripMetadata(png, "location");
    const chunks = parsePngChunks(out);
    expect(chunks.find((c) => c.type === "tEXt")).toBeDefined(); // untouched
    const exif = parseExifFromImage(out, "image/png");
    expect(exif).not.toBeNull();
    expect(exif!.gps).toBeUndefined();
    expect(exif!.make).toBe("TestCam");
  });

  it("rewrites the eXIf chunk with a valid recomputed CRC", () => {
    const png = buildPng({ withExif: true });
    const out = stripMetadata(png, "location");
    const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
    let pos = 8;
    let found = false;
    while (pos + 12 <= out.length) {
      const len = dv.getUint32(pos);
      const type = String.fromCharCode(out[pos + 4], out[pos + 5], out[pos + 6], out[pos + 7]);
      const end = pos + 12 + len;
      if (type === "eXIf") {
        found = true;
        const storedCrc = dv.getUint32(pos + 8 + len);
        const recomputed = crc32(out.subarray(pos + 4, pos + 8 + len));
        expect(storedCrc).toBe(recomputed);
      }
      pos = end;
      if (type === "IEND") break;
    }
    expect(found).toBe(true);
  });

  it("is a no-op on a PNG with no metadata", () => {
    const png = buildPng({ withExif: false });
    for (const mode of ["all", "location"] as MetadataStripMode[]) {
      const out = stripMetadata(png, mode);
      expect(Array.from(out.slice(0, 8))).toEqual(PNG_SIG);
      expect(parseExifFromImage(out, "image/png")).toBeNull();
    }
  });
});

describe("stripMetadata — WebP", () => {
  it("'all' removes the EXIF chunk entirely", () => {
    const webp = buildWebp({ withExif: true });
    const out = stripMetadata(webp, "all");
    expect(extractWebpExifTiff(out)).toBeNull();
  });

  it("'location' removes GPS but keeps camera tags", () => {
    const webp = buildWebp({ withExif: true });
    const out = stripMetadata(webp, "location");
    const exif = parseExifFromImage(out, "image/webp");
    expect(exif).not.toBeNull();
    expect(exif!.gps).toBeUndefined();
    expect(exif!.make).toBe("TestCam");
  });

  it("is a no-op on a WebP with no metadata", () => {
    const webp = buildWebp({ withExif: false });
    for (const mode of ["all", "location"] as MetadataStripMode[]) {
      const out = stripMetadata(webp, mode);
      expect(extractWebpExifTiff(out)).toBeNull();
      // Still a valid-looking RIFF/WEBP container.
      expect(String.fromCharCode(...out.slice(0, 4))).toBe("RIFF");
      expect(String.fromCharCode(...out.slice(8, 12))).toBe("WEBP");
    }
  });
});

describe("stripMetadata — unsupported format", () => {
  it("passes unknown bytes through unchanged (documented gap, e.g. AVIF)", () => {
    const notAnImage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(stripMetadata(notAnImage, "all")).toEqual(notAnImage);
    expect(stripMetadata(notAnImage, "location")).toEqual(notAnImage);
  });
});
