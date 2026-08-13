// The engine port — ADR-024 Stage 1.
//
// WHAT THIS IS FOR. Stage 3 moves the engine into a Worker, at which point
// every call has to travel over a message queue instead of a function call.
// This module is the single named place where that swap happens. It is
// `createLiveEngine()` — NOT `attachLivePort()`, which this header claimed
// until v8.24 and which could never have worked: by the time `attachLivePort`
// is reached the engine has already been built and image-loaded on the main
// thread, and a worker cannot adopt that handle. Construction is the thing that
// moves, so the five load paths call the factory and it decides where the
// engine lives. `docs/engine-worker-a12-design.md`.
//
// THE INVARIANT, corrected. ADR-024 states it as "every mutation reaches the
// engine through a single message queue". That is one word wrong, and the wrong
// version causes a regression rather than preventing one:
//
//   ONE PORT PER DOCUMENT. Every mutation of the document the user is EDITING
//   reaches the engine through a single queue. `OpLog::append` (src/ops.rs:1004)
//   records arrival order — no `Op` carries a sequence number — and a
//   `MessagePort` is FIFO, so one port means postMessage order IS append order
//   and the log stays byte-identical to today's.
//
// Throwaway engine instances built for a document the user is NOT editing are
// separate documents with their own lifetimes and no op log. They are out of
// scope and MUST NOT be routed through the live port: their ops would land in
// the live document's log (undo would replay edits to a photo nobody opened),
// and a 40-photo batch export would serialise behind the live queue — the exact
// stall this whole arc exists to remove.
//
// WHY THIS IS A SEAM AND NOT A REWRITE. The ownership invariant already holds:
// `toolRef` is created once (useEngineCore.ts:159) and assigned in six places,
// all inside `useEngineCore`; every other module receives it read-only as a
// `RefObject` and reads `.current`. Routing all ~152 call sites through a
// hand-written facade over 231 engine members would be an enormous diff that
// changes no behaviour and adds no guarantee the ref does not already give.
// What was actually missing is a named swap point and a test that stops the
// ownership eroding — `engineOwnership.contract.test.ts` is the other half of
// this stage and the more important one.
import type { ImageHorseTool } from "stamp_tool";
import { EngineWorkerClient } from "./workerClient";
import { NEVER_FORWARD } from "./engineSurface";
import { NO_CANVAS } from "./canvasGeneration";

/**
 * Hand a freshly-constructed engine to the live document's port.
 *
 * Identity today, deliberately: Stage 1 changes no behaviour. What it buys is
 * that every live-document engine now enters the app through ONE named
 * function, so Stage 3 has exactly one body to replace and one place to add
 * request ids, queueing, cancellation and errors — the four things the Phase 3
 * spike did not have.
 *
 * ⚠️ **"ONE BODY TO REPLACE AND NO CALL SITE CHANGES" IS WRONG, and a12 cannot
 * be built on it** (found 2026-08-12, `docs/engine-worker-a12-design.md`). This
 * function receives an engine that has ALREADY been constructed and loaded with
 * an image on the main thread — all five call sites in `useEngineCore` do
 * `new Tool(w, h)` + `load_image(...)` and only then hand it over. A worker port
 * cannot adopt that handle. Building on both sides is disqualified by this
 * file's own invariant (two engines ⇒ two op logs), so CONSTRUCTION has to move
 * into the worker, which means the seam moves up to a `createLiveEngine(...)`
 * factory and the five sites change once. `attachLivePort` keeps its ownership
 * role; it stops pretending to be the swap point.
 *
 * Call this ONLY for the document being edited. A throwaway instance
 * (`lib/exportImage.ts`, `features/tools/settings/BatchSettings.tsx`) must not
 * pass through here — see the invariant above.
 */
export function attachLivePort(tool: ImageHorseTool): ImageHorseTool {
  return tool;
}

/**
 * Release the live document's port. Tears down the worker's channel when there
 * is one. Paired with `attachLivePort` / `createLiveEngine` so the two halves of
 * the lifecycle are visible in one file rather than implied by an assignment.
 */
export function detachLivePort(): void {
  // ⚠️ wasm memory NEVER SHRINKS (a11.0, ~75 MB observed during a flip window),
  // so an engine instance that is dropped without being reclaimed raises the
  // tab's floor for the rest of the session. Releasing here is not tidiness.
  //
  // ADR-024 a12.5 — RELEASE THE DOCUMENT, KEEP THE WORKER. This used to
  // `dispose()`, and disposing takes the `OffscreenCanvas` with it: an element
  // yields one exactly once, so the next load had no surface to draw to and the
  // editor went blank. Freeing the engine inside the worker reclaims the same
  // memory — the worker's linear memory is reused by the next document — without
  // destroying something that cannot be rebuilt. `releaseEngine` also clears the
  // surface, which is the half `clearLiveCanvas` cannot do from this thread.
  livePort?.releaseEngine();
}

/**
 * ADR-024 a12.5 — the REAL teardown: terminate the worker and forget it.
 *
 * Separate from `detachLivePort` because the two are genuinely different
 * events, and conflating them is what produced the blank canvas. Releasing a
 * document is routine and must preserve the surface; destroying the worker is
 * final and is only correct when the surface is going away too — the flag being
 * turned off (the element remounts on the new key, so a fresh one is coming), or
 * a test tearing down module state.
 */
export function disposeLivePort(): void {
  livePort?.dispose();
  livePort = null;
  // The held element belonged to the worker that just died; a later port must
  // not be handed a canvas that was already transferred to a dead one.
  pendingCanvas = null;
}

/** The one worker client for the live document. Module-scoped because the
 *  invariant at the top of this file is ONE PORT PER DOCUMENT — a second client
 *  would be a second queue, and `OpLog::append` records arrival order. */
let livePort: EngineWorkerClient | null = null;

/** The live worker client, for callers that need the port itself rather than
 *  the engine handle (a12.2 hands it the transferred `OffscreenCanvas`).
 *  Null whenever the flag is off — there is no worker to talk to. */
export function liveEnginePort(): EngineWorkerClient | null {
  return livePort;
}

/**
 * ADR-024 a12.1 — build the live document's engine, wherever it is going to
 * live. **This is the real swap point**, and `attachLivePort` never was.
 *
 * ── WHY THE SEAM MOVED ──────────────────────────────────────────────────────
 *
 * `attachLivePort(tool)` receives an engine that has ALREADY been constructed
 * and loaded with an image on the main thread; every one of its call sites does
 * `new Tool(w, h)` + `load_image(...)` first. A worker-resident engine cannot
 * adopt that handle, and building one on each side is disqualified by this
 * file's own invariant — two engines are two op logs. So construction is what
 * has to move, and this factory is where the decision is made. See
 * `docs/engine-worker-a12-design.md`.
 *
 * The boundary is deliberately narrow: **create the engine and load its base
 * image, nothing else.** Callers that then apply an artboard border, rebuild a
 * layer stack or replay an op log keep doing that through the returned handle,
 * because those are ordinary engine calls and every one of them is already
 * awaited (Stage 3.5 + a10, v8.22). Widening this to swallow their differences
 * would put five load paths' logic behind one flag branch, which is exactly the
 * divergence `engineAsyncMigration.contract.test.ts` forbids.
 *
 * `Tool` is passed in rather than imported here so the local path keeps using
 * the module the caller already initialised — the same instance whose
 * `memory` it hands to `registerWasmMemory` for the zero-copy blit.
 *
 * ⚠️ WITH THE FLAG ON, THE LOCAL BRANCH NEVER RUNS, which is the point: no
 * second `ImageHorseTool`, no second op log, no doubled image memory.
 */
export async function createLiveEngine(spec: {
  Tool: new (width: number, height: number) => ImageHorseTool;
  width: number;
  height: number;
  /** Base image RGBA. Omitted for the 1×1 placeholder an op-log restore
   *  replaces wholesale. */
  pixels?: Uint8Array;
}): Promise<ImageHorseTool> {
  const { Tool, width, height, pixels } = spec;

  if (!engineWorkerEnabled()) {
    // ADR-024 a12.5 — TERMINATE THE LOSING INSTANCE. Reaching the local branch
    // with a live worker means the flag went off mid-session, and a worker left
    // running holds a whole wasm instance for a document nobody is editing —
    // wasm memory never shrinks, so that is a permanent rise in the tab's floor
    // (~75 MB observed in a11.0), not a temporary one. Stage 5 lists this as a
    // hard requirement of the flip; it belongs here, where the choice is made.
    disposeLivePort();
    const tool = new Tool(width, height);
    if (pixels) tool.load_image(pixels);
    return attachLivePort(tool);
  }

  // ADR-024 a12.5 — ONE WORKER PER TAB, one document at a time inside it.
  //
  // ⚠️ REUSED, NOT REBUILT, and the reason is not efficiency. The worker holds
  // the `OffscreenCanvas`, and `transferControlToOffscreen()` may be called ONCE
  // per element — so disposing the worker to load a second photo destroys the
  // only surface that element will ever yield, and the replacement worker draws
  // nowhere. That shipped as a blank canvas on every load past the first, with a
  // correct thumbnail and an empty console (measured: the discarded worker got
  // the canvas and zero calls; the live one got 339 calls and no canvas).
  //
  // The invariant at the top of this file is unaffected: it demands ONE PORT PER
  // DOCUMENT, and one port serving documents in sequence is still one queue and
  // still FIFO. Reuse also removes a 715 ms cold start from every photo switch.
  let port = livePort;
  if (port) {
    await port.reinit(width, height);
  } else {
    port = new EngineWorkerClient();
    livePort = port;
    await port.init(width, height);
  }
  if (pixels) {
    // ⚠️ DELIBERATELY NOT TRANSFERRED, and the reason is a silent-corruption
    // hazard rather than a preference.
    //
    // Transferring DETACHES the buffer on this side, and a detached
    // `ArrayBuffer` reads as ZERO-LENGTH — no throw, no warning. Two of the
    // three callers that supply pixels hand over a VIEW of a buffer they do not
    // own: `loadImageFromPixels` does `new Uint8Array(pixels.buffer)` over its
    // caller's array (four call sites in `useImageSession`), and
    // `restoreFromSaved` wraps `canvasRgba.buffer` from the PNG decode. Only
    // `loadImage`'s `new Uint8Array(imageData.data)` is a genuine copy.
    // Transferring here would quietly empty an array the caller still holds.
    //
    // And the saving is illusory: without a transfer `postMessage` structured-
    // clones the array, which is one copy; copying defensively and then
    // transferring is also one copy. Same cost, no hazard. If Stage 5's
    // measurement ever shows this matters, the fix is an explicit opt-in from a
    // call site that can prove its buffer is dead — not a blanket transfer here.
    await port.call("load_image", [pixels]);
  }
  // The canvas almost always mounted before this point — hand it over now.
  attachPendingCanvas();
  return createEngineProxy(port);
}

/**
 * ADR-024 a12.2 — draw the engine's composite onto the live canvas.
 *
 * **The branch lives HERE, not at the call site.**
 * `engineAsyncMigration.contract.test.ts` allows exactly two modules to read
 * `ih_engine_worker`, and this is the one that owns the local/worker choice:
 * *"every such branch is a place the two implementations can quietly diverge."*
 * So `flushToCanvas` calls this and contains no flag test of its own.
 *
 * ⚠️ NOT a method on the engine handle, which is the obvious design and does not
 * work. The worker handle is a Proxy gated to the engine's REAL method surface
 * (a12.0), so a synthetic `blit` is unreachable through it; and giving the local
 * path one would mean wrapping the raw engine, which costs the identity
 * property a13's liveness guard (`toolRef.current === t`) depends on.
 *
 * LOCAL: today's zero-copy path, unchanged and still synchronous — it is the
 * per-frame blit and the five reads it makes are the ones `DISSOLVES_AT_STAGE_4`
 * always said would dissolve rather than convert.
 *
 * WORKER: one fire-and-forget message. The engine, its memory and the
 * `OffscreenCanvas` are all on that side, so nothing crosses.
 */
export function blitLiveEngine(
  tool: ImageHorseTool,
  canvas: HTMLCanvasElement,
  wasmMemory: WebAssembly.Memory | null,
  backbufferRef: { current: ImageData | null },
): void {
  if (engineWorkerEnabled()) {
    // The canvas was transferred to the worker; this thread cannot draw to it
    // and must not try — `getContext("2d")` throws `InvalidStateError` on a
    // transferred element.
    livePort?.blit();
    return;
  }

  const w = tool.width() as unknown as number;
  const h = tool.height() as unknown as number;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d", { desynchronized: true })!;
  tool.recomposite();
  if (wasmMemory) {
    const ptr = tool.data_ptr() as unknown as number;
    const len = tool.data_len() as unknown as number;
    // Rebuilt every call: a `memory.grow()` replaces the backing ArrayBuffer and
    // detaches every earlier view. Copied into a private backbuffer before
    // `putImageData` — handing it an ImageData backed by live wasm memory is the
    // Firefox "garbage after 5-8 strokes" bug.
    const view = new Uint8ClampedArray(wasmMemory.buffer as ArrayBuffer, ptr, len);
    let back = backbufferRef.current;
    if (!back || back.width !== w || back.height !== h) {
      back = new ImageData(w, h);
      backbufferRef.current = back;
    }
    if (view.length === back.data.length) {
      back.data.set(view);
      ctx.putImageData(back, 0, 0);
      return;
    }
  }
  const composed = tool.get_image_data() as unknown as Uint8Array;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(composed), w, h), 0, 0);
}

/**
 * ADR-024 a12.2 — the three remaining main-thread canvas writes, as OPERATIONS.
 *
 * After `transferControlToOffscreen()` the main thread cannot get a 2D context
 * from the element and any `width`/`height` ASSIGNMENT throws
 * `InvalidStateError` (verified, OPEN-B). Every one of these was doing exactly
 * that, unconditionally, from five load paths.
 *
 * They are functions here rather than an exported `mainThreadOwnsCanvas()`
 * predicate on purpose. A predicate is just the flag wearing a different name,
 * and the contract test's rule — *"every such branch is a place the two
 * implementations can quietly diverge"* — is about the branch, not the spelling.
 * Callers ask for the OUTCOME; where it happens is this module's business.
 *
 * Under the worker each is a no-op because the worker's `blit()` sizes and
 * paints its own surface: the picture arrives on the next flush instead of
 * being pre-painted here.
 */
export function clearLiveCanvas(canvas: HTMLCanvasElement): void {
  if (engineWorkerEnabled()) return;
  const ctx = canvas.getContext("2d");
  ctx?.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = 0;
  canvas.height = 0;
}

export function sizeLiveCanvas(canvas: HTMLCanvasElement, w: number, h: number): void {
  if (engineWorkerEnabled()) return;
  canvas.width = w;
  canvas.height = h;
}

/** Paint incoming pixels straight to the display canvas so a freshly-opened
 *  photo appears before the engine has composited anything. Local only — under
 *  the worker the first `blit()` does it, one frame later. */
export function previewLiveCanvas(
  canvas: HTMLCanvasElement,
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
): void {
  if (engineWorkerEnabled()) return;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { desynchronized: true })!;
  ctx.putImageData(new ImageData(pixels as unknown as ImageDataArray, w, h), 0, 0);
}

/**
 * ADR-024 a12.2 — hand a newly-mounted canvas to the worker.
 *
 * One-way and permanent for that ELEMENT: after
 * `transferControlToOffscreen()` the main thread can no longer get a 2D context
 * from it, and `width`/`height` ASSIGNMENTS throw `InvalidStateError` (verified,
 * OPEN-B — reads, `getBoundingClientRect`, styles and events all keep working,
 * which is why zoom and pan survive). That is why a11.3 keys the element on
 * `canvasSurfaceKey()`: flipping the flag remounts a FRESH element that was
 * never transferred, so the runtime kill switch still works.
 *
 * No-op with the flag off, so the local path never transfers and never loses
 * its context.
 */
export function transferCanvasToPort(canvas: HTMLCanvasElement, generation: number): void {
  if (!engineWorkerEnabled()) return;
  pendingCanvas = { el: canvas, generation };
  attachPendingCanvas();
}

/** The mounted element waiting to be handed over, if the port did not exist yet.
 *
 *  ⚠️ THE TWO EVENTS RACE, AND THE CANVAS ALWAYS WINS. The element mounts when
 *  the editor renders; the port is not created until a photo is OPENED. So a
 *  transfer-on-mount alone never fires — `livePort` is null every time — and the
 *  worker ends up drawing to nothing while the user looks at an untouched
 *  300x150 canvas. Observed directly the first time the flag was turned on.
 *
 *  Holding the element and completing the handover when the port appears makes
 *  the order irrelevant, which is the only version that can be correct: neither
 *  event owns the other. */
let pendingCanvas: { el: HTMLCanvasElement; generation: number } | null = null;

function attachPendingCanvas(): void {
  const port = livePort;
  if (!port || !pendingCanvas) return;
  const { el, generation } = pendingCanvas;
  // Cleared either way: `transferControlToOffscreen()` may be called ONCE per
  // element, so a retry could only ever throw again.
  pendingCanvas = null;
  try {
    port.setCanvas(generation, el.transferControlToOffscreen());
  } catch {
    // Already transferred — React re-invokes a callback ref whenever the
    // callback's identity changes, and this component re-renders constantly.
    // The worker still holds the surface; only the generation needs updating.
    port.setCanvas(generation);
  }
}

/** ADR-024 a12.2 — tell the worker the live element is gone, so every
 *  canvas-targeted call becomes stale rather than painting into a detached
 *  surface. This is the half a11.2's rejection rule was built for. */
export function releaseCanvasFromPort(): void {
  if (!engineWorkerEnabled()) return;
  pendingCanvas = null;
  livePort?.setCanvas(NO_CANVAS);
}

/** The subset of `EngineWorkerClient` the proxy needs. Declared structurally so
 *  the proxy can be tested against a fake without standing up a Worker. */
export interface EngineCallPort {
  call<T = unknown>(method: string, args?: unknown[], transfer?: Transferable[]): Promise<T>;
  readonly surface: ReadonlySet<string>;
}

/**
 * ADR-024 a12.0 — the main-thread handle for a worker-resident engine.
 *
 * Every method returns a Promise. That is safe for the whole app as of v8.22:
 * Stage 3.5 and a10 converted all 113 value-consuming sites to `await`, and
 * `await` is transparent over a plain value, so the SAME call sites work
 * against a local engine and this proxy with no branch anywhere.
 *
 * ── WHY IT IS GATED ON A SURFACE, AND NOT OPEN ──────────────────────────────
 *
 * The naive proxy answers every `get` with a forwarding function. That would
 * silently break four feature detections, each of which decides whether an
 * entire subsystem is available:
 *
 *   hasPatchmatchExports    typeof t.remove_object === "function"
 *   hasTilesExports         typeof t.tiles_flush === "function"
 *   hasMagicEraserExports   typeof t.magic_eraser_brush_down === "function"
 *   hasPersistExports       typeof t.oplog_encoded_ops === "function"
 *
 * All four would start answering YES on every build, including the default one
 * whose wasm has none of those methods, and the app would route calls into an
 * engine that cannot serve them. These guards are load-bearing rather than
 * defensive — `useMagicEraserTool` says so in its own header, because the tile
 * that reaches it is not itself flag-gated.
 *
 * So the proxy exposes ONLY names the worker reported at init, enumerated from
 * the engine's prototype. `typeof` then answers exactly what it answers today.
 *
 * ⚠️ Deliberately NOT a hand-maintained list. A hand-synced copy of this
 * surface is what drifted by 31 methods and left the migration's own gate
 * understating by 36 call sites for ten releases (v8.21). A surface the engine
 * reports about itself cannot drift from the engine.
 *
 * ── THE TYPE DECISION, MADE ON PURPOSE ──────────────────────────────────────
 *
 * `ImageHorseTool.width()` is declared `(): number`; this returns
 * `Promise<number>`. Runtime is fine — all 113 value-consuming sites await, and
 * `await` over a plain value is a no-op — but the DECLARED type stops being
 * true, so the choice is which lie to tell and where.
 *
 *   cast at the seam (CHOSEN)  one file is wrong, loudly, with this comment
 *   `PromisifiedTool` mapped   honest, but rewrites the type at ~260 call sites
 *                              that the gate already proves await
 *   union the return type      honest, non-breaking, worst to USE — every
 *                              caller would have to handle both shapes forever
 *
 * The cast wins because the dishonesty is CONTAINED and ANNOTATED, and because
 * the alternative that is honest at the type level (the mapped type) would
 * churn every call site to restate something the migration already established.
 * Revisit at Stage 5, when the flag's default flips and "sometimes a Promise"
 * stops being the exception.
 */


export function createEngineProxy(port: EngineCallPort): ImageHorseTool {
  const bound = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  return new Proxy(Object.create(null) as ImageHorseTool, {
    get(_t, prop) {
      if (typeof prop !== "string") return undefined;
      if (NEVER_FORWARD.has(prop)) return undefined;
      if (!port.surface.has(prop)) return undefined;
      let fn = bound.get(prop);
      if (!fn) {
        // Cached per name so repeated `get`s return the SAME function object.
        // `useEffectiveTool` and friends put these handlers in dependency
        // arrays; a fresh identity per render would make every memo miss.
        fn = (...args: unknown[]) => port.call(prop, args);
        bound.set(prop, fn);
      }
      return fn;
    },
    has(_t, prop) {
      return typeof prop === "string" && !NEVER_FORWARD.has(prop) && port.surface.has(prop);
    },
    // `Object.getOwnPropertyNames(Object.getPrototypeOf(handle))` is how the
    // audit and the worker both enumerate an engine; keep it answerable here so
    // a proxy is introspectable the same way a real handle is.
    ownKeys() {
      return [...port.surface].filter((k) => !NEVER_FORWARD.has(k));
    },
    getOwnPropertyDescriptor() {
      return { enumerable: true, configurable: true };
    },
  });
}

/** ADR-024 Stage 3 — the switch that will one day route through the worker.
 *
 *  Read fresh each call, like every other flag in this repo, so a tab can be
 *  flipped without a rebuild. OFF by default and there is no path that turns it
 *  on yet: `attachLivePort` above still returns the tool directly. Turning this
 *  on today would change nothing; that is deliberate, so the worker and its
 *  protocol can be built and tested before anything depends on them.
 *
 *  WHAT IS ACTUALLY LEFT (v8.19 — read from `node scripts/engine-call-audit.mjs`,
 *  never hand-counted). Of **96** value-consumed reads, **91 are converted** and
 *  **5 remain**:
 *
 *    5  `useEngineCore.flushToCanvas` — the per-frame blit. EXEMPT on purpose
 *       (`DISSOLVES_AT_STAGE_4`): under Option A the canvas moves INTO the
 *       worker, so this path stops crossing the boundary rather than converting.
 *       Awaiting it would put a round trip on every frame.
 *
 *  ✅ **STAGE 3.5 IS COMPLETE.** The gate is at its floor: everything still
 *  counted dissolves at Stage 4, and there is no conversion work left. The last
 *  two — `AppShell`'s `handlePenCommit` / `handlePenHitTest` — landed in v8.19 as
 *  the PenOverlay state-machine change `docs/pen-overlay-async-design.md`
 *  specified, not as awaits.
 *
 *  ⚠️ THIS PARAGRAPH WAS WRONG FROM 2026-08-08 TO v8.17. It said "the 166
 *  value-consumed reads are synchronous and Stage 3.5 has not converted them",
 *  and stayed there while 89 of them were converted over ten releases — the
 *  count also fell 166 → 96 as atomic captures collapsed several reads into one
 *  call each, so both halves of the sentence drifted. It is the file that
 *  explains WHY the flag is off, so a stale reason here is worse than no reason.
 *  Re-run the audit and correct this line whenever the gate moves.
 *
 *  (The 166 itself said 121 until 2026-08-08. The audit matched engine calls by
 *  receiver name and knew only three literal names, so every aliased call —
 *  `const t = toolRef.current; t.width()`, the dominant shape here — was
 *  invisible: 93 of 292 sites, a third of the work. Do not hand-edit these
 *  numbers; the audit prints them, and
 *  `engineAsyncMigration.contract.test.ts` pins them.)
 *
 *  Stage 5 flips the default, and only on a measured frame timeline showing the
 *  main thread idle during a 12MP sharpen — not on the architecture being
 *  correct. `ih_engine_worker=0` is then the kill switch, matching
 *  `ih_tiles_flush` / `ih_oplog_undo` / `ih_patchmatch`. */
export function engineWorkerEnabled(): boolean {
  try {
    return localStorage.getItem("ih_engine_worker") === "1";
  } catch {
    // Storage can throw in a partitioned/blocked context; treat as off.
    return false;
  }
}

/** ADR-024 Stage 4, step a11.3 — the React key for the main `<canvas>`.
 *
 *  WHAT THIS REPAIRS. `ih_engine_worker=0` is specified as a RUNTIME kill
 *  switch, and after `transferControlToOffscreen()` that promise cannot be kept
 *  on a transferred element: nothing can give a canvas its 2D context back.
 *  Flipping the flag mid-session would leave the user on a surface the main
 *  thread can no longer draw to — a kill switch that only works on reload,
 *  which is the guardrail-that-cannot-fire pattern this repo has been bitten by
 *  before.
 *
 *  Keying the element on the mode makes the flip remount it. A remounted
 *  `<canvas>` is a NEW DOM node that was never transferred, so the main-thread
 *  path is available again immediately. Losing the bitmap on a remount is
 *  already normal and already recovered from — the engine owns the pixels and
 *  `CanvasArea` re-blits on mount.
 *
 *  ⚠️ THIS DELIBERATELY CHANGES WHEN THE CANVAS REMOUNTS, which is the opposite
 *  of a11.1's stop condition — and correctly so, because here the remount IS
 *  the mechanism rather than a side effect. The flip is the only new remount:
 *  the value is stable for the life of a tab that never touches the flag, so
 *  ordinary use sees exactly the reconciliation it saw before.
 *
 *  RETURNS A STRING, not the boolean. A caller keying on `engineWorkerEnabled()`
 *  would be a call site branching on the flag, which
 *  `engineAsyncMigration.contract.test.ts` forbids for good reason — every such
 *  branch is a place the two implementations can diverge. The flag stays here;
 *  callers get an opaque identity token and cannot infer behaviour from it.
 */
export function canvasSurfaceKey(): string {
  return engineWorkerEnabled() ? "canvas-worker" : "canvas-local";
}
