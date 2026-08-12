// ===== FILE: app/src/lib/engine/createLiveEngine.test.ts =====
//
// ADR-024 a12.1 — the swap point.
//
// `createLiveEngine()` replaced `attachLivePort()` as the place the local/worker
// decision is made, because `attachLivePort` receives an engine that has ALREADY
// been built and image-loaded on the main thread and a worker cannot adopt that
// handle (`docs/engine-worker-a12-design.md`).
//
// Two properties are worth pinning, and the second is the one with consequences:
//
//   1. flag OFF  — byte-identical to what the five load paths did before:
//                  construct, load the image, hand back the same object.
//   2. flag ON   — NO LOCAL ENGINE IS CONSTRUCTED. Building on both sides would
//                  mean two engines, two op logs and doubled image memory, which
//                  is precisely what `port.ts`'s ONE PORT PER DOCUMENT invariant
//                  exists to prevent.
import { describe, it, expect, vi, afterEach } from "vitest";
import { createLiveEngine, detachLivePort, liveEnginePort } from "./port";
import type { ImageHorseTool } from "stamp_tool";

/** A Worker stand-in that completes the init handshake and records termination.
 *  Enough of the protocol for `EngineWorkerClient.init()` to resolve. */
function fakeWorkerClass() {
  const instances: { terminated: boolean }[] = [];
  class FakeWorker {
    terminated = false;
    onmessage: ((e: { data: unknown }) => void) | null = null;
    onerror: (() => void) | null = null;
    onmessageerror: (() => void) | null = null;
    private listeners: ((e: { data: unknown }) => void)[] = [];
    constructor() {
      instances.push(this);
    }
    addEventListener(_t: string, fn: (e: { data: unknown }) => void) {
      this.listeners.push(fn);
    }
    removeEventListener(_t: string, fn: (e: { data: unknown }) => void) {
      this.listeners = this.listeners.filter((l) => l !== fn);
    }
    postMessage(msg: { kind?: string; id?: number }, transfer?: Transferable[]) {
      // ⚠️ EMULATE REAL TRANSFER SEMANTICS. A fake `postMessage` that ignores
      // its transfer list makes any "we don't detach the caller's buffer" test
      // VACUOUS — it passes whether or not the code transfers. Found by a
      // mutation run: adding the transfer back survived the suite.
      // `structuredClone` with a transfer list detaches the originals, which is
      // exactly what the real `postMessage` does.
      if (transfer?.length) structuredClone(transfer[0], { transfer });
      if (msg?.kind === "init") {
        queueMicrotask(() => {
          const e = {
            data: { id: 0, ok: true, value: { ready: true, surface: ["load_image", "width"] } },
          };
          for (const l of [...this.listeners]) l(e);
        });
        return;
      }
      // Answer ordinary calls too, or `createLiveEngine` hangs on `load_image`
      // until the client's 30 s timeout — which reads as a failing assertion
      // five seconds later rather than as "the fake is incomplete".
      if (msg?.kind === "call" && typeof msg.id === "number") {
        queueMicrotask(() => {
          this.onmessage?.({ data: { id: msg.id, ok: true, value: null } });
        });
      }
    }
    terminate() {
      this.terminated = true;
    }
  }
  return { FakeWorker, instances };
}

/** A stand-in engine that records what was done to it. */
function fakeToolClass() {
  const built: { width: number; height: number }[] = [];
  const loaded: Uint8Array[] = [];
  class FakeTool {
    constructor(width: number, height: number) {
      built.push({ width, height });
    }
    load_image(px: Uint8Array) {
      loaded.push(px);
    }
  }
  return {
    Tool: FakeTool as unknown as new (w: number, h: number) => ImageHorseTool,
    built,
    loaded,
  };
}

/** `engineWorkerEnabled()` reads localStorage and treats a throw as OFF, so a
 *  node run is off by default. Stub it to drive the ON branch. */
function setFlag(on: boolean) {
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k === "ih_engine_worker" && on ? "1" : null),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  detachLivePort();
});

describe("createLiveEngine — flag OFF (today's path)", () => {
  it("constructs at the given dimensions and loads the pixels", async () => {
    setFlag(false);
    const { Tool, built, loaded } = fakeToolClass();
    const pixels = new Uint8Array([1, 2, 3, 4]);

    const tool = await createLiveEngine({ Tool, width: 640, height: 480, pixels });

    expect(built).toEqual([{ width: 640, height: 480 }]);
    expect(loaded).toEqual([pixels]);
    expect(tool).toBeInstanceOf(Object);
  });

  it("skips load_image when no pixels are given", async () => {
    // The op-log restore path builds a 1×1 placeholder that `oplog_restore`
    // replaces wholesale — loading an image into it first would be wasted work.
    setFlag(false);
    const { Tool, built, loaded } = fakeToolClass();

    await createLiveEngine({ Tool, width: 1, height: 1 });

    expect(built).toEqual([{ width: 1, height: 1 }]);
    expect(loaded).toEqual([]);
  });

  it("hands back the very object it built — the local path stays identity", async () => {
    // `attachLivePort` is still identity, and a13's liveness guard compares the
    // live handle by IDENTITY (`toolRef.current === t`). Wrapping the local
    // engine in anything would silently break that guard.
    setFlag(false);
    const { Tool } = fakeToolClass();
    const a = await createLiveEngine({ Tool, width: 2, height: 2 });
    const b = await createLiveEngine({ Tool, width: 2, height: 2 });
    expect(a).not.toBe(b); // two calls, two engines
    expect(Object.getPrototypeOf(a)).toBe(Object.getPrototypeOf(b));
  });
});

describe("createLiveEngine — flag ON", () => {
  it("does NOT construct a local engine", async () => {
    // THE INVARIANT. Two engines would be two op logs, and `OpLog::append`
    // records arrival order with no sequence number in `Op` — so a second log is
    // not a duplicate, it is a different history.
    //
    // `Worker` does not exist under vitest's node environment, so the worker
    // branch rejects. That is fine and is not what this asserts: what matters is
    // that `Tool` was never called on the way there.
    setFlag(true);
    const { Tool, built, loaded } = fakeToolClass();

    await expect(
      createLiveEngine({
        Tool,
        width: 640,
        height: 480,
        pixels: new Uint8Array([1, 2, 3, 4]),
      }),
    ).rejects.toBeTruthy();

    expect(built, "a local engine was built while the worker flag was ON").toEqual([]);
    expect(loaded).toEqual([]);
  });
});

describe("worker lifecycle — the wasm-memory guard", () => {
  it("terminates the previous worker when a new document is opened", async () => {
    // ⚠️ wasm memory NEVER SHRINKS (a11.0 measured ~75 MB across a flip
    // window). An engine dropped without `terminate()` raises the tab's floor
    // for the rest of the session, and nothing surfaces it — the tab is simply
    // heavier from then on.
    setFlag(true);
    const { FakeWorker, instances } = fakeWorkerClass();
    vi.stubGlobal("Worker", FakeWorker);
    const { Tool } = fakeToolClass();

    await createLiveEngine({ Tool, width: 4, height: 4 });
    await createLiveEngine({ Tool, width: 8, height: 8 });

    expect(instances).toHaveLength(2);
    expect(instances[0].terminated, "the FIRST worker was leaked").toBe(true);
    expect(instances[1].terminated).toBe(false);
  });

  it("detachLivePort terminates the live worker and clears the port", async () => {
    setFlag(true);
    const { FakeWorker, instances } = fakeWorkerClass();
    vi.stubGlobal("Worker", FakeWorker);
    const { Tool } = fakeToolClass();

    await createLiveEngine({ Tool, width: 4, height: 4 });
    expect(liveEnginePort()).not.toBeNull();

    detachLivePort();

    expect(instances[0].terminated, "detach left the worker running").toBe(true);
    expect(liveEnginePort(), "detach left a stale port behind").toBeNull();
  });

  it("does NOT transfer the pixel buffer — it would detach the caller's", async () => {
    // ⚠️ A transferred ArrayBuffer is detached on the SENDER and reads as
    // zero-length afterwards. No throw, no warning.
    //
    // Two of the three callers that supply pixels hand over a VIEW of a buffer
    // they do not own: `loadImageFromPixels` does `new Uint8Array(pixels.buffer)`
    // over its caller's array (four call sites in `useImageSession`), and
    // `restoreFromSaved` wraps `canvasRgba.buffer` from the PNG decode.
    // Transferring would quietly empty an array the caller still holds.
    //
    // The saving is illusory anyway: without a transfer `postMessage`
    // structured-clones the array, which is one copy; copying defensively and
    // then transferring is also one copy. Pinned here because the comment alone
    // did not survive a mutation run — it looked like a free optimisation.
    setFlag(true);
    const { FakeWorker } = fakeWorkerClass();
    vi.stubGlobal("Worker", FakeWorker);
    const { Tool } = fakeToolClass();
    const pixels = new Uint8Array([1, 2, 3, 4]);

    await createLiveEngine({ Tool, width: 1, height: 1, pixels });

    expect(pixels.byteLength, "the caller's buffer was detached").toBe(4);
    expect(pixels.buffer.byteLength, "the underlying ArrayBuffer was detached").toBe(4);
  });

  it("builds no local engine on the worker path, even when it succeeds", async () => {
    // The rejecting case above proves this while the worker path FAILS. This
    // proves it on the path that works — the one that will actually run.
    setFlag(true);
    const { FakeWorker } = fakeWorkerClass();
    vi.stubGlobal("Worker", FakeWorker);
    const { Tool, built, loaded } = fakeToolClass();

    const t = await createLiveEngine({
      Tool,
      width: 4,
      height: 4,
      pixels: new Uint8Array([9, 9, 9, 9]),
    });

    expect(built, "a local engine was built alongside the worker's").toEqual([]);
    expect(loaded).toEqual([]);
    // And the handle is the surface-gated proxy, not a raw engine.
    expect(typeof (t as unknown as Record<string, unknown>).load_image).toBe("function");
    expect((t as unknown as Record<string, unknown>).remove_object).toBeUndefined();
  });
});
