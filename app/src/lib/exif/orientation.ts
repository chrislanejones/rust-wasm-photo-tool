// app/src/lib/exif/orientation.ts — the EXIF Orientation tag (0x0112), for the
// camera-info export choice (Night 11-21, 231, ADR-108).
//
// Two facts drive this file:
//
//   1. Every RE-ENCODED export is already upright. Pixels are decoded with
//      `createImageBitmap(file)`, which applies the EXIF orientation by default
//      (lib/workingCopy.ts), so the engine only ever holds upright pixels.
//      Transplanting the source TIFF unchanged therefore wrote "rotate 90°"
//      over pixels that were already rotated: a portrait phone photo exported
//      with camera info kept came out sideways in any viewer that honors the
//      tag. `uprightTiff` sets the tag to 1 before the transplant.
//
//   2. A VERBATIM export (the stored file, never decoded) is NOT upright: its
//      pixels are as the camera wrote them, and the tag is what turns them.
//      "Remove all" must not leave such a file sideways, and re-encoding an
//      untouched JPEG just to bake the turn in would cost quality, so the
//      verbatim path writes back a one-tag TIFF holding only the orientation
//      (`orientationOnlyTiff`). That is "no camera info except what is needed
//      to show the photo the right way up".
//
// Mirrored in src/exif.rs (`tiff_orientation`, `upright_tiff`,
// `orientation_only_tiff`) and held byte-identical by the oracle.
import { Bytes, tiffTypeSize } from "./codecs";

const ORIENTATION_TAG = 0x0112;

interface IfdEntry {
  /** Byte offset of the entry in the TIFF block. */
  at: number;
  le: boolean;
}

/** The IFD0 Orientation entry, if it is a well-formed SHORT×1. */
function findOrientation(tiff: Bytes): IfdEntry | null {
  if (tiff.length < 8) return null;
  const dv = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const bom = dv.getUint16(0, false);
  const le = bom === 0x4949;
  if (!le && bom !== 0x4d4d) return null;
  if (dv.getUint16(2, le) !== 42) return null;
  const ifd0 = dv.getUint32(4, le);
  if (ifd0 <= 0 || ifd0 + 2 > tiff.length) return null;
  const n = dv.getUint16(ifd0, le);
  const start = ifd0 + 2;
  if (start + n * 12 > tiff.length) return null;
  for (let i = 0; i < n; i++) {
    const p = start + i * 12;
    if (dv.getUint16(p, le) !== ORIENTATION_TAG) continue;
    const type = dv.getUint16(p + 2, le);
    const count = dv.getUint32(p + 4, le);
    // SHORT, one value, inline. Anything else is malformed; leave it alone.
    return type === 3 && count === 1 && tiffTypeSize(type) === 2 ? { at: p, le } : null;
  }
  return null;
}

/** The Orientation value (1..8) in a TIFF block, or 1 when absent/invalid. */
export function tiffOrientation(tiff: Bytes | null): number {
  if (!tiff) return 1;
  const e = findOrientation(tiff);
  if (!e) return 1;
  const v = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength).getUint16(e.at + 8, e.le);
  return v >= 1 && v <= 8 ? v : 1;
}

/** A same-length copy with Orientation set to 1 (no-op copy when absent). */
export function uprightTiff(tiff: Bytes): Bytes {
  const out = tiff.slice();
  const e = findOrientation(out);
  if (e) new DataView(out.buffer, out.byteOffset, out.byteLength).setUint16(e.at + 8, 1, e.le);
  return out;
}

/** A 26-byte little-endian TIFF whose only tag is Orientation = `o`. */
export function orientationOnlyTiff(o: number): Bytes {
  const out = new Uint8Array(26);
  const dv = new DataView(out.buffer);
  out.set([0x49, 0x49], 0); // "II"
  dv.setUint16(2, 42, true);
  dv.setUint32(4, 8, true); // IFD0 right after the header
  dv.setUint16(8, 1, true); // one entry
  dv.setUint16(10, ORIENTATION_TAG, true);
  dv.setUint16(12, 3, true); // SHORT
  dv.setUint32(14, 1, true); // count 1
  dv.setUint16(18, o, true); // value, inline (bytes 20..21 stay zero)
  dv.setUint32(22, 0, true); // no next IFD
  return out;
}
