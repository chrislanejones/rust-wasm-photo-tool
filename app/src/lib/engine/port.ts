// The engine port — ADR-024 Stage 1.
//
// WHAT THIS IS FOR. Stage 3 moves the engine into a Worker, at which point
// every call has to travel over a message queue instead of a function call.
// This module is the single named place where that swap happens. Today it is
// an identity function: `attachLivePort(tool)` returns the tool. Stage 3
// replaces the body, and no call site changes.
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
 * Release the live document's port. Identity today; Stage 3 tears down the
 * worker's channel here. Paired with `attachLivePort` so the two halves of the
 * lifecycle are visible in one file rather than implied by an assignment.
 */
export function detachLivePort(): void {
  /* no channel to close until Stage 3 */
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
 */
export function createEngineProxy(port: EngineCallPort): ImageHorseTool {
  const bound = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  return new Proxy(Object.create(null) as ImageHorseTool, {
    get(_t, prop) {
      if (typeof prop !== "string") return undefined;
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
      return typeof prop === "string" && port.surface.has(prop);
    },
    // `Object.getOwnPropertyNames(Object.getPrototypeOf(handle))` is how the
    // audit and the worker both enumerate an engine; keep it answerable here so
    // a proxy is introspectable the same way a real handle is.
    ownKeys() {
      return [...port.surface];
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
