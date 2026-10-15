// One draw per burst — the worker's blit coalescing, kept out of
// `engine.worker.ts` so it can be tested without booting wasm.
//
// A blit recomposites EVERY layer at full size — five 3759×1304 layers is
// hundreds of ms — and the opacity slider sends one per input event. Run back
// to back, a 3 s drag queued 9 s of draws the user had to sit through after
// letting go (measured 10-15-2026). Every queued blit after the first only
// repaints a state a later one repaints again, so they collapse: the first
// schedules a draw, the rest find it already owed.
//
// The draw still happens before any call that could read the composite cache
// it refreshes (magic wand seeds, lasso, Smart Brush and the histogram all read
// `composite_cache` without recompositing). `beforeCall` flushes it unless the
// method is in `BLIT_CAN_WAIT_FOR`, so a method missing from that list only
// costs the old, uncoalesced behavior — never a stale read.

/** Calls that neither read the composite cache nor need the canvas drawn
 *  first: the per-tick state reads `syncState` and the layer revision fire,
 *  plus the layer-property setters a slider drag sends. All `&self` reads or
 *  plain field writes engine-side. */
export const BLIT_CAN_WAIT_FOR: ReadonlySet<string> = new Set([
  "capture_ui_state",
  "photo_bounds",
  "oplog_is_broken",
  "content_layer_count",
  "get_shape_annotations",
  "get_text_annotations",
  "set_layer_opacity",
  "set_layer_visible",
]);

export interface BlitCoalescer {
  /** A blit message arrived: draw soon, once, however many arrive first. */
  request(): void;
  /** Called before every engine call: draws now if one is owed and `method`
   *  might read what the draw refreshes. */
  beforeCall(method: string): void;
}

export function createBlitCoalescer(
  draw: () => void,
  schedule: (fn: () => void) => void = (fn) => setTimeout(fn, 0),
): BlitCoalescer {
  let pending = false;
  const flush = () => {
    if (!pending) return;
    pending = false;
    draw();
  };
  return {
    request() {
      if (pending) return;
      pending = true;
      schedule(flush);
    },
    beforeCall(method) {
      if (pending && !BLIT_CAN_WAIT_FOR.has(method)) flush();
    },
  };
}
