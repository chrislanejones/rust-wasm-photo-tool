// ADR-024 Stage 3 — the main-thread half of the engine port.
//
// One client, one worker, one queue. `lib/engine/port.ts` is where this gets
// swapped in; today it is not, because `ih_engine_worker` defaults OFF and the
// 166 synchronous reads have not been converted (Stage 3.5). That count comes
// from `scripts/engine-call-audit.mjs`; do not hand-edit it.
//
// WHY NOT COMLINK, when the codec worker uses it. Comlink is the right tool
// there: `codec.worker.ts` holds no state, each call builds its own
// OffscreenCanvas, and concurrent calls are explicitly safe. The engine is the
// opposite — it is one stateful document, and its op log records ARRIVAL
// order with no sequence number in `Op` (src/ops.rs:1004). Correct results in
// an unspecified order is exactly the failure ADR-024 calls "gone silently":
// not a crash, an undo stack that stops reproducing. So the ordering is
// written down here rather than delegated.
import type { EngineReply, EngineRequest } from "@/workers/engine.worker";
import { NO_CANVAS } from "./canvasGeneration";

/** How long a single engine call may take before the caller is told it hung.
 *  A 12MP sharpen measured ~470 ms; 30 s is "the worker died", not "slow". */
const CALL_TIMEOUT_MS = 30_000;

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  method: string;
}

export class EngineWorkerClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private initialised = false;

  /** Total engine ms as reported by the worker. Stage 5 compares this against
   *  the main thread's blocked time — the flip is gated on a measurement, not
   *  on the architecture being right. */
  engineMs = 0;

  async init(width: number, height: number): Promise<void> {
    if (this.worker) this.dispose();
    const w = new Worker(new URL("../../workers/engine.worker.ts", import.meta.url), {
      type: "module",
    });
    w.onmessage = (e: MessageEvent<EngineReply>) => this.onReply(e.data);
    // A worker that fails to construct or throws at module scope never answers.
    // Rejecting every pending call is the difference between a visible error
    // and an app that quietly stops responding to edits.
    w.onerror = () => this.failAll("engine worker crashed");
    w.onmessageerror = () => this.failAll("engine worker sent an unreadable message");
    this.worker = w;

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("engine worker did not start")), 10_000);
      const once = (e: MessageEvent<EngineReply>) => {
        if (e.data.id !== 0) return;
        clearTimeout(t);
        w.removeEventListener("message", once);
        this.initialised = true;
        resolve();
      };
      w.addEventListener("message", once);
      w.postMessage({ kind: "init", width, height });
    });
  }

  get ready(): boolean {
    return this.initialised && !!this.worker;
  }

  /**
   * Call an engine method. Resolves with its return value.
   *
   * Ordering is guaranteed by construction: `postMessage` on one port is FIFO
   * and the worker drains one request at a time, so calls execute in the order
   * they were made here. That is the property the op log needs — see the note
   * at the top of the file.
   */
  call<T = unknown>(
    method: string,
    args: unknown[] = [],
    transfer: Transferable[] = [],
    /** ADR-024 a11.2 — pass the canvas generation this call is aimed at, and
     *  ONLY for canvas-targeted work. Omit it for everything that does not
     *  touch the drawing surface, which is nearly everything; tagging those
     *  would add a failure mode without adding a guarantee. A stale value is
     *  rejected by the worker, not skipped. */
    canvasGeneration?: number,
  ): Promise<T> {
    if (!this.worker) return Promise.reject(new Error("engine worker not started"));
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        // Withdraw it from the queue too — a timed-out request that is still
        // waiting would otherwise run later against a document that has moved
        // on, which is worse than not running at all.
        this.worker?.postMessage({ kind: "cancel", id });
        reject(new Error(`engine call timed out after ${CALL_TIMEOUT_MS}ms: ${method}`));
      }, CALL_TIMEOUT_MS);
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer, method });
      const req: EngineRequest & { kind: "call" } = { kind: "call", id, method, args };
      if (canvasGeneration !== undefined) req.canvasGeneration = canvasGeneration;
      this.worker!.postMessage(req, transfer);
    });
  }

  /**
   * Tell the worker which canvas element is live — ADR-024 a11.2.
   *
   * Call this on every canvas mount, with the generation from
   * `lib/engine/canvasIdentity.ts`. a12 will additionally hand over the
   * transferred `OffscreenCanvas` here; until then only the number moves, which
   * is enough for the worker to refuse work aimed at an element that is gone.
   *
   * Not batched with `call`: this is a statement about which surface exists,
   * not a request, and it must not queue behind pending work — the whole point
   * is that the worker learns the old element died BEFORE it drains anything
   * else aimed at it.
   */
  setCanvas(generation: number, canvas?: OffscreenCanvas): void {
    if (!this.worker) return;
    if (generation === NO_CANVAS) {
      // Detach: nothing is live, so every canvas-targeted call is now stale.
      this.worker.postMessage({ kind: "canvas", generation: NO_CANVAS });
      return;
    }
    this.worker.postMessage(
      { kind: "canvas", generation, canvas },
      canvas ? [canvas] : [],
    );
  }

  /** Withdraw a queued call. No effect once it has entered the engine — wasm
   *  is synchronous once entered, so this bounds the queue, not the operation. */
  cancel(id: number): void {
    this.worker?.postMessage({ kind: "cancel", id });
  }

  private onReply(r: EngineReply) {
    if (r.id === 0) return; // init handshake, handled in init()
    const p = this.pending.get(r.id);
    if (!p) return; // already timed out or cancelled — dropping it is correct
    clearTimeout(p.timer);
    this.pending.delete(r.id);
    if (typeof r.ms === "number") this.engineMs += r.ms;
    if (r.ok) p.resolve(r.value);
    else p.reject(new Error(`${p.method}: ${r.error ?? "unknown engine error"}`));
  }

  private failAll(reason: string) {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error(reason));
    }
    this.pending.clear();
  }

  dispose(): void {
    this.failAll("engine worker disposed");
    this.worker?.postMessage({ kind: "dispose" });
    this.worker?.terminate();
    this.worker = null;
    this.initialised = false;
  }
}
