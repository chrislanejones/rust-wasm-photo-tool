// Read a .psd into a LayeredDocument. The inverse of write.ts, but wider: it
// takes what Photoshop, Affinity, Krita and GIMP actually write, not only what
// this app wrote. See the header of write.ts for the layout.
//
// WHAT IS READ. Version 1, 8-bit or 16-bit (16 keeps the high byte), RGB or
// Grayscale, channels stored Raw or PackBits. Every layer's rectangle is
// resolved onto the canvas — PSD layers carry offsets and their own size,
// which the engine's full-canvas layers do not, so the offset is applied here.
// Layer names come from `luni` when present (the Pascal name is ASCII-only).
//
// WHAT IS NOT, AND SAYS SO. Blend modes other than Normal import as Normal;
// groups are dropped and their layers kept; layer masks are dropped; a fill
// or adjustment layer comes in as the blank layer it is. Each of those puts
// a sentence into `notes` so the import toast can say what changed. ZIP-
// compressed channels, CMYK/Lab/Indexed/Duotone/Bitmap modes, 32-bit depth
// and PSB (version 2) are refused with a message that names the reason.
import type { LayeredDocument, LayeredLayer } from "../document";
import { ByteReader, PsdError } from "./bytes";
import { unpackBits } from "./packbits";

const MAX_SIDE = 30000;
/** Refuse a canvas whose RGBA alone would not fit in a browser's memory —
 *  ~1 GB per full-canvas plane set. A 16,384 px square is 1,073,741,824
 *  bytes; a hostile header claiming 30,000 × 30,000 is 3.6 GB per layer. */
const MAX_PIXELS = 16384 * 16384;

const MODE_NAMES: Record<number, string> = {
  0: "Bitmap",
  2: "Indexed color",
  4: "CMYK",
  7: "Multichannel",
  8: "Duotone",
  9: "Lab",
};

const BLEND_NAMES: Record<string, string> = {
  diss: "Dissolve",
  dark: "Darken",
  mul: "Multiply",
  idiv: "Color Burn",
  lbrn: "Linear Burn",
  dkCl: "Darker Color",
  lite: "Lighten",
  scrn: "Screen",
  div: "Color Dodge",
  lddg: "Linear Dodge",
  lgCl: "Lighter Color",
  over: "Overlay",
  sLit: "Soft Light",
  hLit: "Hard Light",
  vLit: "Vivid Light",
  lLit: "Linear Light",
  pLit: "Pin Light",
  hMix: "Hard Mix",
  diff: "Difference",
  smud: "Exclusion",
  fsub: "Subtract",
  fdiv: "Divide",
  hue: "Hue",
  sat: "Saturation",
  colr: "Color",
  lum: "Luminosity",
};

/** Additional-info keys that mark a fill or adjustment layer — one with no
 *  pixels of its own, whose effect the engine cannot reproduce. */
const ADJUSTMENT_KEYS = new Set([
  "SoCo", "GdFl", "PtFl", "brit", "levl", "curv", "expA", "vibA", "hue2",
  "blnc", "blwh", "phfl", "mixr", "clrL", "nvrt", "post", "thrs", "grdm", "selc",
]);

interface ChannelRef {
  id: number;
  length: number;
}

interface LayerRecord {
  top: number;
  left: number;
  bottom: number;
  right: number;
  channels: ChannelRef[];
  blend: string;
  opacity: number;
  hidden: boolean;
  name: string;
  /** `lsct` said this record is a group folder or its closing divider. */
  isGroupDivider: boolean;
  isAdjustment: boolean;
  hasMask: boolean;
}

function pascalString(r: ByteReader): string {
  const len = r.u8();
  const s = r.ascii(len);
  r.skip((4 - ((len + 1) % 4)) % 4);
  return s;
}

function readLayerRecord(r: ByteReader): LayerRecord {
  const top = r.i32();
  const left = r.i32();
  const bottom = r.i32();
  const right = r.i32();
  const channelCount = r.u16();
  const channels: ChannelRef[] = [];
  for (let i = 0; i < channelCount; i++) {
    channels.push({ id: r.i16(), length: r.u32() });
  }
  if (r.ascii(4) !== "8BIM") {
    throw new PsdError("This PSD's layer records are damaged (missing 8BIM signature).");
  }
  const blend = r.ascii(4);
  const opacity = r.u8() / 255;
  r.u8(); // clipping
  const flags = r.u8();
  r.u8(); // filler
  const extraLen = r.u32();
  const extraEnd = r.pos + extraLen;

  const maskLen = r.u32();
  r.skip(maskLen);
  const rangesLen = r.u32();
  r.skip(rangesLen);
  let name = pascalString(r);

  let isGroupDivider = false;
  let isAdjustment = false;
  // Additional layer information blocks fill the rest of the extra data.
  while (r.pos + 12 <= extraEnd) {
    const sig = r.ascii(4);
    if (sig !== "8BIM" && sig !== "8B64") break;
    const key = r.ascii(4);
    const len = r.u32();
    const start = r.pos;
    if (key === "luni") {
      const units = r.u32();
      let s = "";
      for (let i = 0; i < units; i++) s += String.fromCharCode(r.u16());
      name = s;
    } else if (key === "lsct") {
      const type = r.u32();
      // 1 = open folder, 2 = closed folder, 3 = the hidden divider that ends
      // a group. All three are structure, not pixels.
      if (type >= 1 && type <= 3) isGroupDivider = true;
    } else if (ADJUSTMENT_KEYS.has(key)) {
      isAdjustment = true;
    }
    // Lengths are rounded up to an even count in version-1 files.
    r.seek(start + len + (len % 2));
  }
  r.seek(extraEnd);

  return {
    top,
    left,
    bottom,
    right,
    channels,
    blend,
    opacity,
    hidden: (flags & 2) !== 0,
    name,
    isGroupDivider,
    isAdjustment,
    hasMask: channels.some((c) => c.id === -2 || c.id === -3),
  };
}

/**
 * Decode one channel's samples to 8-bit. `depth` 16 keeps each sample's high
 * byte — the big-endian first byte — which is the same rounding-down
 * Photoshop applies when converting to 8 bits, give or take a half-step.
 */
function readPlane(
  r: ByteReader,
  compression: number,
  width: number,
  height: number,
  depth: number,
  end: number,
): Uint8Array {
  const bytesPer = depth / 8;
  const rowBytes = width * bytesPer;
  const raw = new Uint8Array(rowBytes * height);
  if (compression === 0) {
    raw.set(r.take(raw.length));
  } else if (compression === 1) {
    const counts: number[] = new Array(height);
    for (let y = 0; y < height; y++) counts[y] = r.u16();
    for (let y = 0; y < height; y++) {
      const rowEnd = Math.min(r.pos + counts[y], end);
      unpackBits(r.bytes, r.pos, rowEnd, raw.subarray(y * rowBytes, (y + 1) * rowBytes));
      r.seek(rowEnd);
    }
  } else {
    throw new PsdError(
      "This PSD uses ZIP-compressed channels, which this importer can't read yet. Re-save it with \"Maximize compatibility\" on, or without ZIP compression.",
    );
  }
  if (bytesPer === 1) return raw;
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = raw[i * bytesPer];
  return out;
}

/** Place a layer's own-size planes onto a blank full-canvas RGBA buffer. */
function placeOnCanvas(
  rec: LayerRecord,
  planes: Map<number, Uint8Array>,
  width: number,
  height: number,
  gray: boolean,
): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  const lw = rec.right - rec.left;
  const lh = rec.bottom - rec.top;
  if (lw <= 0 || lh <= 0) return rgba;
  const R = planes.get(0);
  const G = gray ? R : planes.get(1);
  const B = gray ? R : planes.get(2);
  const A = planes.get(-1);
  if (!R) return rgba;
  const y0 = Math.max(0, rec.top);
  const y1 = Math.min(height, rec.bottom);
  const x0 = Math.max(0, rec.left);
  const x1 = Math.min(width, rec.right);
  for (let y = y0; y < y1; y++) {
    const srcRow = (y - rec.top) * lw - rec.left;
    const dstRow = y * width;
    for (let x = x0; x < x1; x++) {
      const s = srcRow + x;
      const d = (dstRow + x) * 4;
      rgba[d] = R[s];
      rgba[d + 1] = G ? G[s] : R[s];
      rgba[d + 2] = B ? B[s] : R[s];
      rgba[d + 3] = A ? A[s] : 255;
    }
  }
  return rgba;
}

export function readPsd(bytes: Uint8Array): LayeredDocument {
  const r = new ByteReader(bytes);
  if (r.length < 26 || r.ascii(4) !== "8BPS") {
    throw new PsdError("Not a PSD file — it doesn't start with the 8BPS signature.");
  }
  const version = r.u16();
  if (version === 2) {
    throw new PsdError("This is a PSB (large document) file; only PSD is supported.");
  }
  if (version !== 1) {
    throw new PsdError(`Unknown PSD version ${version}.`);
  }
  r.skip(6);
  const channelCount = r.u16();
  const height = r.u32();
  const width = r.u32();
  const depth = r.u16();
  const mode = r.u16();

  if (width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE) {
    throw new PsdError(`This PSD claims a ${width}×${height} canvas, which isn't valid.`);
  }
  if (width * height > MAX_PIXELS) {
    throw new PsdError(
      `This PSD is ${width}×${height} — too large to open in a browser tab.`,
    );
  }
  if (depth !== 8 && depth !== 16) {
    throw new PsdError(`This PSD is ${depth}-bit; only 8-bit and 16-bit files can be imported.`);
  }
  if (mode !== 3 && mode !== 1) {
    throw new PsdError(
      `This PSD is in ${MODE_NAMES[mode] ?? `color mode ${mode}`}; only RGB and Grayscale files can be imported.`,
    );
  }
  const gray = mode === 1;
  const notes: string[] = [];
  if (depth === 16) notes.push("16-bit color was reduced to 8-bit.");

  r.skip(r.u32()); // color mode data
  r.skip(r.u32()); // image resources

  // ── Layer and mask information ────────────────────────────────────────
  const layers: LayeredLayer[] = [];
  let mergedHasAlpha = false;
  const sectionLen = r.u32();
  const sectionEnd = r.pos + sectionLen;
  if (sectionLen > 0) {
    const infoLen = r.u32();
    const infoEnd = r.pos + infoLen;
    if (infoLen > 0) {
      const signedCount = r.i16();
      mergedHasAlpha = signedCount < 0;
      const count = Math.abs(signedCount);
      const records: LayerRecord[] = [];
      for (let i = 0; i < count; i++) records.push(readLayerRecord(r));

      const blends = new Map<string, number>();
      let groups = 0;
      let masks = 0;
      let adjustments = 0;

      for (const rec of records) {
        const lw = rec.right - rec.left;
        const lh = rec.bottom - rec.top;
        const planes = new Map<number, Uint8Array>();
        for (const ch of rec.channels) {
          const chEnd = r.pos + ch.length;
          // Colour and transparency channels are the layer's own size; a mask
          // channel (-2 / -3) has its own rectangle we do not use, so skip it.
          if (ch.id >= -1 && ch.id <= 2 && lw > 0 && lh > 0 && !rec.isGroupDivider) {
            const compression = r.u16();
            planes.set(ch.id, readPlane(r, compression, lw, lh, depth, chEnd));
          }
          r.seek(chEnd);
        }
        if (rec.isGroupDivider) {
          groups++;
          continue;
        }
        if (rec.hasMask) masks++;
        if (rec.isAdjustment) adjustments++;
        if (rec.blend !== "norm" && rec.blend !== "pass") {
          const label = BLEND_NAMES[rec.blend.trim()] ?? rec.blend.trim();
          blends.set(label, (blends.get(label) ?? 0) + 1);
        }
        layers.push({
          name: rec.name,
          visible: !rec.hidden,
          opacity: rec.opacity,
          rgba: placeOnCanvas(rec, planes, width, height, gray),
        });
      }

      // The divider records come in pairs (folder + closer), so halve the count.
      if (groups > 0) {
        const n = Math.ceil(groups / 2);
        notes.push(
          `${n} layer group${n === 1 ? " was" : "s were"} ungrouped — the layers inside are kept, the folder is not.`,
        );
      }
      if (blends.size > 0) {
        const names = [...blends.keys()].join(", ");
        const total = [...blends.values()].reduce((a, b) => a + b, 0);
        notes.push(
          `${total} layer${total === 1 ? "" : "s"} used ${names} blending, which Image Horse doesn't have; imported as Normal.`,
        );
      }
      if (masks > 0) {
        notes.push(`${masks} layer mask${masks === 1 ? " was" : "s were"} dropped.`);
      }
      if (adjustments > 0) {
        notes.push(
          `${adjustments} adjustment or fill layer${adjustments === 1 ? "" : "s"} came in blank — their effect isn't reproduced.`,
        );
      }
    }
    r.seek(infoEnd);
  }
  r.seek(sectionEnd);

  // ── Image data: the merged picture ────────────────────────────────────
  let composite: Uint8Array | null = null;
  try {
    const compression = r.u16();
    const colorChannels = gray ? 1 : 3;
    // Only the file's colour channels and, when the layer count said it is
    // real transparency, the one after them. Anything further is a spot or
    // selection channel and is not part of the picture.
    const wanted = Math.min(
      channelCount,
      colorChannels + (mergedHasAlpha || layers.length === 0 ? 1 : 0),
    );
    const planes: Uint8Array[] = [];
    if (compression === 0) {
      for (let c = 0; c < wanted; c++) planes.push(readPlane(r, 0, width, height, depth, r.length));
    } else if (compression === 1) {
      // One row-count table covers every channel, then the rows follow in
      // channel order — so the counts are read up front, all of them.
      const counts: number[] = [];
      for (let i = 0; i < channelCount * height; i++) counts.push(r.u16());
      const rowBytes = width * (depth / 8);
      for (let c = 0; c < wanted; c++) {
        const raw = new Uint8Array(rowBytes * height);
        for (let y = 0; y < height; y++) {
          const rowEnd = Math.min(r.pos + counts[c * height + y], r.length);
          unpackBits(r.bytes, r.pos, rowEnd, raw.subarray(y * rowBytes, (y + 1) * rowBytes));
          r.seek(rowEnd);
        }
        if (depth === 8) planes.push(raw);
        else {
          const out = new Uint8Array(width * height);
          for (let i = 0; i < out.length; i++) out[i] = raw[i * 2];
          planes.push(out);
        }
      }
    } else {
      throw new PsdError("zip");
    }
    if (planes.length >= colorChannels) {
      const n = width * height;
      composite = new Uint8Array(n * 4);
      const A = planes.length > colorChannels ? planes[colorChannels] : null;
      // A flat file's transparency channel counts only when it is the true
      // merged alpha; a 3-channel file is opaque by definition.
      const useAlpha = A !== null && (mergedHasAlpha || layers.length === 0);
      for (let i = 0; i < n; i++) {
        composite[i * 4] = planes[0][i];
        composite[i * 4 + 1] = gray ? planes[0][i] : planes[1][i];
        composite[i * 4 + 2] = gray ? planes[0][i] : planes[2][i];
        composite[i * 4 + 3] = useAlpha && A ? A[i] : 255;
      }
    }
  } catch {
    // A missing or short merged image is not fatal: the layers are the
    // document, and the bridge composites them itself.
    composite = null;
  }

  if (layers.length === 0) {
    if (!composite) {
      throw new PsdError("This PSD has no layers and no merged image to open.");
    }
    layers.push({ name: "Background", visible: true, opacity: 1, rgba: composite });
  }

  return { width, height, layers, activeIndex: null, composite, notes };
}
