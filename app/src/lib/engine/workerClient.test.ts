// ADR-024 Stage 3 — the protocol's four promises, asserted.
//
// The Phase 3 spike had none of request ids, queueing, cancellation or errors,
// and the feasibility doc said so: "a real implementation adds all four. They
// cost complexity, not milliseconds." This is the complexity, tested.
//
// A FAKE WORKER, deliberately. The real `engine.worker.ts` boots wasm, which
// vitest's node environment has no business doing — and it would test the
// engine, not the protocol. What has to be right here is ordering, id
// matching, cancellation and error propagation, all of which live on the
// CLIENT side. The fake answers like the real worker and lets a test control
// timing precisely, which a real worker cannot.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EngineWorkerClient } from "@/lib/engine/workerClient";

interface Sent { kind: string; id?: number; method?: string; args?: unknown[] }

/** Stands in for the Worker the client constructs. Records what it is sent and
 *  replies only when the test says so, so ordering is observable. */
class FakeWorker {
  static latest: FakeWorker | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  listeners: ((e: MessageEvent) => void)[] = [];
  sent: Sent[] = [];
  terminated = false;

  constructor() { FakeWorker.latest = this; }

  postMessage(msg: Sent) {
    this.sent.push(msg);
    // The real worker answers `init` immediately with id 0.
    if (msg.kind === "init") queueMicrotask(() => this.emit({ id: 0, ok: true }));
  }
  addEventListener(_t: string, fn: (e: MessageEvent) => void) { this.listeners.push(fn); }
  removeEventListener(_t: string, fn: (e: MessageEvent) => void) {
    this.listeners = this.listeners.filter((l) => l !== fn);
  }
  terminate() { this.terminated = true; }

  /** Deliver a reply, exactly as the worker's postMessage would. */
  emit(data: unknown) {
    const e = { data } as MessageEvent;
    this.onmessage?.(e);
    for (const l of [...this.listeners]) l(e);
  }
  /** The calls the client has queued, in the order it sent them. */
  calls() { return this.sent.filter((s) => s.kind === "call"); }
}

beforeEach(() => {
  vi.stubGlobal("Worker", FakeWorker as unknown as typeof Worker);
  FakeWorker.latest = null;
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

async function started() {
  const c = new EngineWorkerClient();
  await c.init(100, 100);
  return { c, w: FakeWorker.latest! };
}

describe("request ids", () => {
  it("gives every call a distinct id", async () => {
    const { c, w } = await started();
    void c.call("width"); void c.call("height"); void c.call("layer_count");
    expect(w.calls().map((x) => x.id)).toEqual([1, 2, 3]);
  });

  it("routes each reply to its own caller, even out of order", async () => {
    const { c, w } = await started();
    const a = c.call("width");
    const b = c.call("height");
    // Answer the SECOND first — the id, not arrival, decides who gets what.
    w.emit({ id: 2, ok: true, value: 600 });
    w.emit({ id: 1, ok: true, value: 800 });
    expect(await a).toBe(800);
    expect(await b).toBe(600);
  });

  it("ignores a reply for an id it does not know", async () => {
    const { c, w } = await started();
    const p = c.call("width");
    expect(() => w.emit({ id: 999, ok: true, value: 1 })).not.toThrow();
    w.emit({ id: 1, ok: true, value: 42 });
    expect(await p).toBe(42);
  });
});

describe("ordering — the op log's correctness rests on this", () => {
  it("sends calls in the order they were made", async () => {
    const { c, w } = await started();
    // `OpLog::append` records ARRIVAL order and no Op carries a sequence
    // number, so postMessage order IS append order. If this list ever comes
    // back reordered, undo stops reproducing — silently.
    for (const m of ["a", "b", "c", "d", "e"]) void c.call(m);
    expect(w.calls().map((x) => x.method)).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("cancellation", () => {
  it("withdraws a queued call by id", async () => {
    const { c, w } = await started();
    void c.call("slow");
    c.cancel(1);
    expect(w.sent.filter((s) => s.kind === "cancel").map((s) => s.id)).toEqual([1]);
  });

  it("rejects and withdraws a call that times out", async () => {
    vi.useFakeTimers();
    const c = new EngineWorkerClient();
    const initP = c.init(10, 10);
    await vi.advanceTimersByTimeAsync(1);
    await initP;
    const w = FakeWorker.latest!;
    const p = c.call("never_answers");
    const assertion = expect(p).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(31_000);
    await assertion;
    // A timed-out request must also leave the QUEUE — otherwise it runs later
    // against a document that has moved on, which is worse than not running.
    expect(w.sent.filter((s) => s.kind === "cancel").map((s) => s.id)).toEqual([1]);
  });
});

describe("errors", () => {
  it("rejects with the engine's message, naming the method", async () => {
    const { c, w } = await started();
    const p = c.call("explode");
    w.emit({ id: 1, ok: false, error: "index out of bounds" });
    await expect(p).rejects.toThrow(/explode: index out of bounds/);
  });

  it("rejects every pending call when the worker crashes", async () => {
    const { c, w } = await started();
    const a = c.call("one"), b = c.call("two");
    w.onerror?.();
    // The failure this guards: a dead worker never answers, so without this
    // every caller awaits forever and the app stops responding to edits with
    // nothing in the console.
    await expect(a).rejects.toThrow(/crashed/);
    await expect(b).rejects.toThrow(/crashed/);
  });

  it("rejects pending calls on dispose, and terminates", async () => {
    const { c, w } = await started();
    const p = c.call("pending");
    c.dispose();
    await expect(p).rejects.toThrow(/disposed/);
    expect(w.terminated).toBe(true);
    expect(c.ready).toBe(false);
  });
});

describe("measurement", () => {
  it("accumulates the engine time Stage 5 will compare against", async () => {
    const { c, w } = await started();
    const a = c.call("sharpen");
    w.emit({ id: 1, ok: true, value: null, ms: 470 });
    await a;
    const b = c.call("blur");
    w.emit({ id: 2, ok: true, value: null, ms: 30 });
    await b;
    expect(c.engineMs).toBe(500);
  });
});
