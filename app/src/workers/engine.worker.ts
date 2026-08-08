// ADR-024 Stage 3 — the engine's worker half.
//
// Owns its OWN wasm instance and its own `ImageHorseTool`. Nothing is shared
// with the main thread: no `SharedArrayBuffer`, no COOP/COEP, no wasm threads
// (Phase 0 measured that none of it is needed, and this project already tried
// and rejected wasm threads at 8–31× slower).
//
// STATUS: not wired into the app. `ih_engine_worker` defaults OFF and the 121
// synchronous reads have not been converted yet (Stage 3.5) — until they are,
// nothing can call this in anger. It exists so the protocol is real and
// testable rather than sketched.
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

export interface EngineRequest {
  /** Monotonic per-port. Echoed back so a reply cannot be mismatched. */
  id: number;
  /** Method name on `ImageHorseTool`. */
  method: string;
  args: unknown[];
  /** Transferables the caller handed over; already detached on this side. */
  transfer?: Transferable[];
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

self.onmessage = async (e: MessageEvent) => {
  const d = e.data as
    | { kind: "init"; width: number; height: number }
    | { kind: "cancel"; id: number }
    | { kind: "dispose" }
    | ({ kind: "call" } & EngineRequest);

  switch (d.kind) {
    case "init": {
      const mod = await import("stamp_tool");
      await mod.default();
      tool = new mod.ImageHorseTool(d.width, d.height);
      ready = true;
      reply({ id: 0, ok: true, value: { ready } });
      break;
    }

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
      queue.length = 0;
      cancelled.clear();
      break;

    case "call":
      queue.push(d);
      void drain();
      break;
  }
};
