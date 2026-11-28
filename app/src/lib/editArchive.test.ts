// ADR-112: archive v7, undo steps that keep their layers (shapes, texts with
// their ids, pixels), a section table, and a clean answer for newer archives.
import { describe, expect, it } from "vitest";
import { decodeArchive, encodeArchive, readArchive } from "./editArchive";
import type { PersistedAnnotation, PersistedLayer, PersistedShape, SnapEntry } from "./editPersistence";

const png = (tag: number, n = 20) => {
  const out = new Uint8Array(n);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (let i = 8; i < n; i++) out[i] = (tag * 17 + i) & 0xff;
  return out;
};

const text = (id: number, t: string, extra: Partial<PersistedAnnotation> = {}): PersistedAnnotation => ({
  id, text: t, x: 100 + id, y: 200, font_size: 40, r: 1, g: 2, b: 3, bold: true, rotation_deg: 0, ...extra,
});
const rect: PersistedShape = { id: 4, kind: 0, x0: 700, y0: 150, x1: 800, y1: 220, r: 255, g: 0, b: 0, stroke_width: 4, arrow_style: 0, fill_kind: 1, fill_r: 9, fill_g: 9, fill_b: 9, fill_a: 255 };
const pin: PersistedShape = { id: 5, kind: 5, x0: 300, y0: 450, x1: 300, y1: 450, r: 230, g: 40, b: 40, stroke_width: 2, arrow_style: 0, number: 1, label_kind: 0 };
const leader: PersistedShape = { id: 6, kind: 4, x0: 300, y0: 450, x1: 380, y1: 400, r: 230, g: 40, b: 40, stroke_width: 3, arrow_style: 1, points: [[300, 450], [380, 400]] };
const label = text(9, "Crack", { background_kind: 1, bg_tail: 1, align: 4 });
const boxedText = text(12, "Boxed", { background_kind: 1, wrap_width: 220, box_height: 90, perspective: [0, 0, 1, 0, 1, 1, 0, 1], border_width: 3, border_a: 255 });

const layer = (id: number, p: Uint8Array, annotations: PersistedAnnotation[], shapes: PersistedShape[], extra: Partial<PersistedLayer> = {}): PersistedLayer => ({
  id, name: id === 1 ? "Background" : `Layer ${id}`, visible: true, opacity: 1, png: p, annotations, shapes, ...extra,
});

/** Encode with the live state left trivial: these tests are about the steps. */
const encode = (undo: SnapEntry[], redo: SnapEntry[] = []) =>
  encodeArchive(1200, 900, png(1), undo, redo, "[]", "[]", [layer(1, png(2), [], [])], 1, 75);

describe("archive v7: undo steps keep their layers", () => {
  it("a step with 2 shapes, a callout and a boxed text round-trips identical, text ids kept", () => {
    const pixels = png(3, 64);
    const step: SnapEntry = {
      label: "Rectangle", png: png(4), exportQuality: 80,
      annotations: [label, boxedText],
      layers: [layer(1, pixels, [label, boxedText], [rect, pin, leader])],
      activeLayerId: 1,
    };
    const back = decodeArchive(encode([step]));
    expect(back.archiveVersion).toBe(7);
    const got = back.undoStack[0];
    expect(got.layers, "the step carries its layer stack").toHaveLength(1);
    expect(got.layers![0].shapes).toEqual([rect, pin, leader]);
    expect(got.layers![0].annotations).toEqual([label, boxedText]);
    expect(got.layers![0].annotations.map((a) => a.id), "text ids are the saved ids").toEqual([9, 12]);
    expect(got.layers![0].png).toEqual(pixels);
    expect(got.activeLayerId).toBe(1);
    // The v6 fields are still there for an older reader of the local copy.
    expect(got.png).toEqual(step.png);
    expect(got.annotations).toEqual(step.annotations);
    expect(got.exportQuality).toBe(80);
  });

  it("a multi-layer step keeps every layer, its order, visibility and opacity", () => {
    const step: SnapEntry = {
      label: "Brush", png: png(5),
      layers: [
        layer(1, png(6), [], [], { name: "Canvas" }),
        layer(2, png(7), [text(3, "Top")], [rect], { visible: false, opacity: 0.25 }),
      ],
      activeLayerId: 2,
    };
    const got = decodeArchive(encode([], [step])).redoStack[0];
    expect(got.layers).toEqual(step.layers);
    expect(got.activeLayerId).toBe(2);
  });

  it("the same pixels in two steps are stored once, and read back as one object", () => {
    const shared = png(8, 4000);
    const a: SnapEntry = { label: "A", png: png(9), layers: [layer(1, shared, [], [rect])], activeLayerId: 1 };
    const b: SnapEntry = { label: "B", png: png(10), layers: [layer(1, shared, [], [rect, pin])], activeLayerId: 1 };
    const one = encode([a]);
    const two = encode([a, b]);
    expect(two.length - one.length, "B adds its own small PNG and JSON, not 4,000 more bytes").toBeLessThan(1000);
    const back = decodeArchive(two);
    expect(back.undoStack[0].layers![0].png).toBe(back.undoStack[1].layers![0].png);
  });

  it("a step without layers stays a step without layers (today's flattened step)", () => {
    const flat: SnapEntry = { label: "Old", png: png(11), annotations: [text(1, "x")] };
    const rich: SnapEntry = { label: "New", png: png(12), layers: [layer(1, png(13), [], [pin])], activeLayerId: 1 };
    const back = decodeArchive(encode([flat, rich]));
    expect(back.undoStack[0].layers).toBeUndefined();
    expect(back.undoStack[1].layers![0].shapes).toEqual([pin]);
  });
});

describe("archive v7: newer archives", () => {
  const withHeader = (bytes: Uint8Array, version: number, compat: number) => {
    const out = bytes.slice();
    const v = new DataView(out.buffer);
    v.setUint32(4, version, true);
    v.setUint32(8, compat, true);
    return out;
  };

  it("a newer archive this build can't read is a clean 'newer' answer: no throw, no change", () => {
    const bytes = withHeader(encode([]), 8, 8);
    const before = bytes.slice();
    const r = readArchive(bytes);
    expect(r).toEqual({ kind: "newer", version: 8 });
    expect(bytes).toEqual(before);
    expect(() => decodeArchive(bytes)).toThrow(/newer version/);
  });

  it("a newer archive that says v7 can read it is read, unknown sections skipped", () => {
    // Append an unknown section ("BRCH", what Time Machine would add) after STEP.
    const base = encode([{ label: "A", png: png(14), layers: [layer(1, png(15), [], [rect])], activeLayerId: 1 }]);
    const view = new DataView(base.buffer);
    // The section table is at the end: find its count by reading from the v6 tail.
    const body = readArchive(base);
    expect(body.kind).toBe("ok");
    const extra = new Uint8Array(4 + 4 + 5);
    const ev = new DataView(extra.buffer);
    ev.setUint32(0, 0x48435242, true); // "BRCH"
    ev.setUint32(4, 5, true);
    extra.set([1, 2, 3, 4, 5], 8);
    const sectionsAt = (body as { sectionsAt: number }).sectionsAt;
    const count = view.getUint32(sectionsAt, true);
    const grown = new Uint8Array(base.length + extra.length);
    grown.set(base);
    grown.set(extra, base.length);
    new DataView(grown.buffer).setUint32(sectionsAt, count + 1, true);
    const r = readArchive(withHeader(grown, 8, 7));
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.edit.undoStack[0].layers![0].shapes).toEqual([rect]);
  });

  it("a v7 archive cut off inside its STEP section still opens, as flattened steps", () => {
    const full = encode([{ label: "A", png: png(16), layers: [layer(1, png(17, 300), [], [rect])], activeLayerId: 1 }]);
    const back = decodeArchive(full.slice(0, full.length - 40));
    expect(back.undoStack).toHaveLength(1);
    expect(back.undoStack[0].png).toEqual(png(16));
    expect(back.undoStack[0].layers).toBeUndefined();
  });
});
