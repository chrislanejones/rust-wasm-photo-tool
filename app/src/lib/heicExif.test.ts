// ===== FILE: app/src/lib/heicExif.test.ts =====
//
// Tests for the HEIC EXIF item reader.
//
// The fixtures are BUILT HERE, from the box layout in ISO/IEC 14496-12, rather
// than checked in as a camera file: a real iPhone HEIC is a ~2 MB binary whose
// EXIF sits wherever that phone's encoder put it, which makes it a poor thing
// to assert against and a worse thing to keep in git. Building the container
// means each test states exactly which structural variation it covers —
// iloc version, field widths, the TIFF-offset prefix — and can cover the ones
// no device on this machine would produce.

import { describe, it, expect } from "vitest";
import { extractHeicExifTiff } from "@/lib/heicExif";
import { applyExifToReencoded, parseExifFromImage } from "@/lib/exif";

const ascii = (s: string) => new TextEncoder().encode(s);

/** size(4) + type(4) + payload. */
function box(type: string, ...parts: Uint8Array[]): Uint8Array {
  const payload = concat(...parts);
  const out = new Uint8Array(8 + payload.length);
  new DataView(out.buffer).setUint32(0, out.length);
  out.set(ascii(type), 4);
  out.set(payload, 8);
  return out;
}

/** A FullBox is a box whose payload starts with version(1) + flags(3). */
function fullBox(type: string, version: number, ...parts: Uint8Array[]): Uint8Array {
  return box(type, new Uint8Array([version, 0, 0, 0]), ...parts);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const u16 = (v: number) => new Uint8Array([(v >> 8) & 0xff, v & 0xff]);
const u32 = (v: number) => new Uint8Array([(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]);

/**
 * A minimal but spec-shaped TIFF/EXIF block: little-endian header, one IFD
 * with a single Make tag (0x010f, ASCII) pointing at "Apple\0".
 */
function tiffBlock(): Uint8Array {
  const value = ascii("Apple\0");
  const header = concat(ascii("II"), new Uint8Array([0x2a, 0x00]), le32(8));
  const entry = concat(le16(0x010f), le16(2), le32(value.length), le32(8 + 2 + 12 + 4));
  return concat(header, le16(1), entry, le32(0), value);
}
const le16 = (v: number) => new Uint8Array([v & 0xff, (v >> 8) & 0xff]);
const le32 = (v: number) =>
  new Uint8Array([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff]);

/** infe (v2): item_ID(2) + protection_index(2) + item_type(4cc) + name. */
function infe(itemId: number, itemType: string): Uint8Array {
  return fullBox("infe", 2, u16(itemId), u16(0), ascii(itemType), new Uint8Array([0]));
}

interface Opts {
  /** iloc version — 0 has no construction_method field, 1 and 2 do. */
  ilocVersion?: number;
  /** Bytes written into the payload BEFORE the TIFF header, per the item's
   *  4-byte `exif_tiff_header_offset` field. */
  tiffPrefix?: Uint8Array;
  /** Split the payload across two extents, which the spec allows. */
  splitExtents?: boolean;
  itemType?: string;
}

/**
 * Assemble ftyp + meta(iinf, iloc) + mdat, with the EXIF payload in mdat and
 * the iloc extent(s) pointing at its absolute file offset.
 */
function heicWithExif(tiff: Uint8Array, opts: Opts = {}): Uint8Array {
  const { ilocVersion = 0, tiffPrefix = new Uint8Array(0), splitExtents = false } = opts;
  const itemId = 6;
  const payload = concat(u32(tiffPrefix.length), tiffPrefix, tiff);

  const ftyp = box("ftyp", ascii("heic"), u32(0), ascii("heic"), ascii("mif1"));
  const iinf = fullBox("iinf", 0, u16(2), infe(1, "hvc1"), infe(itemId, opts.itemType ?? "Exif"));

  // Two passes: the iloc holds absolute file offsets, so it has to be built
  // once to learn its own size, then rebuilt with the offsets that size implies.
  const build = (payloadOffset: number) => {
    // offset_size=4, length_size=4 (high/low nibbles), base_offset_size=0.
    const sizes = new Uint8Array([0x44, 0x00]);
    const split = splitExtents ? Math.floor(payload.length / 2) : payload.length;
    const extents = splitExtents
      ? concat(
          u32(payloadOffset), u32(split),
          u32(payloadOffset + split), u32(payload.length - split),
        )
      : concat(u32(payloadOffset), u32(payload.length));
    const entry = concat(
      u16(itemId),
      ...(ilocVersion >= 1 ? [u16(0)] : []), // reserved(12b) + construction_method(4b) = 0
      u16(0), // data_reference_index
      u16(splitExtents ? 2 : 1), // extent_count
      extents,
    );
    const iloc = fullBox("iloc", ilocVersion, sizes, u16(1), entry);
    const meta = fullBox("meta", 0, iinf, iloc);
    return { meta, iloc };
  };

  const probe = build(0);
  // mdat payload sits 8 bytes into the mdat box, which follows ftyp + meta.
  const payloadOffset = ftyp.length + probe.meta.length + 8;
  const { meta } = build(payloadOffset);
  const out = concat(ftyp, meta, box("mdat", payload));
  // The two passes only agree because the offset fields are fixed-width; assert
  // it rather than trust it, or a silent drift would make every test vacuous.
  expect(out.subarray(payloadOffset, payloadOffset + payload.length)).toEqual(payload);
  return out;
}

describe("extractHeicExifTiff", () => {
  it("reads the EXIF item out of a HEIC", () => {
    const tiff = tiffBlock();
    expect(extractHeicExifTiff(heicWithExif(tiff))).toEqual(tiff);
  });

  it("reads it from an iloc that carries construction_method (version 1)", () => {
    const tiff = tiffBlock();
    expect(extractHeicExifTiff(heicWithExif(tiff, { ilocVersion: 1 }))).toEqual(tiff);
  });

  // The offset field exists precisely so a writer can keep the JPEG-style
  // "Exif\0\0" prefix in front of the TIFF header. Skipping it is the reader's
  // job; returning it would hand exif.ts six bytes of garbage before the magic.
  it("honours a non-zero tiff_header_offset", () => {
    const tiff = tiffBlock();
    const heic = heicWithExif(tiff, { tiffPrefix: ascii("Exif\0\0") });
    expect(extractHeicExifTiff(heic)).toEqual(tiff);
  });

  it("stitches a payload split across two extents", () => {
    const tiff = tiffBlock();
    expect(extractHeicExifTiff(heicWithExif(tiff, { splitExtents: true }))).toEqual(tiff);
  });

  it("returns null for a HEIC with no EXIF item", () => {
    // Both samples this parser was developed against (libheif's and Nokia's)
    // are exactly this: item table, no Exif item.
    expect(extractHeicExifTiff(heicWithExif(tiffBlock(), { itemType: "mime" }))).toBeNull();
  });

  it("returns null rather than throwing on junk", () => {
    expect(extractHeicExifTiff(new Uint8Array(0))).toBeNull();
    expect(extractHeicExifTiff(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBeNull();
    expect(extractHeicExifTiff(new Uint8Array(64).fill(0xab))).toBeNull();
  });

  it("returns null when the item points past the end of the file", () => {
    const heic = heicWithExif(tiffBlock());
    expect(extractHeicExifTiff(heic.subarray(0, heic.length - 8))).toBeNull();
  });

  it("returns null when the payload is not a TIFF block", () => {
    const notTiff = concat(ascii("PNG?"), new Uint8Array(32));
    expect(extractHeicExifTiff(heicWithExif(notTiff))).toBeNull();
  });
});

// ── The promise this module exists for ──────────────────────────────────────
//
// Reading the block correctly is only half of it. The claim the feature makes
// is that an imported iPhone photo still has its camera metadata afterwards,
// and that spans three modules: read it out of the HEIF item table, transplant
// it into the re-encoded WebP, read it back for the Image Meta panel. Testing
// only the first would leave the other two joints untested and the promise
// unverified.

/** A metadata-only WebP: a stub bitstream chunk in a real RIFF container.
 *  Mirrors the fixture in exif.test.ts — no VP8L bitstream is ever decoded,
 *  only the chunk table is read and rewritten. */
function stubWebp(): Uint8Array<ArrayBuffer> {
  const bitstream = new Uint8Array([0x2f, 0, 0, 0, 0]);
  const out = new Uint8Array(12 + 8 + bitstream.length);
  const dv = new DataView(out.buffer);
  out.set(ascii("RIFF"), 0);
  dv.setUint32(4, out.length - 8, true);
  out.set(ascii("WEBP"), 8);
  out.set(ascii("VP8L"), 12);
  dv.setUint32(16, bitstream.length, true);
  out.set(bitstream, 20);
  return out;
}

describe("HEIC EXIF survives the re-encode to WebP", () => {
  it("carries the camera tag from the HEIC into the converted WebP", () => {
    const heic = heicWithExif(tiffBlock());
    const tiff = extractHeicExifTiff(heic);
    expect(tiff).not.toBeNull();

    // Exactly the call lib/heic.ts makes on the encoder's output.
    const webp = applyExifToReencoded(stubWebp(), "webp", "keep", tiff, 16, 16);

    // And exactly the call the Image Meta panel makes on the stored original.
    expect(parseExifFromImage(webp, "image/webp")?.make).toBe("Apple");
  });

  it("leaves the WebP untouched when the HEIC carried no EXIF", () => {
    const before = stubWebp();
    const after = applyExifToReencoded(before, "webp", "keep", null, 16, 16);
    expect(after).toEqual(before);
    expect(parseExifFromImage(after, "image/webp")).toBeNull();
  });
});
