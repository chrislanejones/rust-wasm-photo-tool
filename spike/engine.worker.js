// Phase 3 spike — THROWAWAY. Not wired into the app, not a protocol design.
//
// One cold-path operation running inside a Web Worker with its own wasm
// instance. Exists to produce one number: what does a postMessage round-trip
// cost against the synchronous call we make today?
//
// `adjust_sharpen` was chosen over the brush-shaped blur: it is a whole-layer
// unsharp mask, so it is genuinely cold-path and its cost scales with the photo
// rather than with a brush radius. `blur_region` is a stroke primitive and
// would have measured the wrong thing.
//
// Deliberately minimal: no queueing, no cancellation, no error protocol beyond
// an echo. Those belong to the real migration, and leaving them out here keeps
// the number honest rather than flattering.
import init, { ImageHorseTool } from "../pkg/stamp_tool.js";

let tool = null;
let ready = false;

self.onmessage = async (e) => {
  const { type, id } = e.data;
  try {
    if (type === "init") {
      const t0 = performance.now();
      if (!ready) {
        await init();
        ready = true;
      }
      self.postMessage({ type: "init:done", id, ms: performance.now() - t0 });
      return;
    }

    if (type === "load") {
      // rgba arrives as a transferable — no structured-clone copy inbound.
      const { rgba, width, height } = e.data;
      const t0 = performance.now();
      tool = new ImageHorseTool(width, height);
      tool.load_image(new Uint8Array(rgba));
      self.postMessage({ type: "load:done", id, ms: performance.now() - t0 });
      return;
    }

    if (type === "op") {
      const { amount } = e.data;
      const t0 = performance.now();
      tool.adjust_sharpen(amount);
      const tOp = performance.now();
      // get_image_data() is a view over wasm linear memory; it must be copied
      // before transfer. That copy is part of the worker's real cost and is
      // measured, not hidden.
      const view = tool.get_image_data();
      const copy = new Uint8Array(view).buffer;
      const tCopy = performance.now();
      self.postMessage(
        {
          type: "op:done",
          id,
          rgba: copy,
          opMs: tOp - t0,
          copyMs: tCopy - tOp,
        },
        [copy], // transferable — moved, not cloned
      );
      return;
    }
  } catch (err) {
    self.postMessage({ type: "error", id, message: String((err && err.message) || err) });
  }
};
