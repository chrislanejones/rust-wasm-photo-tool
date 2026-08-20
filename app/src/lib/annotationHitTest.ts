// Cross-layer annotation hit-testing — #50.
//
// WHY THIS EXISTS. The engine's `text_annotation_at` / `shape_annotation_at`
// are scoped to the ACTIVE layer (`self.layers[self.active]`, annotations.rs
// 1792 and 1188) while `render_layer` composites EVERY visible layer. So the
// canvas shows the union across layers and the hit test answers for one of
// them. Click a text that lives on another layer and the engine returns -1 —
// which `useTextTool` treated as "empty canvas" and used to open a fresh blank
// box ON TOP of the thing you were aiming at.
//
// The fix is to tell the two kinds of miss apart:
//   -1 and nothing under the cursor        → empty canvas, make a new text
//   -1 but another layer has ink there     → a miss, and it stays a miss
//
// WHY IT IS IN TYPESCRIPT, WHICH IS THE WRONG PLACE. The engine owns geometry,
// and the right shape is one Rust call returning (layer, id) — this module is a
// second definition of a rule Rust already states, which is the exact pattern
// this codebase keeps paying for ("a rule three surfaces re-derive is a rule
// they eventually disagree about", exportImage.ts). It is here anyway because
// v8.55 is deliberately TS-only: a Rust change moves the wasm byte count and
// costs the release its `netlify.toml` pin assertion (rebuild reproduces
// 813,546 B), and a check that cannot fail is not a check.
//
// So this is a KNOWN, TEMPORARY duplication with a stated expiry: v8.56 adds
// the engine method and this module becomes a thin call. Until then the port
// is exact, not approximate, and `annotationHitTest.test.ts` pins it against
// the Rust semantics case by case. If you change the Rust rule, this file is
// the second place to change.
//
// Both ports below mirror their Rust originals including iteration order —
// `.rev()`, newest-added wins on overlap — because a disagreement about WHICH
// annotation was hit is as wrong as disagreeing about whether one was.

/** The geometry subset of a text annotation this module needs. */
export interface TextHitGeometry {
  id: number;
  x: number;
  y: number;
  tile_w: number;
  tile_h: number;
  tile_offset_x: number;
  tile_offset_y: number;
}

/** The geometry subset of a shape annotation this module needs. */
export interface ShapeHitGeometry {
  id: number;
  kind: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  stroke_width: number;
  points?: number[][];
}

/**
 * Port of `text_annotation_at` (annotations.rs:1792).
 *
 * Bounds are HALF-OPEN on the far edge — `x < tx + tile_w`, not `<=` — which
 * is what the Rust does and what keeps two tiles sharing an edge from both
 * claiming the same pixel. Newest-first.
 */
export function textAnnotationAt(
  anns: readonly TextHitGeometry[],
  x: number,
  y: number,
): number {
  for (let i = anns.length - 1; i >= 0; i--) {
    const a = anns[i];
    const tx = a.x + a.tile_offset_x;
    const ty = a.y + a.tile_offset_y;
    if (x >= tx && y >= ty && x < tx + a.tile_w && y < ty + a.tile_h) {
      return a.id;
    }
  }
  return -1;
}

/** Distance from (px,py) to the segment (x0,y0)-(x1,y1). Mirrors Rust's
 *  `point_segment_distance`. A zero-length segment degenerates to point
 *  distance rather than dividing by zero. */
export function pointSegmentDistance(
  px: number,
  py: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x0, py - y0);
  let t = ((px - x0) * dx + (py - y0) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

/**
 * Port of `shape_annotation_at` (annotations.rs:1188).
 *
 * Kind codes: 2 = line, 4 = arrow (distance to segment); 6 = polyline
 * (distance to any segment); everything else — rect, circle, handCircle, pin,
 * and bézier (kind 7, which the Rust also does not special-case here) — uses a
 * padded bounding box. Padding is `max(stroke_width / 2, 6)`, plus 4 for the
 * stroked kinds, exactly as Rust computes it.
 */
export function shapeAnnotationAt(
  shapes: readonly ShapeHitGeometry[],
  x: number,
  y: number,
): number {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    const pad = Math.max(s.stroke_width * 0.5, 6);
    let hit: boolean;
    if (s.kind === 2 || s.kind === 4) {
      hit = pointSegmentDistance(x, y, s.x0, s.y0, s.x1, s.y1) <= pad + 4;
    } else if (s.kind === 6) {
      const pts = s.points ?? [];
      hit = false;
      for (let j = 0; j + 1 < pts.length; j++) {
        const a = pts[j];
        const b = pts[j + 1];
        if (pointSegmentDistance(x, y, a[0], a[1], b[0], b[1]) <= pad + 4) {
          hit = true;
          break;
        }
      }
    } else {
      const minx = Math.min(s.x0, s.x1) - pad;
      const maxx = Math.max(s.x0, s.x1) + pad;
      const miny = Math.min(s.y0, s.y1) - pad;
      const maxy = Math.max(s.y0, s.y1) + pad;
      hit = x >= minx && x <= maxx && y >= miny && y <= maxy;
    }
    if (hit) return s.id;
  }
  return -1;
}

/** What a cross-layer probe found, or null for genuinely empty canvas. */
export interface ForeignHit {
  /** Index into the layer stack, bottom → top — the same index
   *  `get_layer_text_annotations` takes. */
  layerIndex: number;
  /** Layer's display name, for the "it's on another layer" affordance. */
  layerName: string;
  id: number;
  kind: "text" | "shape";
}

/** The engine surface this module needs. Narrow on purpose: it keeps the
 *  module unit-testable with a plain object and documents exactly which engine
 *  calls a click now costs. */
export interface LayerAnnotationSource {
  get_layers(): string | Promise<string>;
  get_layer_text_annotations(index: number): string | Promise<string>;
  get_layer_shape_annotations(index: number): string | Promise<string>;
}

interface LayerInfoLite {
  id: number;
  name: string;
  visible: boolean;
  active: boolean;
}

const parse = <T,>(raw: string): T[] => {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
};

/**
 * Is there an annotation under (x, y) on some layer OTHER than the active one?
 *
 * Only VISIBLE layers count. A hidden layer's ink is not on screen, so a click
 * through the space where it would be is a click on empty canvas and must
 * still create a new text — suppressing there would be a dead zone the user
 * cannot see or explain.
 *
 * Searches top → bottom so the answer names the layer a user would say they
 * clicked, and reports the topmost hit rather than the first found.
 */
export async function findForeignAnnotation(
  tool: LayerAnnotationSource,
  x: number,
  y: number,
): Promise<ForeignHit | null> {
  const layers = parse<LayerInfoLite>(await tool.get_layers());
  // Top of the stack is the END of the array (get_layers is bottom → top).
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer.active || !layer.visible) continue;
    const texts = parse<TextHitGeometry>(
      await tool.get_layer_text_annotations(i),
    );
    const tId = textAnnotationAt(texts, x, y);
    if (tId >= 0) {
      return { layerIndex: i, layerName: layer.name, id: tId, kind: "text" };
    }
    const shapes = parse<ShapeHitGeometry>(
      await tool.get_layer_shape_annotations(i),
    );
    const sId = shapeAnnotationAt(shapes, x, y);
    if (sId >= 0) {
      return { layerIndex: i, layerName: layer.name, id: sId, kind: "shape" };
    }
  }
  return null;
}
