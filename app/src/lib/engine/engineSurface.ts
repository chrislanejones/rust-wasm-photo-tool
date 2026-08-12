// ADR-024 a12.0 — what the engine can be asked to do, and what it cannot.
//
// The worker enumerates its own engine prototype and reports the result; the
// main thread's proxy exposes only those names. Both halves need the same rule,
// so it lives here once rather than being written twice and drifting — which is
// the failure this whole sub-step exists to prevent. A hand-synced copy of the
// engine's surface is exactly what drifted by 31 methods and left the
// migration's gate understating by 36 call sites for ten releases (v8.21).

/** Names that are never forwardable, whatever the engine's prototype carries.
 *
 *  `free` destroys the engine. Forwarded through the proxy it would let any
 *  caller drop the worker's document while the main thread still holds a handle
 *  it believes is live, and every later call would reject against a freed
 *  pointer. The lifecycle belongs to `createLiveEngine` / `detachLivePort`, and
 *  the worker already frees its own engine on `dispose`.
 *
 *  Nothing calls `tool.free()` today — a13 verified that, and it is precisely
 *  why `readUiSnapshot` needs a liveness guard: the outgoing engine stays alive
 *  and answers. Latent is the right time to close a hole, not the wrong one. */
export const NEVER_FORWARD: ReadonlySet<string> = new Set(["free", "constructor"]);

/**
 * The callable surface of an engine prototype.
 *
 * `Object.getOwnPropertyNames` on a wasm-bindgen prototype returns `constructor`
 * and `free` alongside the real methods, plus any accessors. Filtering to
 * functions and dropping `NEVER_FORWARD` leaves exactly the set a caller may
 * invoke — which is what makes `typeof proxy.method === "function"` answer the
 * same thing it answers for a local engine, and therefore what keeps the four
 * feature detections (`hasPatchmatchExports`, `hasTilesExports`,
 * `hasMagicEraserExports`, `hasPersistExports`) honest.
 */
export function engineSurfaceOf(proto: object): string[] {
  const bag = proto as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto).filter(
    (n) => !NEVER_FORWARD.has(n) && typeof bag[n] === "function",
  );
}
