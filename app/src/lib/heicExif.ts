// ===== FILE: app/src/lib/heicExif.ts =====
/**
 * Pull the EXIF block out of a HEIC/HEIF container.
 *
 * WHY THIS EXISTS. Importing a HEIC re-encodes it to WebP at the boundary
 * (lib/heic.ts), and re-encoded pixels carry no metadata. Without this, every
 * iPhone photo would land in the gallery with the Image Meta panel reporting
 * "No EXIF metadata in the original" and the Security pane's GPS scrub with
 * nothing to scrub — the camera, lens, capture time and location the phone
 * wrote would be silently dropped on import. This reads them out of the HEIC
 * so `applyExifToReencoded` can transplant them into the WebP.
 *
 * HOW A HEIF STORES EXIF (ISO/IEC 14496-12 + 23008-12). Not as a JPEG-style
 * marker segment — as a *metadata item* in the file's item table:
 *
 *   ftyp
 *   meta                         (FullBox)
 *     iinf -> infe(item_ID=N, item_type='Exif')     which item is the EXIF
 *     iloc -> item_ID=N @ offset/length             where its bytes live
 *   mdat                                            the bytes themselves
 *
 * `iloc` offsets are into the WHOLE FILE, which is why this parses from the
 * raw bytes rather than from anything libheif hands back.
 *
 * BEST EFFORT BY CONSTRUCTION. Every unexpected shape returns null, and the
 * caller treats null exactly like a JPEG with no EXIF — the import still
 * succeeds, it just carries no metadata. It never throws.
 */

// Matches lib/exif.ts: the explicit ArrayBuffer argument (rather than the
// ArrayBufferLike default) is what lets these bytes flow into that module's
// injectors without a cast.
type Bytes = Uint8Array<ArrayBuffer>;

/** Read a big-endian unsigned integer of `size` bytes (size <= 6, so the
 *  result stays exact in a double). Returns NaN when it runs off the end. */
function beUint(b: Bytes, off: number, size: number): number {
  if (size === 0) return 0;
  if (off + size > b.length) return NaN;
  let v = 0;
  for (let i = 0; i < size; i++) v = v * 256 + b[off + i];
  return v;
}

function fourcc(b: Bytes, off: number): string {
  return String.fromCharCode(b[off], b[off + 1], b[off + 2], b[off + 3]);
}

interface Box {
  type: string;
  /** First byte of the box's payload (past size/type/largesize). */
  start: number;
  /** One past the box's last byte. */
  end: number;
}

/**
 * Walk the boxes between `from` and `to`. A box is size(4) + type(4), with
 * size 1 meaning "64-bit size follows" and size 0 meaning "runs to `to`".
 * Stops at the first malformed header rather than guessing.
 */
function readBoxes(b: Bytes, from: number, to: number): Box[] {
  const out: Box[] = [];
  let off = from;
  while (off + 8 <= to) {
    const size32 = beUint(b, off, 4);
    const type = fourcc(b, off + 4);
    let start = off + 8;
    let end: number;
    if (size32 === 1) {
      // 64-bit largesize. A file needing the high 2 bytes is >256 TB, which is
      // not something a browser holds in an ArrayBuffer, so require them zero
      // and read the low 6 (the most `beUint` keeps exact).
      if (off + 16 > to) return out;
      if (b[off + 8] !== 0 || b[off + 9] !== 0) return out;
      const large = beUint(b, off + 10, 6);
      if (!Number.isFinite(large)) return out;
      start = off + 16;
      end = off + large;
    } else if (size32 === 0) {
      end = to;
    } else {
      end = off + size32;
    }
    if (!Number.isFinite(end) || end <= off || end > to || start > end) return out;
    out.push({ type, start, end });
    off = end;
  }
  return out;
}

/** version + flags of a FullBox, or null when the box is too short. */
function fullBoxHeader(b: Bytes, box: Box): { version: number; offset: number } | null {
  if (box.start + 4 > box.end) return null;
  return { version: b[box.start], offset: box.start + 4 };
}

/** item_ID of the `infe` entry whose item_type is 'Exif', or null. */
function findExifItemId(b: Bytes, iinf: Box): number | null {
  const head = fullBoxHeader(b, iinf);
  if (!head) return null;
  // entry_count: 16-bit in version 0, 32-bit from version 1.
  const countSize = head.version === 0 ? 2 : 4;
  const entriesStart = head.offset + countSize;
  if (entriesStart > iinf.end) return null;

  for (const infe of readBoxes(b, entriesStart, iinf.end)) {
    if (infe.type !== "infe") continue;
    const ih = fullBoxHeader(b, infe);
    // item_type only exists from version 2 on. Versions 0/1 identify the item
    // by a MIME content_type string instead; no HEIF writer in the wild uses
    // them for EXIF, so they are skipped rather than parsed.
    if (!ih || ih.version < 2) continue;
    const idSize = ih.version === 2 ? 2 : 4;
    const itemId = beUint(b, ih.offset, idSize);
    // item_ID, then item_protection_index (2), then item_type (4cc).
    const typeOff = ih.offset + idSize + 2;
    if (!Number.isFinite(itemId) || typeOff + 4 > infe.end) continue;
    if (fourcc(b, typeOff) === "Exif") return itemId;
  }
  return null;
}

/** Byte ranges holding `itemId`'s payload, per the `iloc` table, or null. */
function findItemExtents(
  b: Bytes,
  iloc: Box,
  itemId: number,
): Array<{ start: number; end: number }> | null {
  const head = fullBoxHeader(b, iloc);
  if (!head) return null;
  const { version } = head;
  if (version > 2) return null;

  let off = head.offset;
  if (off + 2 > iloc.end) return null;
  const offsetSize = b[off] >> 4;
  const lengthSize = b[off] & 0x0f;
  const baseOffsetSize = b[off + 1] >> 4;
  // The low nibble of the second byte is `index_size` from version 1 on, and
  // reserved (always written as 0) in version 0.
  const indexSize = version >= 1 ? b[off + 1] & 0x0f : 0;
  off += 2;

  const itemCount = beUint(b, off, version < 2 ? 2 : 4);
  off += version < 2 ? 2 : 4;
  if (!Number.isFinite(itemCount)) return null;

  for (let i = 0; i < itemCount; i++) {
    const idSize = version < 2 ? 2 : 4;
    const id = beUint(b, off, idSize);
    off += idSize;
    let constructionMethod = 0;
    if (version >= 1) {
      // 12 reserved bits then a 4-bit construction_method.
      constructionMethod = beUint(b, off, 2) & 0x0f;
      off += 2;
    }
    off += 2; // data_reference_index
    const baseOffset = beUint(b, off, baseOffsetSize);
    off += baseOffsetSize;
    const extentCount = beUint(b, off, 2);
    off += 2;
    if (!Number.isFinite(id) || !Number.isFinite(baseOffset) || !Number.isFinite(extentCount)) {
      return null;
    }

    const extents: Array<{ start: number; end: number }> = [];
    for (let e = 0; e < extentCount; e++) {
      off += indexSize; // extent_index, when the table declares one
      const extentOffset = beUint(b, off, offsetSize);
      off += offsetSize;
      const extentLength = beUint(b, off, lengthSize);
      off += lengthSize;
      if (!Number.isFinite(extentOffset) || !Number.isFinite(extentLength)) return null;
      extents.push({
        start: baseOffset + extentOffset,
        end: baseOffset + extentOffset + extentLength,
      });
    }
    if (off > iloc.end) return null;
    if (id !== itemId) continue;
    // construction_method 0 is a plain file offset. 1 (into an `idat` box) and
    // 2 (into another item) are legal but no camera writes EXIF that way.
    if (constructionMethod !== 0) return null;
    return extents;
  }
  return null;
}

/** True if `b` starts with a TIFF header ("II*\0" little-endian / "MM\0*" big). */
function isTiffHeader(b: Bytes, off: number): boolean {
  if (off + 4 > b.length) return false;
  const le = b[off] === 0x49 && b[off + 1] === 0x49 && b[off + 2] === 0x2a && b[off + 3] === 0x00;
  const be = b[off] === 0x4d && b[off + 1] === 0x4d && b[off + 2] === 0x00 && b[off + 3] === 0x2a;
  return le || be;
}

/**
 * The raw TIFF/EXIF block from a HEIC's EXIF item, or null when it has none.
 *
 * The return shape matches `extractJpegExifTiff` / `extractWebpExifTiff` in
 * lib/exif.ts — bytes starting AT the TIFF header — so it feeds the same
 * readers, the same GPS scrub and the same `applyExifToReencoded` transplant.
 */
export function extractHeicExifTiff(bytes: Bytes): Bytes | null {
  try {
    const meta = readBoxes(bytes, 0, bytes.length).find((box) => box.type === "meta");
    if (!meta) return null;
    const metaHead = fullBoxHeader(bytes, meta);
    if (!metaHead) return null;

    const children = readBoxes(bytes, metaHead.offset, meta.end);
    const iinf = children.find((box) => box.type === "iinf");
    const iloc = children.find((box) => box.type === "iloc");
    if (!iinf || !iloc) return null;

    const itemId = findExifItemId(bytes, iinf);
    if (itemId === null) return null;
    const extents = findItemExtents(bytes, iloc, itemId);
    if (!extents || extents.length === 0) return null;

    let total = 0;
    for (const ex of extents) {
      if (ex.start < 0 || ex.end > bytes.length || ex.end < ex.start) return null;
      total += ex.end - ex.start;
    }
    // A sane EXIF block is kilobytes. Anything past a megabyte is a misparse,
    // and copying it would be the expensive way to find that out.
    if (total < 8 || total > 1_000_000) return null;

    const payload = new Uint8Array(total);
    let at = 0;
    for (const ex of extents) {
      payload.set(bytes.subarray(ex.start, ex.end), at);
      at += ex.end - ex.start;
    }

    // The item payload is a 4-byte big-endian offset to the TIFF header,
    // followed by that many bytes of padding (0 in practice, 6 when the writer
    // kept a JPEG-style "Exif\0\0" prefix), then the TIFF block itself.
    const tiffOffset = beUint(payload, 0, 4);
    const tiffStart = 4 + tiffOffset;
    if (!Number.isFinite(tiffStart) || !isTiffHeader(payload, tiffStart)) {
      // Some writers omit the offset field entirely. Accept that only when the
      // payload plainly begins with a TIFF header.
      return isTiffHeader(payload, 0) ? payload : null;
    }
    return payload.slice(tiffStart);
  } catch {
    return null; // never let a metadata read fail an import
  }
}
