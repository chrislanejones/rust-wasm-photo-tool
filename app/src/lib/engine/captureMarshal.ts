// ADR-024 a12.4 — how a CAPTURE STRUCT crosses the worker boundary.
//
// ── THE BUG THIS EXISTS TO FIX (found 2026-08-12, flag ON, production build) ──
//
// Six engine methods return a boxed wasm-bindgen struct rather than a scalar:
//
//   capture_ui_state()                      UiStateCapture
//   capture_composite()                     RgbaCapture
//   capture_composite_excluding_background() RgbaCapture
//   capture_thumbnail(max_px)               RgbaCapture
//   capture_layer_stack()                   LayerStackCapture
//   capture_pen_hit(x, y)                   PenHit
//   export_dims_excluding_background()      ExportDims
//
// A wasm-bindgen struct keeps its FIELDS AS PROTOTYPE ACCESSORS and its only own
// property is `__wbg_ptr`. `postMessage` structured-clones own enumerable data
// properties and drops the prototype, so the main thread received exactly this:
//
//   { __wbg_ptr: 1114112 }
//
// Every field `undefined`, and no `free`. Measured in the browser, not reasoned
// about. The damage was not subtle and not confined to one caller:
//
//   `readUiSnapshot` reads ten fields and then calls `ui.free()` in a `finally`,
//   so it THREW on every call — and `syncState` awaits it after essentially
//   every mutation (74 call sites). Behind the flag React's mirror of the engine
//   was dead: undo count, history, dimensions, layer list, all frozen at their
//   load-time values, with an unhandled rejection per edit as the only trace.
//
// ── WHY THE MIGRATION'S OWN GATE COULD NOT SEE IT ──
//
// `scripts/engine-call-audit.mjs` classifies call sites by whether a value is
// CONSUMED, so it can tell a bare `tool.undo()` from `const w = tool.width()`.
// It never asks what KIND of value, because until the engine moved threads the
// answer could not matter — a struct handle and an integer are equally readable
// through a function call.
//
// The sharper irony is that this arc BUILT the objects that cannot cross. The
// atomic-capture work (a3–a6, b1) deliberately collapsed clusters of scalar
// reads into single struct-returning calls, precisely so a document state could
// not tear behind the worker. Every such conversion moved a call site OFF the
// audit's list and ONTO this one. The gate counted down while the real problem
// grew, which is the same shape as the 166-that-was-121: not a wrong number, a
// question nobody was asking.
//
// ── THE RULE ──
//
// The struct is read and freed on the side that OWNS it — the worker — and only
// plain values cross. Both halves of the port need the same rule, so it lives
// here once rather than being written twice and drifting; that is the same
// reasoning as `engineSurface.ts`, and drift between two hand-synced copies of
// an engine's shape is the failure this file's neighbours were built to prevent.

/** Own property wasm-bindgen puts on every boxed struct. Never copied across —
 *  on the far side it is a dangling index into another thread's linear memory,
 *  and a number that LOOKS like a handle is worse than no handle at all. */
const PTR = "__wbg_ptr";

/**
 * Is this a boxed wasm-bindgen struct — something whose fields live on its
 * prototype and whose allocation must be released by hand?
 *
 * Both halves of the test are load-bearing. `__wbg_ptr` alone would also match a
 * plain object that happens to carry the key (a decoded reply coming back the
 * other way, most of all); a `free` method alone would match the engine handle
 * itself. Together they identify exactly the shape wasm-bindgen emits.
 */
export function isCaptureStruct(v: unknown): boolean {
  if (typeof v !== "object" || v === null) return false;
  if (!Object.prototype.hasOwnProperty.call(v, PTR)) return false;
  const proto = Object.getPrototypeOf(v) as Record<string, unknown> | null;
  return !!proto && typeof proto.free === "function";
}

/**
 * Read every field of a capture ONCE, into a plain object.
 *
 * **Once is not a style preference.** `getter_with_clone` is required for the
 * `String` and `Vec<u8>` fields (`RgbaCapture.rgba`, `UiStateCapture.layers_json`
 * …), and each access copies the whole value out of wasm memory — 17 MB per read
 * for a 2078² composite. The struct's own doc comment says "read each field
 * once"; this is the one place that has to honour it on every caller's behalf.
 *
 * Fields are found as ACCESSORS on the prototype, which is what wasm-bindgen
 * emits for a `#[wasm_bindgen]` struct field, and is the same self-describing
 * route `engineSurfaceOf` uses for methods. Nothing is listed by hand here: a
 * hand-synced copy of an engine shape is what drifted by 31 methods and cost the
 * migration ten releases of wrong numbers (v8.21).
 */
export function readCaptureFields(v: object): Record<string, unknown> {
  const proto = Object.getPrototypeOf(v) as object;
  const bag = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const name of Object.getOwnPropertyNames(proto)) {
    if (name === "constructor" || name === "free") continue;
    const d = Object.getOwnPropertyDescriptor(proto, name);
    // Accessors only: a method on the prototype is not a field, and a function
    // could not be structured-cloned anyway.
    if (!d || typeof d.get !== "function") continue;
    out[name] = bag[name];
  }
  return out;
}

/**
 * Flatten a capture for the wire, and RELEASE IT on this side.
 *
 * The free happens in a `finally` because a getter can throw (a struct freed
 * underneath us answers with a null-pointer trap), and a capture that is not
 * freed is a permanent cost: **wasm memory never shrinks** — ~75 MB was observed
 * held by one dropped instance in a11.0. A leak here would be per-mutation.
 *
 * ⚠️ VALUES ARE CLONED, NOT TRANSFERRED. A transfer would save one copy of the
 * 17 MB `rgba`, and it is deliberately not taken: a transferred `ArrayBuffer` is
 * DETACHED on the sender and reads as zero-length with no throw, which is the
 * silent-corruption shape `port.ts` refused for `load_image` on the same
 * grounds. The saving is one memcpy on the export path only; the hazard would be
 * live on every capture. If Stage 5's measurement ever shows it matters, the fix
 * is an explicit opt-in for the pixel-carrying captures alone, from a call site
 * that can prove its buffer is dead.
 */
export function marshalCapture(v: object): Record<string, unknown> {
  try {
    return readCaptureFields(v);
  } finally {
    (v as { free: () => void }).free();
  }
}

/**
 * Rebuild a capture on the main thread from the fields the worker sent.
 *
 * **`free()` is a no-op, and that is the honest answer rather than a stub.** The
 * allocation lived in the worker's linear memory and `marshalCapture` already
 * released it there, at the only moment anything could. The twelve call sites
 * that write `cap.free()` are correct as written and stay unchanged — which is
 * the whole point of the proxy, and the reason this is fixed at the seam instead
 * of at twelve callers who would each have to learn where their engine lives.
 *
 * `Symbol.dispose` is defined for the same reason: the generated classes carry
 * it, so a `using` declaration must not start throwing the day someone writes
 * one.
 */
export function rehydrateCapture(fields: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(fields as Record<string, unknown>) };
  out.free = () => {};
  // `Symbol.dispose` is ES2026 and this repo's lib target may predate it; the
  // cast keeps the shim honest without dragging the whole lib forward.
  const dispose = (Symbol as unknown as { dispose?: symbol }).dispose;
  if (dispose) (out as Record<symbol, unknown>)[dispose] = () => {};
  return out;
}
