// ADR-024 a11.0 — the last OPEN-B gap: a REAL ENGINE inside a
// transferred-canvas worker.
//
// WHAT HAS AND HAS NOT BEEN RUN. Phase 3 (`engine.worker.js`) booted wasm in a
// worker and measured a round trip. OPEN-B (`open-b.worker.js`) transferred a
// canvas to a worker and drew to it with plain 2D calls. NOTHING has held both
// at once — `docs/engine-worker-open-b-finding.md` names that as the one
// remaining gap, and it is the last thing that could invalidate Option A before
// a12.
//
// WHY IT MATTERS THAT THEY ARE IN THE SAME WORKER. Option A's whole argument
// over B is that the worker draws DIRECTLY to the canvas, so the 48 MB
// composite never crosses a postMessage boundary. That has been asserted from
// structure and never once measured. The `flushMs` number below is that
// measurement, and it is also Stage 5's baseline.
import init, { ImageHorseTool } from "../pkg/stamp_tool.js";

let tool = null;
let canvas = null;
let ctx = null;
let imageData = null; // reused across flushes; allocating per flush would measure the allocator

function reply(msg, transfer = []) {
  self.postMessage(msg, transfer);
}

/**
 * The Option A flush: engine pixels straight onto the transferred canvas.
 *
 * Mirrors `useEngineCore.flushToCanvas`'s fallback path — `get_image_data()`
 * then `putImageData` — minus the boundary crossing, which is the entire point.
 * The zero-copy `data_ptr`/`data_len` path is deliberately NOT used here: it is
 * the faster of the two and measuring it would flatter the result. This is the
 * slow path, in the worker, which is the honest lower bound.
 */
function flush() {
  const t0 = performance.now();
  const view = tool.get_image_data(); // a view into wasm linear memory
  const tRead = performance.now();

  const w = canvas.width;
  const h = canvas.height;
  if (!imageData || imageData.width !== w || imageData.height !== h) {
    imageData = new ImageData(w, h);
  }
  imageData.data.set(view);
  const tCopy = performance.now();

  ctx.putImageData(imageData, 0, 0);
  const tPut = performance.now();

  return {
    readMs: tRead - t0,
    copyMs: tCopy - tRead,
    putMs: tPut - tCopy,
    totalMs: tPut - t0,
    bytes: view.length,
  };
}

self.onmessage = async (e) => {
  const d = e.data;
  try {
    switch (d.type) {
      case "init": {
        // ORDER MATTERS AND IS UNDER TEST. The canvas is adopted FIRST, then
        // wasm boots in the same worker. If instantiating a wasm module were
        // going to disturb an already-transferred surface, this is the order
        // that would show it.
        canvas = d.canvas;
        ctx = canvas.getContext("2d", { desynchronized: true });
        canvas.width = d.w;
        canvas.height = d.h;

        const t0 = performance.now();
        await init();
        const tWasm = performance.now();

        tool = new ImageHorseTool(d.w, d.h);
        // A recognisable image: a red field the probe can verify arrived, not a
        // uniform grey that would pass even if nothing were drawn.
        const px = new Uint8Array(d.w * d.h * 4);
        for (let i = 0; i < px.length; i += 4) {
          px[i] = 220; px[i + 1] = 40; px[i + 2] = 40; px[i + 3] = 255;
        }
        tool.load_image(px);
        const tLoad = performance.now();

        reply({
          type: "init:done",
          wasmMs: tWasm - t0,
          loadMs: tLoad - tWasm,
          // The attribute survives the round trip only if the context is real.
          desynchronized: ctx.getContextAttributes
            ? ctx.getContextAttributes().desynchronized
            : "unavailable",
          canvasW: canvas.width,
          canvasH: canvas.height,
        });
        break;
      }

      case "flush": {
        // Warm once, then measure — the first call pays for lazy paths in both
        // wasm and the canvas implementation and would not be the steady-state
        // number Stage 5 needs.
        flush();
        const runs = [];
        for (let i = 0; i < (d.runs || 5); i++) runs.push(flush());
        const med = (k) => {
          const v = runs.map((r) => r[k]).sort((a, b) => a - b);
          return v[Math.floor(v.length / 2)];
        };
        reply({
          type: "flush:done",
          medianTotalMs: med("totalMs"),
          medianReadMs: med("readMs"),
          medianCopyMs: med("copyMs"),
          medianPutMs: med("putMs"),
          bytes: runs[0].bytes,
          megapixels: (canvas.width * canvas.height) / 1e6,
          runs: runs.map((r) => +r.totalMs.toFixed(2)),
        });
        break;
      }

      case "op": {
        // A real cold-path engine operation, then a flush — the sequence Stage 5
        // measures against the 470 ms main-thread freeze.
        const t0 = performance.now();
        tool.adjust_sharpen(d.amount ?? 50);
        const tOp = performance.now();
        const f = flush();
        reply({
          type: "op:done",
          opMs: tOp - t0,
          flushMs: f.totalMs,
          totalMs: performance.now() - t0,
        });
        break;
      }

      case "probe": {
        // Read the canvas back INSIDE the worker. The engine's pixels are red;
        // OPEN-B's plain-2D harness painted blue. If this reads blue or empty,
        // the engine's output never reached the transferred surface.
        const p = ctx.getImageData(5, 5, 1, 1).data;
        reply({
          type: "probe:done",
          px: `rgba(${p[0]},${p[1]},${p[2]},${p[3]})`,
          enginePixelsPresent: p[3] === 255 && p[0] > 180 && p[1] < 90 && p[2] < 90,
        });
        break;
      }

      case "resize": {
        // The assignment the main thread can no longer make after transfer.
        canvas.width = d.w;
        canvas.height = d.h;
        tool.resize(d.w, d.h);
        const f = flush();
        reply({ type: "resize:done", w: canvas.width, h: canvas.height, flushMs: f.totalMs });
        break;
      }

      case "mem": {
        // wasm linear memory for THIS worker's engine. The flip window can have
        // a main-thread engine and a worker engine alive at once; this is the
        // worker's half of that bill.
        const mod = await import("../pkg/stamp_tool.js");
        const bytes = mod.__wasm?.memory?.buffer?.byteLength ?? null;
        reply({ type: "mem:done", wasmBytes: bytes });
        break;
      }

      case "dispose": {
        tool?.free();
        tool = null;
        reply({ type: "dispose:done" });
        break;
      }
    }
  } catch (err) {
    reply({ type: "error", stage: d.type, message: String((err && err.stack) || err) });
  }
};
