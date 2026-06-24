// Thin wrapper around the Rust `grid_lines` WASM export — the single source of
// grid-layout geometry for the canvas "Rulers & Grids" overlay. Mirrors
// colorParser.ts: the async WASM init is memoized, and a sync handle is cached
// once it resolves so the canvas render loop can compute geometry without an
// await. Returns image-space segments [x1, y1, x2, y2, …]; the canvas projects
// them to screen space.
import type { GridKind } from "@/lib/preferences";

type GridFn = (
  w: number,
  h: number,
  kind: number,
  a: number,
  b: number,
) => Float32Array;

let promise: Promise<GridFn> | null = null;
let syncGrid: GridFn | null = null;

async function load(): Promise<GridFn> {
  const mod = await import("stamp_tool");
  await mod.default();
  syncGrid = mod.grid_lines;
  return mod.grid_lines;
}

/** Load (once) the WASM grid fn; resolves when `gridLinesSync` is ready. */
export function ensureGridGeometry(): Promise<GridFn> {
  if (!promise) promise = load();
  return promise;
}

/** Eagerly load the WASM grid fn so the first overlay render is instant. */
export function warmGridGeometry(): void {
  void ensureGridGeometry().catch(() => {});
}

const KIND_CODE: Record<GridKind, number> = { square: 0, golden: 1, grid: 2 };

export interface GridParams {
  kind: GridKind;
  /** Pixel spacing for the square grid. */
  spacing: number;
  /** Columns / rows for the N×M grid. */
  cols: number;
  rows: number;
}

/**
 * Image-space grid segments [x1,y1,x2,y2,…] for the given params, computed in
 * Rust. Returns an empty array if WASM hasn't loaded yet (callers re-render once
 * it warms) or the image has no size.
 */
export function gridLinesSync(w: number, h: number, p: GridParams): Float32Array {
  if (!syncGrid || w < 1 || h < 1) return new Float32Array(0);
  const a = p.kind === "square" ? Math.max(2, p.spacing) : p.cols;
  return syncGrid(w, h, KIND_CODE[p.kind], a, p.rows);
}
