// The PSD codec, end to end in node: what this app writes it reads back
// exactly, and what other editors write (offsets, groups, raw channels,
// 16-bit, grayscale) lands on the canvas the way the file said.
import { describe, it, expect } from "vitest";
import { packBits, unpackBits } from "./packbits";
import { writePsd } from "./write";
import { readPsd } from "./read";
import { ByteWriter } from "./bytes";
import { compositeLayers, type LayeredDocument } from "../document";

function fill(w: number, h: number, rgba: [number, number, number, number]): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) out.set(rgba, i * 4);
  return out;
}

function noisy(w: number, h: number, seed: number): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  let s = seed;
  for (let i = 0; i < out.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out[i] = s & 0xff;
  }
  return out;
}

function threeLayerDoc(): LayeredDocument {
  const w = 7;
  const h = 5;
  return {
    width: w,
    height: h,
    layers: [
      { name: "Background", visible: true, opacity: 1, rgba: fill(w, h, [10, 20, 30, 255]) },
      { name: "Sketch — été ✎", visible: false, opacity: 0.5, rgba: noisy(w, h, 7) },
      { name: "Top", visible: true, opacity: 0.25, rgba: fill(w, h, [200, 100, 0, 128]) },
    ],
    activeIndex: 1,
    composite: null,
    notes: [],
  };
}

describe("PackBits", () => {
  it.each([
    [new Uint8Array([])],
    [new Uint8Array([1])],
    [new Uint8Array([1, 1])],
    [new Uint8Array([1, 2, 3, 4, 5])],
    [new Uint8Array(300).fill(9)],
    [new Uint8Array(300).map((_, i) => i & 0xff)],
    [new Uint8Array([1, 1, 1, 2, 3, 3, 4, 5, 5, 5, 5, 6])],
    [noisy(64, 4, 3)],
  ])("round-trips %o", (row) => {
    const packed = packBits(row);
    const out = new Uint8Array(row.length);
    expect(unpackBits(packed, 0, packed.length, out)).toBe(row.length);
    expect(out).toEqual(row);
    expect(packed.length).toBeLessThanOrEqual(row.length + Math.ceil(row.length / 128) + 1);
  });

  it("compresses a run to two bytes per 128", () => {
    expect(packBits(new Uint8Array(256).fill(0)).length).toBe(4);
  });

  it("never reads past `end` nor writes past the row", () => {
    const packed = packBits(new Uint8Array(50).fill(7));
    const out = new Uint8Array(20);
    expect(unpackBits(packed, 0, packed.length, out)).toBe(20);
    const short = new Uint8Array(50);
    // A truncated stream fills what it can and reports the shortfall.
    expect(unpackBits(packed, 0, 1, short)).toBe(0);
  });
});

describe("writePsd → readPsd", () => {
  it("round-trips names, order, visibility, opacity and every pixel", () => {
    const doc = threeLayerDoc();
    const bytes = writePsd(doc);
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("8BPS");

    const back = readPsd(bytes);
    expect(back.width).toBe(doc.width);
    expect(back.height).toBe(doc.height);
    expect(back.layers.map((l) => l.name)).toEqual(doc.layers.map((l) => l.name));
    expect(back.layers.map((l) => l.visible)).toEqual([true, false, true]);
    expect(back.layers.map((l) => l.opacity)).toEqual([1, 128 / 255, 64 / 255]);
    for (let i = 0; i < 3; i++) expect(back.layers[i].rgba).toEqual(doc.layers[i].rgba);
    expect(back.notes).toEqual([]);
    // PSD has no active layer; the bridge falls back to the top.
    expect(back.activeIndex).toBeNull();
  });

  it("writes the merged image with its transparency, and reads it back", () => {
    const doc = threeLayerDoc();
    const expected = compositeLayers(doc);
    const back = readPsd(writePsd(doc));
    expect(back.composite).toEqual(expected);
  });

  it("uses a supplied composite over its own", () => {
    const doc = threeLayerDoc();
    doc.composite = fill(doc.width, doc.height, [1, 2, 3, 4]);
    expect(readPsd(writePsd(doc)).composite).toEqual(doc.composite);
  });

  it("refuses a canvas the format cannot hold, and a layer of the wrong size", () => {
    const doc = threeLayerDoc();
    expect(() => writePsd({ ...doc, width: 30001 })).toThrow(/30,000/);
    doc.layers[1].rgba = new Uint8Array(4);
    expect(() => writePsd(doc)).toThrow(/Layer 2/);
  });
});

/** Hand-build a PSD the way another editor would: a layer smaller than the
 *  canvas at an offset, raw channels, a group around it, a Multiply blend. */
function foreignPsd(opts: {
  depth?: 8 | 16;
  gray?: boolean;
  group?: boolean;
  blend?: string;
  layers?: boolean;
  compositeChannels?: number;
  mask?: boolean;
}): Uint8Array {
  const depth = opts.depth ?? 8;
  const gray = opts.gray ?? false;
  const W = 4;
  const H = 3;
  const bytesPer = depth / 8;
  const w = new ByteWriter();
  w.ascii("8BPS");
  w.u16(1);
  w.zeros(6);
  const colorChannels = gray ? 1 : 3;
  w.u16(opts.compositeChannels ?? colorChannels + 1);
  w.u32(H);
  w.u32(W);
  w.u16(depth);
  w.u16(gray ? 1 : 3);
  w.u32(0);
  w.u32(0);

  const sample = (v: number) => {
    if (bytesPer === 1) w.u8(v);
    else w.u16((v << 8) | 0x7f);
  };

  const sectionAt = w.length;
  w.u32(0);
  const sectionStart = w.length;
  if (opts.layers !== false) {
    const infoAt = w.length;
    w.u32(0);
    const infoStart = w.length;

    // Layer rect 2×2 at (1,1); raw channels; optional group + closer.
    const lw = 2;
    const lh = 2;
    const chanLen = 2 + lw * lh * bytesPer;
    type Rec = { rect: number[]; chans: [number, number][]; blend: string; name: string; lsct?: number };
    const recs: Rec[] = [];
    if (opts.group) recs.push({ rect: [0, 0, 0, 0], chans: [[-1, 2], [0, 2], [1, 2], [2, 2]], blend: "pass", name: "Group 1", lsct: 1 });
    const chans: [number, number][] = gray
      ? [[-1, chanLen], [0, chanLen]]
      : [[-1, chanLen], [0, chanLen], [1, chanLen], [2, chanLen]];
    if (opts.mask) chans.push([-2, 2 + 4]);
    recs.push({ rect: [1, 1, 1 + lh, 1 + lw], chans, blend: opts.blend ?? "norm", name: "Ãsc?", lsct: undefined });
    if (opts.group) recs.push({ rect: [0, 0, 0, 0], chans: [[-1, 2], [0, 2], [1, 2], [2, 2]], blend: "pass", name: "</Layer group>", lsct: 3 });

    w.i16(-recs.length);
    for (const rec of recs) {
      for (const v of rec.rect) w.i32(v);
      w.u16(rec.chans.length);
      for (const [id, len] of rec.chans) {
        w.i16(id);
        w.u32(len);
      }
      w.ascii("8BIM");
      w.ascii(rec.blend);
      w.u8(255);
      w.u8(0);
      w.u8(0);
      w.u8(0);
      const extraAt = w.length;
      w.u32(0);
      const extraStart = w.length;
      w.u32(0);
      w.u32(0);
      w.u8(rec.name.length);
      w.ascii(rec.name);
      w.zeros((4 - ((rec.name.length + 1) % 4)) % 4); // Pascal pad, length byte included
      if (rec.lsct !== undefined) {
        w.ascii("8BIM");
        w.ascii("lsct");
        w.u32(4);
        w.u32(rec.lsct);
      }
      if (rec.lsct === undefined) {
        // The real name, as Photoshop writes it.
        const real = "Ärger ✎";
        w.ascii("8BIM");
        w.ascii("luni");
        w.u32(4 + real.length * 2);
        w.u32(real.length);
        for (let i = 0; i < real.length; i++) w.u16(real.charCodeAt(i));
      }
      w.patchU32(extraAt, w.length - extraStart);
    }
    for (const rec of recs) {
      for (const [id] of rec.chans) {
        w.u16(0); // raw
        if (rec.lsct !== undefined) continue; // zero-size: only the compression word
        if (id === -2) {
          w.zeros(4);
          continue;
        }
        const n = lw * lh;
        for (let i = 0; i < n; i++) {
          // alpha 200; R = 10+i, G = 20+i, B = 30+i; gray = 10+i
          sample(id === -1 ? 200 : (id + 1) * 10 + i);
        }
      }
    }
    w.align(2);
    w.patchU32(infoAt, w.length - infoStart);
    w.u32(0);
  }
  w.align(2);
  w.patchU32(sectionAt, w.length - sectionStart);

  // Merged image, raw: every sample = channel index + 100.
  w.u16(0);
  const total = opts.compositeChannels ?? colorChannels + 1;
  for (let c = 0; c < total; c++) {
    for (let i = 0; i < W * H; i++) sample(100 + c);
  }
  return w.finish();
}

describe("readPsd on files other editors write", () => {
  it("places an offset layer at its rectangle, reads the luni name, keeps the raw channels", () => {
    const doc = readPsd(foreignPsd({}));
    expect(doc.width).toBe(4);
    expect(doc.height).toBe(3);
    expect(doc.layers).toHaveLength(1);
    expect(doc.layers[0].name).toBe("Ärger ✎");
    const px = (x: number, y: number) => [...doc.layers[0].rgba.subarray((y * 4 + x) * 4, (y * 4 + x) * 4 + 4)];
    expect(px(0, 0)).toEqual([0, 0, 0, 0]); // outside the layer: transparent
    expect(px(1, 1)).toEqual([10, 20, 30, 200]);
    expect(px(2, 1)).toEqual([11, 21, 31, 200]);
    expect(px(1, 2)).toEqual([12, 22, 32, 200]);
    expect(px(2, 2)).toEqual([13, 23, 33, 200]);
    expect(px(3, 2)).toEqual([0, 0, 0, 0]);
    expect(doc.notes).toEqual([]);
    // Merged image: R=100 G=101 B=102, alpha from the 4th channel (count < 0).
    expect([...doc.composite!.subarray(0, 4)]).toEqual([100, 101, 102, 103]);
  });

  it("drops a group's folder and closer, keeps what was inside, and says so", () => {
    const doc = readPsd(foreignPsd({ group: true }));
    expect(doc.layers.map((l) => l.name)).toEqual(["Ärger ✎"]);
    expect(doc.notes).toEqual(["1 layer group was ungrouped — the layers inside are kept, the folder is not."]);
  });

  it("names a blend mode it cannot keep, and a mask it dropped", () => {
    const doc = readPsd(foreignPsd({ blend: "mul ", mask: true }));
    expect(doc.notes).toEqual([
      "1 layer used Multiply blending, which Image Horse doesn't have; imported as Normal.",
      "1 layer mask was dropped.",
    ]);
    expect(doc.layers[0].rgba[(1 * 4 + 1) * 4]).toBe(10);
  });

  it("reduces 16-bit samples to their high byte and notes it", () => {
    const doc = readPsd(foreignPsd({ depth: 16 }));
    expect(doc.notes).toEqual(["16-bit color was reduced to 8-bit."]);
    expect([...doc.layers[0].rgba.subarray((1 * 4 + 1) * 4, (1 * 4 + 1) * 4 + 4)]).toEqual([10, 20, 30, 200]);
    expect([...doc.composite!.subarray(0, 4)]).toEqual([100, 101, 102, 103]);
  });

  it("spreads a grayscale file's one channel across R G B", () => {
    const doc = readPsd(foreignPsd({ gray: true }));
    expect([...doc.layers[0].rgba.subarray((1 * 4 + 1) * 4, (1 * 4 + 1) * 4 + 4)]).toEqual([10, 10, 10, 200]);
    expect([...doc.composite!.subarray(0, 4)]).toEqual([100, 100, 100, 101]);
  });

  it("opens a flat file (no layer section) as one Background layer", () => {
    const doc = readPsd(foreignPsd({ layers: false, compositeChannels: 3 }));
    expect(doc.layers).toHaveLength(1);
    expect(doc.layers[0].name).toBe("Background");
    expect([...doc.layers[0].rgba.subarray(0, 4)]).toEqual([100, 101, 102, 255]);
  });

  it("names the reason it refuses a file", () => {
    expect(() => readPsd(new Uint8Array([1, 2, 3]))).toThrow(/8BPS/);
    const png = new Uint8Array(30);
    png.set([0x89, 0x50, 0x4e, 0x47]);
    expect(() => readPsd(png)).toThrow(/Not a PSD/);

    const psb = foreignPsd({});
    psb[5] = 2;
    expect(() => readPsd(psb)).toThrow(/PSB/);

    const cmyk = foreignPsd({});
    cmyk[25] = 4;
    expect(() => readPsd(cmyk)).toThrow(/CMYK/);

    const deep = foreignPsd({});
    deep[23] = 32;
    expect(() => readPsd(deep)).toThrow(/32-bit/);

    expect(() => readPsd(foreignPsd({}).subarray(0, 60))).toThrow(/ends early/);
  });
});
