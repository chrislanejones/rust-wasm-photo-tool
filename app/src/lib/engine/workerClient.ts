// ADR-024 — the main-thread half of the engine port. THE DEFAULT since v8.32.
//
// One client, one worker, one queue. `lib/engine/port.ts` swaps this in via
// `createLiveEngine` for every document unless `ih_engine_worker=0` opts the
// tab out (a14, 2026-08-13). One worker per tab, documents replaced inside it
// with `reinit` — the surface transfers once per element, so the worker that
// holds it is never rebuilt (v8.28).
//
// (Until v8.32 this header said the client was "not swapped in" because the
// flag defaulted OFF — true for eighteen releases while the arc shipped dark,
// and the kind of claim that rots the moment a default flips. The conversion
// history it used to carry lives in ADR-024's ledger, where it has dates.)
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
import { rehydrateCapture } from "./captureMarshal";

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

  /** ADR-024 a12.0 — the method names the worker's engine actually has,
   *  enumerated from its prototype at init and reported back.
   *
   *  The main-thread handle is a Proxy, and it must NOT answer `typeof
   *  t.anything === "function"` with a function: four live feature detections
   *  (`hasPatchmatchExports`, `hasTilesExports`, `hasMagicEraserExports`,
   *  `hasPersistExports`) decide whether a whole subsystem is available by
   *  asking exactly that. Gating the proxy on this set keeps `typeof` answering
   *  what it answers today.
   *
   *  Empty until `init()` resolves. Reported by the engine rather than listed
   *  here on purpose — a hand-maintained copy of this surface is precisely what
   *  drifted by 31 methods and cost the migration ten releases of wrong
   *  numbers. */
  surface: ReadonlySet<string> = new Set();

  /**
   * ADR-024 a12.5 — replace the DOCUMENT without replacing the worker.
   *
   * The worker owns the `OffscreenCanvas`, and an element yields one exactly
   * once. Tearing the worker down to load a second photo therefore strands the
   * canvas for the rest of that element's life — a blank editor with a correct
   * thumbnail and nothing in the console. `createLiveEngine` calls this instead
   * of building a second client; the whole reasoning is on the worker's
   * `reinit` case.
   *
   * Pending calls belong to the outgoing document and are rejected here, for
   * the same reason `dispose` rejects them: a caller awaiting a reply that can
   * never come is worse than a caller told the document changed.
   */
  async reinit(width: number, height: number): Promise<void> {
    const w = this.worker;
    if (!w) return this.init(width, height);
    this.failAll("engine document replaced");
    await this.handshake(w, { kind: "reinit", width, height });
  }

  /** ADR-024 a12.5 — drop the document, keep the worker and its surface.
   *  Paired with `reset()` on the main thread, which wants a blank canvas and a
   *  released engine but must not destroy a surface it cannot re-acquire. */
  releaseEngine(): void {
    this.failAll("engine released");
    this.initialised = false;
    this.worker?.postMessage({ kind: "release" });
  }

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

    await this.handshake(w, { kind: "init", width, height });
  }

  /** The `id: 0` handshake, shared by `init` and `reinit` — one reply, one
   *  timeout, one place that decides the client is usable. Two copies of this
   *  would be two places for `initialised` to drift from the truth. */
  private handshake(w: Worker, msg: Record<string, unknown>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("engine worker did not start")), 10_000);
      const once = (e: MessageEvent<EngineReply>) => {
        if (e.data.id !== 0) return;
        clearTimeout(t);
        w.removeEventListener("message", once);
        if (!e.data.ok) {
          reject(new Error(e.data.error ?? "engine worker failed to start"));
          return;
        }
        const v = e.data.value as { ready?: boolean; surface?: string[] } | undefined;
        // An older worker (or a fake in a test) may not report a surface. Leave
        // the set empty rather than inventing one: an empty surface makes the
        // proxy expose nothing, which fails LOUDLY at the first call instead of
        // quietly forwarding a method the engine may not have.
        if (v?.surface) this.surface = new Set(v.surface);
        this.initialised = true;
        resolve();
      };
      w.addEventListener("message", once);
      w.postMessage(msg);
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

  /**
   * ADR-024 a12.2 — ask the worker to draw the composite onto its canvas.
   *
   * Fire-and-forget: no request id, no reply, nothing awaited. `flushToCanvas`
   * is the per-frame path, and putting a round trip on it is the regression
   * this arc exists to remove — a11.0 measured the flush at 22 ms and it is not
   * free even in-worker.
   *
   * Not a `call()`: that machinery exists to match replies to requests and to
   * order MUTATIONS, and a blit is neither. Sending it outside the queue also
   * means it cannot be delayed behind pending work — the picture should be as
   * fresh as possible, not consistent with a particular op.
   */
  blit(): void {
    this.worker?.postMessage({ kind: "blit" });
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
    // ADR-024 a12.4 — a flattened capture gets its shape back here, including
    // the no-op `free()` its twelve call sites all call. Doing it at the seam is
    // what keeps those call sites identical across the two implementations;
    // `lib/engine/captureMarshal.ts` has the full reasoning.
    if (r.ok) p.resolve(r.capture ? rehydrateCapture(r.value) : r.value);
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
