// ADR-024 a11.2 — the staleness rule, and the guard that arms at a12.
//
// The rule is small. The structural test at the bottom is the part that matters
// today, because the thing the rule protects DOES NOT EXIST YET: the worker
// holds no OffscreenCanvas and performs no drawing. That guard fails the moment
// a12 introduces one without routing it through the check.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { staleCanvasReason, NO_CANVAS } from "./canvasGeneration";
import { EngineWorkerClient } from "./workerClient";

describe("staleCanvasReason", () => {
  it("allows work that is not canvas-targeted", () => {
    // The common case by a wide margin — width(), undo(), get_layers(). If
    // these needed a generation the check would be noise, and noise gets
    // deleted.
    expect(staleCanvasReason(undefined, 3)).toBeNull();
    expect(staleCanvasReason(undefined, NO_CANVAS)).toBeNull();
  });

  it("allows canvas-targeted work aimed at the live generation", () => {
    expect(staleCanvasReason(3, 3)).toBeNull();
  });

  it("refuses work aimed at a superseded element, naming both generations", () => {
    const why = staleCanvasReason(2, 5);
    expect(why).not.toBeNull();
    // Both numbers, deliberately: "stale" alone is the kind of message that
    // gets logged and shrugged at. Knowing a draw for 2 arrived while 5 was
    // live is a diagnosis.
    expect(why).toContain("2");
    expect(why).toContain("5");
  });

  it("refuses canvas-targeted work when no canvas is attached", () => {
    expect(staleCanvasReason(1, NO_CANVAS)).toContain("no canvas is attached");
  });

  it("refuses work tagged with generation 0, and says WHY", () => {
    // 0 means "no element has ever mounted", so it can never be a valid
    // target. Treating it as a wildcard would make the default value safe,
    // which is the opposite of what a guard wants.
    //
    // Asserting only `not.toBeNull()` was not enough: deleting this branch
    // still produced a rejection, because the generic mismatch arm catches
    // 0 !== 4 anyway. The mutant survived. The MESSAGE is what distinguishes
    // "you tagged this with nothing" from "you aimed at the wrong element",
    // and only one of those tells the reader their default value is the bug.
    expect(staleCanvasReason(NO_CANVAS, 4)).toContain("no canvas");
    expect(staleCanvasReason(NO_CANVAS, NO_CANVAS)).toContain("no canvas");
  });
});

// ── the client half ────────────────────────────────────────────────────────

interface Sent {
  kind: string;
  id?: number;
  generation?: number;
  canvasGeneration?: number;
}

class FakeWorker {
  static latest: FakeWorker | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  listeners: ((e: MessageEvent) => void)[] = [];
  sent: Sent[] = [];
  transfers: unknown[][] = [];
  constructor() {
    FakeWorker.latest = this;
  }
  postMessage(msg: Sent, transfer: unknown[] = []) {
    this.sent.push(msg);
    this.transfers.push(transfer);
    if (msg.kind === "init") queueMicrotask(() => this.emit({ id: 0, ok: true }));
  }
  addEventListener(_t: string, fn: (e: MessageEvent) => void) {
    this.listeners.push(fn);
  }
  removeEventListener(_t: string, fn: (e: MessageEvent) => void) {
    this.listeners = this.listeners.filter((l) => l !== fn);
  }
  emit(data: unknown) {
    const e = { data } as MessageEvent;
    this.listeners.forEach((l) => l(e));
    this.onmessage?.(e);
  }
  terminate() {}
}

describe("the client carries the generation", () => {
  let client: EngineWorkerClient;

  beforeEach(async () => {
    vi.stubGlobal("Worker", FakeWorker);
    client = new EngineWorkerClient();
    await client.init(10, 10);
    // BOTH, or the indices drift: `transfers` still holds init's entry while
    // `sent` starts from zero, and `transfers[i]` then reads the wrong row.
    // That misalignment failed the transfer assertion on the first run and
    // looked like a bug in setCanvas.
    FakeWorker.latest!.sent.length = 0;
    FakeWorker.latest!.transfers.length = 0;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("omits canvasGeneration for ordinary calls", () => {
    void client.call("width");
    const req = FakeWorker.latest!.sent.find((m) => m.kind === "call")!;
    // Absent, not 0 — 0 is a real value meaning "no canvas", and sending it
    // would make every ordinary call fail the staleness check.
    expect("canvasGeneration" in req).toBe(false);
  });

  it("attaches canvasGeneration when the call is canvas-targeted", () => {
    void client.call("flush", [], [], 4);
    const req = FakeWorker.latest!.sent.find((m) => m.kind === "call")!;
    expect(req.canvasGeneration).toBe(4);
  });

  it("announces a new canvas generation", () => {
    client.setCanvas(7);
    const msg = FakeWorker.latest!.sent.find((m) => m.kind === "canvas")!;
    expect(msg.generation).toBe(7);
  });

  it("announces detachment as generation 0", () => {
    client.setCanvas(NO_CANVAS);
    const msg = FakeWorker.latest!.sent.find((m) => m.kind === "canvas")!;
    expect(msg.generation).toBe(NO_CANVAS);
    // Nothing to transfer when detaching, and passing a transfer list with an
    // absent canvas would throw.
    const i = FakeWorker.latest!.sent.indexOf(msg);
    expect(FakeWorker.latest!.transfers[i]).toEqual([]);
  });

  it("transfers the surface when one is supplied", () => {
    // a12's path. The surface must move, not be cloned — an OffscreenCanvas
    // cannot be structured-cloned, so a missing transfer list is a throw at
    // runtime rather than a slow copy.
    const fake = {} as OffscreenCanvas;
    client.setCanvas(2, fake);
    const i = FakeWorker.latest!.sent.findIndex((m) => m.kind === "canvas");
    expect(FakeWorker.latest!.transfers[i]).toEqual([fake]);
  });
});

// ── the guard that arms at a12 ─────────────────────────────────────────────

describe("the worker cannot gain a canvas without the staleness check", () => {
// ⚠️ ANCHORED ON THIS FILE, NEVER ON THE LAUNCH DIRECTORY (v8.30). A source-walking
// guard that resolves relative to the launch directory reads ZERO files when
// vitest is started from the repo root — `<repo>/src` is the Rust crate and has
// no `.ts` in it — so `walk()` returns an empty list and every assertion over it
// passes VACUOUSLY. Verified by planting a real violation: from the repo root
// the guard stayed green; from `app/` it caught it.
const APP_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
  const WORKER = join(APP_ROOT, "src/workers/engine.worker.ts");
  const src = () =>
    readFileSync(WORKER, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  it("checks staleness before dispatching a queued call", () => {
    const s = src();
    expect(s, "the worker must import the rule rather than re-implement it").toContain(
      "staleCanvasReason",
    );
    // Order matters: the check has to precede the dispatch, or a stale call
    // runs and the reply is decoration.
    // `staleCanvasReason(` with the paren — bare `staleCanvasReason` also
    // matches the import line, which sits above everything and made the
    // ordering assertion vacuously true on the first run.
    const check = s.indexOf("staleCanvasReason(");
    const dispatch = s.indexOf(".apply(tool,");
    expect(check).toBeGreaterThan(-1);
    expect(dispatch).toBeGreaterThan(-1);
    expect(check, "staleness must be decided BEFORE the engine call").toBeLessThan(dispatch);
  });

  it("REPLIES to a stale call instead of skipping it", () => {
    // The whole failure mode is silence. A `continue` with no `reply` would
    // leave the caller waiting for a timeout and the user looking at a blank
    // canvas — the same symptom, differently caused.
    // PIN THE EXACT STATEMENT. A windowed search for "reply(" near the check
    // survived a mutant that deleted the reply outright — the window reached
    // the unrelated `no such engine method` reply below it and passed. A guard
    // that a deletion cannot break is not a guard.
    const s = src();
    expect(
      s.replace(/\s+/g, " "),
      "a stale call must REPLY with the reason, not silently skip — the silent " +
        "blank canvas is the exact failure a11 exists to close",
    ).toContain("reply({ id: req.id, ok: false, error: stale });");
  });

  it("ARMS AT a12: any canvas in the worker must be generation-checked", () => {
    // Today this passes trivially — the worker holds no canvas at all, which
    // is exactly why a11.2 could not build the draw half. The moment a12 adds
    // `transferControlToOffscreen`, `getContext` or drawing to this file, the
    // staleness check must already be reachable from it or this fails.
    //
    // Written as a forward guard rather than left as a note because a note is
    // what gets skipped under deadline, and this is the silent failure the
    // whole of a11 exists to close.
    const s = src();
    const canvasish = /getContext\s*\(|drawImage\s*\(|transferControlToOffscreen/.test(s);
    if (!canvasish) {
      expect(s).toContain("staleCanvasReason"); // the slot is ready
      return;
    }
    // ⚠️ FIRED FOR REAL AT a12.2, AND THE ORIGINAL WAS TOO WEAK TO CATCH IT.
    // "the file contains staleCanvasReason" was already true from the queued-
    // call path, so a12.2's `blit()` — which calls `getContext` and did NOT
    // consult the rule — passed this untouched. The worker kept the old
    // OffscreenCanvas after its element was released and painted into it.
    //
    // So the assertion is now positional: every DRAWING path must have the
    // check ahead of it, the same shape the queued-call test uses.
    const flat = s.replace(/\s+/g, " ");
    expect(
      flat,
      "the blit must refuse a draw aimed at a surface that is no longer live",
    ).toMatch(/staleCanvasReason\(surfaceGeneration, canvasGeneration\)/);

    // ⚠️ AND IT MUST REPORT, not just return. This file's own thesis is that
    // silence IS the failure: a refusal nobody can see produces exactly the
    // blank canvas it exists to prevent, and "a check with no traffic proves
    // nothing by passing". a12.2's first cut refused silently, which also made
    // a12.3's gate 1 unobservable — the rejection could only be inferred from
    // the picture not breaking, which is not evidence.
    expect(
      flat,
      "a refused blit must say so — an invisible refusal is indistinguishable " +
        "from a refusal that never happens",
    ).toMatch(/blit refused/);

    const guard = s.indexOf("staleCanvasReason(surfaceGeneration");
    const draw = s.indexOf("putImageData");
    expect(guard, "the blit's staleness guard is missing").toBeGreaterThan(-1);
    expect(draw, "expected a drawing call to guard").toBeGreaterThan(-1);
    expect(guard, "staleness must be decided BEFORE anything is drawn").toBeLessThan(draw);
  });

  it("RELEASES the surface when the element goes, rather than holding a dead one", () => {
    // The other half, and the one that actually bit. `surface = d.canvas ?? surface`
    // keeps the previous OffscreenCanvas when a release message carries no
    // canvas — so the worker still holds a handle to an element React has
    // discarded. Painting into it throws nothing and shows nothing.
    const flat = src().replace(/\s+/g, " ");
    expect(
      flat,
      "a NO_CANVAS release must null the surface, not keep the old one",
    ).toMatch(/generation === NO_CANVAS\) \{ surface = null;/);
  });
});
