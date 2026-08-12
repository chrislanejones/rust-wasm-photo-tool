// ADR-024 Stage 3 — the engine's worker half.
//
// Owns its OWN wasm instance and its own `ImageHorseTool`. Nothing is shared
// with the main thread: no `SharedArrayBuffer`, no COOP/COEP, no wasm threads
// (Phase 0 measured that none of it is needed, and this project already tried
// and rejected wasm threads at 8–31× slower).
//
// STATUS: not wired into the app. `ih_engine_worker` defaults OFF — that is now
// the ONLY thing holding it back, because as of v8.19 Stage 3.5 is COMPLETE. It
// exists so the protocol is real and testable rather than sketched.
//
// 91 of the 96 value-consumed reads are converted; the 5 left are the per-frame
// blit, exempt because they dissolve when the canvas moves in here at Stage 4.
// (This comment claimed "121 synchronous reads" — already an undercount when
// written, since the audit could not see aliased calls until 2026-08-08, which
// put the real figure at 166. The 2 pen sites it then listed as outstanding
// landed in v8.19 as a state-machine change: `docs/pen-overlay-async-design.md`.)
// `scripts/engine-call-audit.mjs` prints the numbers — do not hand-count them.
//
// WHAT THE PHASE 3 SPIKE LACKED, and this has:
//   request ids     concurrent calls cannot take each other's answers
//   queueing        FIFO, which is what makes the op log's ordering safe
//   cancellation    a superseded request stops occupying the queue
//   errors          a panic comes back as a rejection, not a hang
//
// The ordering guarantee is the whole reason the queue is explicit rather than
// left to Comlink: `OpLog::append` (src/ops.rs:1004) records ARRIVAL order and
// no `Op` carries a sequence number, so postMessage order IS append order —
// but only while every mutation goes through one port, in order. Comlink would
// give correct results with no ordering promise between concurrent calls.
import type { ImageHorseTool } from "stamp_tool";
import { staleCanvasReason, NO_CANVAS } from "@/lib/engine/canvasGeneration";
import { engineSurfaceOf } from "@/lib/engine/engineSurface";

export interface EngineRequest {
  /** Monotonic per-port. Echoed back so a reply cannot be mismatched. */
  id: number;
  /** Method name on `ImageHorseTool`. */
  method: string;
  args: unknown[];
  /** Transferables the caller handed over; already detached on this side. */
  transfer?: Transferable[];
  /** ADR-024 a11.2 — which canvas element this call is aimed at.
   *
   *  OMITTED for the overwhelming majority of calls, which do not touch the
   *  drawing surface (`width()`, `undo()`, …). Present only for canvas-targeted
   *  work, and then checked against the live generation before the call runs.
   *  See `lib/engine/canvasGeneration.ts` for why a stale one is rejected
   *  rather than skipped. */
  canvasGeneration?: number;
}

export interface EngineReply {
  id: number;
  ok: boolean;
  value?: unknown;
  error?: string;
  /** Wall-clock ms spent inside the engine, for Stage 5's measurement. */
  ms?: number;
}

let tool: ImageHorseTool | null = null;
let ready = false;
/** This worker's own wasm linear memory — the zero-copy blit views it. */
let wasmMemory: WebAssembly.Memory | null = null;
/** Reused ImageData backbuffer, same reasoning as the main thread's. */
let backbuffer: ImageData | null = null;

// ADR-024 a11.2 — which canvas element this worker believes is live.
//
// Set by the `canvas` message, which a12 will also use to carry the transferred
// OffscreenCanvas. Until then it holds a generation and no surface, which is
// enough to make the staleness rule real and testable.
//
// `NO_CANVAS` (0) is the honest starting value: nothing has been attached, so
// any canvas-targeted call is stale by definition rather than accidentally
// matching a default.
let canvasGeneration: number = NO_CANVAS;
let surface: OffscreenCanvas | null = null;
/** The generation `surface` arrived with. `blit()` compares it against the live
 *  generation, which is how a draw aimed at a discarded element is refused
 *  rather than performed into a detached surface. */
let surfaceGeneration: number = NO_CANVAS;

/** Requests accepted but not yet executed, oldest first. */
const queue: EngineRequest[] = [];
/** Ids the caller withdrew before they ran. */
const cancelled = new Set<number>();
let draining = false;

function reply(msg: EngineReply, transfer: Transferable[] = []) {
  (self as unknown as Worker).postMessage(msg, transfer);
}

/**
 * Drain the queue strictly in order.
 *
 * `while` rather than recursion, and one drain at a time via `draining`: two
 * overlapping drains would interleave and the FIFO guarantee — the thing the
 * op log's correctness rests on — would be gone without anything failing.
 */
async function drain() {
  if (draining) return;
  draining = true;
  try {
    while (queue.length) {
      const req = queue.shift()!;
      if (cancelled.delete(req.id)) {
        reply({ id: req.id, ok: false, error: "cancelled" });
        continue;
      }
      if (!tool) {
        reply({ id: req.id, ok: false, error: "engine not initialised" });
        continue;
      }
      // ADR-024 a11.2 — refuse work aimed at a canvas that is gone.
      //
      // Before the transfer this can only fire if a caller tags a call with a
      // generation, which nothing does yet. After it, this is what stops the
      // worker painting into a detached surface while the user watches a blank
      // element. REPLYING is the point: skipping the call would reproduce the
      // silent blank it exists to prevent.
      const stale = staleCanvasReason(req.canvasGeneration, canvasGeneration);
      if (stale !== null) {
        reply({ id: req.id, ok: false, error: stale });
        continue;
      }

      const fn = (tool as unknown as Record<string, unknown>)[req.method];
      if (typeof fn !== "function") {
        reply({ id: req.id, ok: false, error: `no such engine method: ${req.method}` });
        continue;
      }
      const t0 = performance.now();
      try {
        const value = (fn as (...a: unknown[]) => unknown).apply(tool, req.args);
        // A returned view into wasm memory must be COPIED before it leaves:
        // postMessage of a Uint8Array backed by wasm memory would either clone
        // the whole heap or detach memory the engine still owns.
        const safe =
          value instanceof Uint8Array || value instanceof Uint32Array
            ? value.slice()
            : value;
        reply({ id: req.id, ok: true, value: safe, ms: performance.now() - t0 });
      } catch (err) {
        // A Rust panic arrives here as a thrown JS error. Replying with it is
        // what stops a caller awaiting forever — the failure mode the spike
        // had no answer for.
        reply({
          id: req.id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          ms: performance.now() - t0,
        });
      }
    }
  } finally {
    draining = false;
  }
}

/**
 * ADR-024 a12.2 — the blit, worker-side.
 *
 * This is the operation that could not be converted and had to MOVE. On the
 * main thread it reads `data_ptr()`/`data_len()` and views the engine's linear
 * memory directly; those are indices into an address space, not values, so
 * there is no awaiting them across a boundary. With the canvas transferred here
 * the same code runs against THIS thread's memory and never crosses anything.
 *
 * Fire-and-forget by design: no reply, no request id. The caller
 * (`flushToCanvas`) is the per-frame path and must not be ordered against the
 * draw — that round trip is the regression the whole arc exists to remove.
 *
 * ⚠️ NOT ROUTED THROUGH THE QUEUE, deliberately. `drain()` exists to make
 * MUTATIONS arrive in postMessage order, which is what the op log's correctness
 * rests on. A blit mutates nothing; queueing it behind pending work would delay
 * the picture without buying any ordering guarantee. It does mean a blit can
 * overtake a queued mutation and draw a frame that is one op stale — which is
 * exactly what the main thread does today, since `flushToCanvas` paints
 * whatever the engine holds at the moment it runs.
 */
function blit(): void {
  if (!tool || !surface) return;
  // ADR-024 a11.2's rule, applied to the draw half it was built for. The blit
  // carries no request id, so the thing being checked is the SURFACE: is the
  // canvas we hold still the live one? After a remount it is not, and painting
  // into it is invisible.
  if (staleCanvasReason(surfaceGeneration, canvasGeneration) !== null) return;
  const w = tool.width();
  const h = tool.height();
  if (surface.width !== w || surface.height !== h) {
    surface.width = w;
    surface.height = h;
  }
  const ctx = surface.getContext("2d");
  if (!ctx) return;
  tool.recomposite();

  if (wasmMemory) {
    const ptr = tool.data_ptr();
    const len = tool.data_len();
    // The view MUST be rebuilt every call: a `memory.grow()` replaces the
    // backing ArrayBuffer and detaches every earlier view of it. Copy into a
    // private backbuffer before handing it to `putImageData`, for the same
    // reason the main thread does — a desynchronized present reading live wasm
    // memory is the Firefox "garbage after 5-8 strokes" bug.
    const view = new Uint8ClampedArray(wasmMemory.buffer as ArrayBuffer, ptr, len);
    if (!backbuffer || backbuffer.width !== w || backbuffer.height !== h) {
      backbuffer = new ImageData(w, h);
    }
    if (view.length === backbuffer.data.length) {
      backbuffer.data.set(view);
      ctx.putImageData(backbuffer, 0, 0);
      return;
    }
  }
  // Fallback: copy the composite out of the engine. Correct but allocates a
  // full frame; reaching it every frame means `wasmMemory` was lost.
  const composed = tool.get_image_data();
  ctx.putImageData(new ImageData(new Uint8ClampedArray(composed), w, h), 0, 0);
}

self.onmessage = async (e: MessageEvent) => {
  const d = e.data as
    | { kind: "init"; width: number; height: number }
    | { kind: "cancel"; id: number }
    | { kind: "canvas"; generation: number; canvas?: OffscreenCanvas }
    | { kind: "blit" }
    | { kind: "dispose" }
    | ({ kind: "call" } & EngineRequest);

  switch (d.kind) {
    case "init": {
      const mod = await import("stamp_tool");
      // ADR-024 a12.2 — KEEP THE MEMORY HANDLE. `mod.default()`'s exports carry
      // the `WebAssembly.Memory` this worker's engine lives in, and the blit
      // below views it directly. Discarding it (as this did until v8.25) leaves
      // only `get_image_data()`, which copies the whole composite out of wasm on
      // every frame — the regression Option A exists to remove. The main thread
      // keeps the same handle for the same reason (`wasmMemoryRef`).
      const exports = (await mod.default()) as unknown as { memory: WebAssembly.Memory };
      wasmMemory = exports.memory;
      tool = new mod.ImageHorseTool(d.width, d.height);
      ready = true;
      // ADR-024 a12.0 — REPORT THE ENGINE'S OWN SURFACE.
      //
      // The main thread's handle is a Proxy, and a Proxy that answers every
      // `get` with a forwarding function would break every feature detection in
      // the app: `hasPatchmatchExports`, `hasTilesExports`,
      // `hasMagicEraserExports` and `hasPersistExports` all ask
      // `typeof t.someMethod === "function"`, and all four would start
      // answering YES on a build whose wasm has no such method. Those guards
      // are load-bearing — `useMagicEraserTool`'s tile is not itself
      // flag-gated — so the proxy must only expose names that really exist.
      //
      // Enumerated from the prototype rather than from a list, so it cannot
      // drift from the binary. That drift is not hypothetical: a hand-synced
      // `.d.ts` missing 31 methods is what made the migration's own gate
      // understate by 36 sites for ten releases (v8.21).
      // ⚠️ FILTER `free` AS WELL AS `constructor`. A wasm-bindgen prototype
      // carries both, and `free` is the dangerous one: forwarded through the
      // proxy it would let any caller destroy the worker's engine while the
      // main thread still holds a handle it believes is live — every
      // subsequent call would reject against a freed pointer.
      //
      // Nothing calls `tool.free()` today (a13 verified that, and it is the
      // reason `readUiSnapshot` needs a liveness guard at all), so this is
      // latent rather than live. Latent is exactly when to close it: the
      // lifecycle belongs to `dispose`, which the worker already handles.
      const surfaceNames = engineSurfaceOf(Object.getPrototypeOf(tool) as object);
      reply({ id: 0, ok: true, value: { ready, surface: surfaceNames } });
      break;
    }

    case "canvas":
      // a12 will pass the transferred OffscreenCanvas here. Today the surface
      // is absent and only the generation moves, which is deliberate: the rule
      // and its protocol slot exist before the thing they protect, so the
      // transfer cannot land without them.
      // ⚠️ DROP THE SURFACE ON RELEASE. `?? surface` alone keeps the OLD
      // OffscreenCanvas after the element it belonged to is gone, and a later
      // blit paints into it — no throw, and the user watches a blank canvas
      // from an ordinary action. That is the exact failure a11 exists to close,
      // and it survived into a12.2's first cut.
      if (d.generation === NO_CANVAS) {
        surface = null;
        surfaceGeneration = NO_CANVAS;
      } else if (d.canvas) {
        surface = d.canvas;
        surfaceGeneration = d.generation;
      }
      canvasGeneration = d.generation;
      break;

    case "blit":
      blit();
      break;

    case "cancel":
      // Only meaningful before the request is shifted off the queue. A call
      // already inside the engine cannot be interrupted — wasm is synchronous
      // once entered — so this bounds the QUEUE, not the operation.
      cancelled.add(d.id);
      break;

    case "dispose":
      tool?.free();
      tool = null;
      ready = false;
      surface = null;
      canvasGeneration = NO_CANVAS;
      queue.length = 0;
      cancelled.clear();
      break;

    case "call":
      queue.push(d);
      void drain();
      break;
  }
};
