// The documents the archive fixtures are made from (see makeFixtures.test.ts).
// PNG bytes are stand-ins: the archive never decodes them, it only carries
// them, so distinct byte runs that start with the PNG signature are enough.
import type { PersistedAnnotation, PersistedLayer, PersistedShape, SnapEntry } from "../../editPersistence";

const png = (tag: number, n = 24) => {
  const out = new Uint8Array(n);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (let i = 8; i < n; i++) out[i] = (tag * 31 + i) & 0xff;
  return out;
};

const text = (id: number, t: string, extra: Partial<PersistedAnnotation> = {}): PersistedAnnotation => ({
  id, text: t, x: 40 * id, y: 30, font_size: 32, r: 20, g: 30, b: 40, bold: false, rotation_deg: 0,
  background_kind: 0, bg_r: 255, bg_g: 255, bg_b: 255, bg_a: 255, bg_padding: 8, bg_corner_radius: 4, bg_tail: 0,
  ...extra,
});
const boxed = (id: number, t: string) =>
  text(id, t, { background_kind: 1, wrap_width: 220, box_height: 90, align: 4, border_width: 3, border_r: 200, border_g: 0, border_b: 0, border_a: 255 });

const rect: PersistedShape = { id: 1, kind: 0, x0: 10, y0: 10, x1: 90, y1: 60, r: 255, g: 0, b: 0, stroke_width: 4, arrow_style: 0, fill_kind: 1, fill_r: 255, fill_g: 255, fill_b: 255, fill_a: 255, rotation: 0, cornerRadii: [6, 6, 6, 6] };
const pin: PersistedShape = { id: 2, kind: 5, x0: 300, y0: 450, x1: 300, y1: 450, r: 230, g: 40, b: 40, stroke_width: 2, arrow_style: 0, number: 1, label_kind: 0 };
const leader: PersistedShape = { id: 3, kind: 4, x0: 300, y0: 450, x1: 380, y1: 400, r: 230, g: 40, b: 40, stroke_width: 3, arrow_style: 1 };

export interface Scene {
  canvasW: number; canvasH: number; canvasPng: Uint8Array;
  undoStack: SnapEntry[]; redoStack: SnapEntry[];
  annotations: PersistedAnnotation[]; shapes: PersistedShape[];
  layers: PersistedLayer[]; activeLayerId: number; exportQuality: number;
}

export const archiveScenes: Record<string, Scene> = {
  // A single-layer document with a callout, a boxed text and a rect, two undo
  // steps and a redo step: the case ADR-112 is about.
  "v6-callout-box-rect": {
    canvasW: 1200, canvasH: 900, canvasPng: png(1, 40),
    undoStack: [
      { label: "Add Text", png: png(2), annotations: [], exportQuality: 75 },
      { label: "Callout", png: png(3), annotations: [boxed(1, "Boxed")], exportQuality: 80 },
    ],
    redoStack: [{ label: "Rectangle", png: png(4), annotations: [boxed(1, "Boxed"), text(2, "Crack")], exportQuality: 80 }],
    annotations: [boxed(1, "Boxed"), text(2, "Crack")],
    shapes: [rect, pin, leader],
    layers: [{ id: 1, name: "Background", visible: true, opacity: 1, png: png(5, 32), annotations: [boxed(1, "Boxed"), text(2, "Crack")], shapes: [rect, pin, leader] }],
    activeLayerId: 1, exportQuality: 80,
  },
  // Two layers (an artboard Canvas and a photo), half opacity on top.
  "v6-two-layers": {
    canvasW: 640, canvasH: 480, canvasPng: png(6, 30),
    undoStack: [{ label: "Brush", png: png(7), annotations: [], exportQuality: 75 }],
    redoStack: [],
    annotations: [], shapes: [],
    layers: [
      { id: 1, name: "Canvas", visible: true, opacity: 1, png: png(8), annotations: [], shapes: [] },
      { id: 2, name: "Layer 2", visible: true, opacity: 0.5, png: png(9), annotations: [text(7, "Top")], shapes: [rect] },
    ],
    activeLayerId: 2, exportQuality: 75,
  },
  // Nothing in history.
  "v6-no-history": {
    canvasW: 8, canvasH: 4, canvasPng: png(10, 16),
    undoStack: [], redoStack: [], annotations: [], shapes: [],
    layers: [{ id: 1, name: "Background", visible: true, opacity: 1, png: png(11), annotations: [], shapes: [] }],
    activeLayerId: 1, exportQuality: 75,
  },
};
