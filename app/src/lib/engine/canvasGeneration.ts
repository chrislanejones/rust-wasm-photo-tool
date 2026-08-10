// ADR-024 Stage 4, step a11.2 — the staleness rule for canvas-targeted work.
//
// WHAT a11.1 ESTABLISHED. `lib/engine/canvasIdentity.ts` gives every `<canvas>`
// element a generation, owned by AppShell so it outlives the remounts it
// counts. Crossing the Batch boundary re-creates the element; measured, five
// crossings produce generations 1..5.
//
// WHAT THIS ADDS. A single rule — is a piece of canvas-targeted work aimed at
// the element that is actually live? — and the requirement that the answer be
// REPORTED rather than acted on silently.
//
// ⚠️ SCOPE, STATED PLAINLY. a11.2 is specified as "transfer carries it, draws
// carry it, stale draws are rejected". Only the first half has a subject today:
// `workers/engine.worker.ts` owns a wasm `ImageHorseTool` and answers method
// calls by name. It holds **no OffscreenCanvas and performs no drawing** — that
// arrives with a12, together with `transferControlToOffscreen()`. So there are
// currently no draws to tag.
//
// Rather than invent a draw path to guard, this ships the rule, the protocol
// field and the rejection semantics now, and `canvasGeneration.contract.test.ts`
// arms a structural guard that FAILS THE MOMENT a12 introduces a canvas into
// the worker without routing it through this check. The guard is unexercised in
// production until then, and that is stated rather than papered over — a check
// with no traffic proves nothing by passing.
//
// WHY REJECT RATHER THAN IGNORE. The failure this exists to prevent is silent:
// after transfer, a worker holding the OffscreenCanvas of a discarded element
// keeps drawing, nothing throws, and the user sees a blank canvas from an
// ordinary action. Ignoring a stale draw produces the same blank screen with
// the same silence. Only an error turns it into something a person or a test
// can see, which is the entire point of the generation.

/** No canvas has ever been attached. Work tagged with this cannot be current,
 *  because there is no element it could refer to. */
export const NO_CANVAS = 0;

/**
 * Why this canvas-targeted work must not run — or `null` if it may.
 *
 * `requested === undefined` means "not canvas-targeted", which is the common
 * case: `width()`, `undo()` and most of the engine surface do not touch the
 * drawing surface at all. Those are always allowed; demanding a generation for
 * them would be noise, and noise is what gets a check deleted.
 *
 * Returns a STRING rather than a boolean so the rejection carries both numbers.
 * "stale" with no values is the kind of error that gets logged and skipped;
 * knowing a draw aimed at generation 2 arrived while 5 was live is the
 * difference between a diagnosis and a shrug.
 */
export function staleCanvasReason(
  requested: number | undefined,
  current: number,
): string | null {
  if (requested === undefined) return null; // not canvas-targeted
  if (requested === NO_CANVAS) {
    return `canvas-targeted work tagged with no canvas (generation ${NO_CANVAS})`;
  }
  if (current === NO_CANVAS) {
    return `canvas-targeted work for generation ${requested}, but no canvas is attached`;
  }
  if (requested !== current) {
    return `stale canvas: work targets generation ${requested}, live generation is ${current}`;
  }
  return null;
}
