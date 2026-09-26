// Build a .psd from a LayeredDocument. Photoshop's own format, as published in
// Adobe's "Photoshop File Formats Specification": a 26-byte header, four
// length-prefixed sections, big-endian throughout, one byte per sample.
//
// WHAT IS WRITTEN. Version 1 (PSD, not PSB — the canvas is capped at 30,000
// px a side, which is the format's own limit), 8-bit RGB, four channels
// (R G B + transparency) in the merged image so a viewer with no layer support
// still shows the picture, and every layer as a full-canvas record with
// R G B and an alpha channel, PackBits-packed. Names go out twice, as the
// spec asks: a Pascal string (ASCII, which is all it can hold) and a `luni`
// block carrying the real Unicode name. Blend mode is always Normal, because
// the engine has no other. No masks, no groups, no adjustment layers, no
// resolution block — nothing this app cannot also read back.
import { compositeLayers, type LayeredDocument } from "../document";
import { ByteWriter, PsdError } from "./bytes";
import { packBits } from "./packbits";

/** The format's own ceiling for version-1 files. */
const PSD_MAX_SIDE = 30000;

const CHANNEL_IDS = [-1, 0, 1, 2] as const; // alpha, R, G, B

/** One 8-bit plane of an RGBA buffer. Channel -1 is alpha; 0..2 are R G B. */
function plane(rgba: Uint8Array, pixels: number, id: number): Uint8Array {
  const out = new Uint8Array(pixels);
  const off = id < 0 ? 3 : id;
  for (let i = 0; i < pixels; i++) out[i] = rgba[i * 4 + off];
  return out;
}

/** A plane as PSD "RLE": the per-row byte-count table, then the packed rows. */
function packPlane(p: Uint8Array, width: number, height: number): Uint8Array {
  const rows: Uint8Array[] = new Array(height);
  let total = 0;
  for (let y = 0; y < height; y++) {
    const r = packBits(p.subarray(y * width, (y + 1) * width));
    rows[y] = r;
    total += r.length;
  }
  const out = new Uint8Array(2 * height + total);
  const view = new DataView(out.buffer);
  let o = 2 * height;
  for (let y = 0; y < height; y++) {
    view.setUint16(y * 2, rows[y].length);
    out.set(rows[y], o);
    o += rows[y].length;
  }
  return out;
}

/** Pascal string, ASCII only (the spec's own limit; non-ASCII becomes "?"),
 *  length byte included in the padding to a multiple of 4. */
function pascalName(w: ByteWriter, name: string): void {
  let s = "";
  for (const ch of name) s += ch.charCodeAt(0) < 0x80 ? ch : "?";
  if (s.length > 255) s = s.slice(0, 255);
  w.u8(s.length);
  w.ascii(s);
  const total = 1 + s.length;
  const pad = (4 - (total % 4)) % 4;
  w.zeros(pad);
}

/** The `luni` additional-info block: the real name, UTF-16BE. */
function unicodeName(w: ByteWriter, name: string): void {
  const units = name.length; // UTF-16 code units, which is what the field counts
  const dataLen = 4 + units * 2;
  w.ascii("8BIM");
  w.ascii("luni");
  w.u32(dataLen + (dataLen % 2));
  w.u32(units);
  for (let i = 0; i < units; i++) w.u16(name.charCodeAt(i));
  w.align(2);
}

export function writePsd(doc: LayeredDocument): Uint8Array {
  const { width, height } = doc;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1
  ) {
    throw new PsdError("The document has no size to write.");
  }
  if (width > PSD_MAX_SIDE || height > PSD_MAX_SIDE) {
    throw new PsdError(
      `PSD files hold at most ${PSD_MAX_SIDE.toLocaleString()} px a side; this canvas is ${width}×${height}.`,
    );
  }
  const pixels = width * height;
  doc.layers.forEach((l, i) => {
    if (l.rgba.length !== pixels * 4) {
      throw new PsdError(`Layer ${i + 1} ("${l.name}") is not the canvas size.`);
    }
  });

  const w = new ByteWriter();

  // ── Header ────────────────────────────────────────────────────────────
  w.ascii("8BPS");
  w.u16(1); // version 1 = PSD
  w.zeros(6);
  w.u16(4); // channels in the merged image: R G B A
  w.u32(height);
  w.u32(width);
  w.u16(8); // bits per sample
  w.u16(3); // RGB

  // ── Color mode data, image resources: both empty ──────────────────────
  w.u32(0);
  w.u32(0);

  // ── Layer and mask information ────────────────────────────────────────
  const sectionLenAt = w.length;
  w.u32(0);
  const sectionStart = w.length;

  const infoLenAt = w.length;
  w.u32(0);
  const infoStart = w.length;

  // Negative: the merged image's fourth channel is real transparency, not a
  // spot channel. That is what lets a reader keep our alpha on the way back.
  w.i16(-doc.layers.length);

  // Pack every channel first: each layer record declares its channel byte
  // lengths before any pixel data is written.
  const packed = doc.layers.map((layer) =>
    CHANNEL_IDS.map((id) => packPlane(plane(layer.rgba, pixels, id), width, height)),
  );

  doc.layers.forEach((layer, i) => {
    w.i32(0); // top
    w.i32(0); // left
    w.i32(height); // bottom
    w.i32(width); // right
    w.u16(CHANNEL_IDS.length);
    CHANNEL_IDS.forEach((id, c) => {
      w.i16(id);
      w.u32(2 + packed[i][c].length); // compression word + data
    });
    w.ascii("8BIM");
    w.ascii("norm");
    w.u8(Math.round(Math.max(0, Math.min(1, layer.opacity)) * 255));
    w.u8(0); // clipping: base
    w.u8(layer.visible ? 0 : 2); // bit 1 set = hidden
    w.u8(0); // filler
    const extraLenAt = w.length;
    w.u32(0);
    const extraStart = w.length;
    w.u32(0); // layer mask data: none
    w.u32(0); // blending ranges: none
    pascalName(w, layer.name);
    unicodeName(w, layer.name);
    w.patchU32(extraLenAt, w.length - extraStart);
  });

  // Channel image data, in the same layer and channel order as the records.
  for (const channels of packed) {
    for (const data of channels) {
      w.u16(1); // RLE
      w.bytes(data);
    }
  }

  w.align(2);
  w.patchU32(infoLenAt, w.length - infoStart);

  w.u32(0); // global layer mask info: none

  w.align(2);
  w.patchU32(sectionLenAt, w.length - sectionStart);

  // ── Image data: the merged picture, R G B A planes, RLE ───────────────
  const composite = doc.composite ?? compositeLayers(doc);
  if (composite.length !== pixels * 4) {
    throw new PsdError("The merged image is not the canvas size.");
  }
  const planes = [0, 1, 2, -1].map((id) => {
    const p = plane(composite, pixels, id);
    const rows: Uint8Array[] = new Array(height);
    for (let y = 0; y < height; y++) rows[y] = packBits(p.subarray(y * width, (y + 1) * width));
    return rows;
  });
  w.u16(1); // RLE
  // One byte-count table for every row of every channel, then all the rows.
  for (const rows of planes) for (const r of rows) w.u16(r.length);
  for (const rows of planes) for (const r of rows) w.bytes(r);

  return w.finish();
}
