// The op log's coverage of a document, as `autosaveDelayMs` reads it. Only the
// type survives: its producer (the Diagnostics window's per-frame sampler) was
// removed on 10-14-2026, and it had never run with that window closed anyway.
// See PARKING_LOT "a cheap op-log coverage read for the autosave lane".

export interface OplogStats {
  /** False = the op-log functions are NOT IN THIS WASM BUILD (the v7.28 bug —
   *  see ADR-017). Reported loudly rather than hidden: an absent feature and an
   *  idle one look identical on a counter, and that cost a day. */
  supported: boolean;
  active: boolean;
  broken: boolean;
  ops: number;
  cursor: number;
  keyframes: number;
  undoEnabled: boolean;
  /** WHY it is (not) recording, in one phrase, straight from the engine. */
  status: string;
  /** The layer an edit would land on. "Canvas" ⇒ nothing will record. */
  activeLayer: string;
  layers: number;
  /** The count that decides op-log scope: the Canvas is NOT counted (ADR-016). */
  contentLayers: number;
}
