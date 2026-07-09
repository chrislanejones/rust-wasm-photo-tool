// Shared types for the OpenRaster (.ora) export/import module. See
// docs/OpenRaster-Export-Import.md for the format + the v1 scope this
// implements (flatten annotations on export; name/opacity/visibility survive
// import; layer masks + lossless annotation round-tripping are Phase 3).

/** One <layer> entry as it appears in (or is about to be written to) stack.xml. */
export interface OraLayerMeta {
  name: string;
  /** 0..1, matches the engine's LayerInfo.opacity. */
  opacity: number;
  visible: boolean;
  /** Zip-relative path to this layer's PNG, e.g. "data/layer0.png". */
  src: string;
}

/**
 * The parsed/about-to-be-built shape of stack.xml.
 *
 * `layers` is TOP-FIRST (index 0 = topmost) — the real OpenRaster convention
 * for <stack> child order, and what Krita/GIMP/MyPaint expect. The engine's
 * own layer stack (`get_layers()`, `push_restored_layer`) is bottom-first, so
 * export/import each do one reversal at the boundary — see export.ts/import.ts.
 */
export interface OraStack {
  width: number;
  height: number;
  layers: OraLayerMeta[];
  /**
   * Index into `layers` (top-first) marking Image Horse's active layer, or
   * null if none was marked. This is a non-standard extension
   * (`imagehorse:active="true"` on the <layer> element) — real OpenRaster has
   * no notion of an "active" layer, so foreign .ora files will always parse
   * this as null and import falls back to the topmost layer.
   */
  activeIndex: number | null;
}
