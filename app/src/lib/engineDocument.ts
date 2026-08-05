// Which photo the ENGINE is currently holding — as opposed to which photo the
// UI has selected. Those two diverge, and the gap is where archives got
// corrupted.
//
// THE BUG THIS EXISTS TO STOP (measured 2026-08-05, live trace)
//
// `savePhotoEdit(photoId, toolRef)` reads whatever document the engine holds
// and writes it under `edit-${photoId}`. It never checked that the engine was
// holding that photo. Normally it is, so nothing showed — until a switch died
// in `saveOutgoing`, which at 13-second uploads was 10 out of 10 switches:
//
//   1. paint A         → engine holds A, undoCount 1
//   2. click B         → activePhotoId := B, switch dies in saveOutgoing;
//                        the engine STILL holds A
//   3. click C         → "outgoing" is B, engine still holds A, undoCount
//                        still 1 → B looks modified → B's archive is written
//                        with A's canvas
//
// Confirmed against the live IndexedDB: four photos with four different aspect
// ratios, all four `edit-*` archives decoding to 1445×2128 — the painted car.
// Photos the user never touched restored as the car. Self-sustaining, too: B
// now owns an archive with one undo entry, so the next visit restores it and B
// reads as modified forever.
//
// WHY A MARKER AND NOT A DIMENSION CHECK
//
// Comparing the engine's canvas size against the photo's own dimensions is
// tempting and needs no new state — but two photos off the same camera share a
// size, so it silently misses the most likely real-world case. It is a fine
// DETECTOR (see the audit) and a poor guard.
//
// THE BIAS, WHICH IS THE OPPOSITE OF THE COLLECTOR'S
//
// Elsewhere in this codebase the rule is "when in doubt, KEEP [the bytes]".
// Here the dangerous direction is inverted: refusing a save loses work the user
// actually did, which is worse than the corruption it prevents. So this refuses
// ONLY when it positively knows the engine holds a different photo. Unknown
// ownership (`null`) always allows the save. A missed `setEngineDocument` call
// therefore degrades to today's behaviour, never to data loss.
//
// WHICH IS EXACTLY WHY THE COUNTERS EXIST
//
// That bias has a failure mode: if ownership is usually unknown, every save is
// allowed and the guard is decoration that reads like a fix. So the decision
// point counts itself — allow-known, allow-unknown, refuse. Counting anywhere
// else would eventually drift from the branch it claims to describe.
//
//   window.__ihSaveGuard()   → { holding, allowedKnown, allowedUnknown, refused }
//
// A healthy build is allow-known-dominant with allow-unknown near zero (boot,
// before the first photo lands). A high allow-unknown rate means an ownership
// site is missing and the guard is inert — report it, don't ship around it.

let holding: string | null = null;

const counts = {
  allowedKnown: 0,
  allowedUnknown: 0,
  refused: 0,
};

export interface SaveGuardStats {
  /** The photo the engine is holding, or null when unknown. */
  holding: string | null;
  /** Saves allowed because the engine positively held the expected photo. */
  allowedKnown: number;
  /** Saves allowed only because ownership was unknown — the inert case. */
  allowedUnknown: number;
  /** Saves refused because the engine positively held a DIFFERENT photo. */
  refused: number;
}

/** Record that the engine's document is now `photoId`. Call this where the
 *  document is actually REPLACED — after a load completes — never on click.
 *
 *  Setting this on click is the one change that would reintroduce the bug: a
 *  switch that dies mid-load would leave the marker naming a photo the engine
 *  never received, turning a refusal into a permission. */
export function setEngineDocument(photoId: string | null): void {
  holding = photoId;
}

/** The photo the engine is holding, or null when unknown. */
export function getEngineDocument(): string | null {
  return holding;
}

/**
 * May `photoId`'s archive be written from the engine's current document?
 *
 * `true` when ownership is unknown — see the bias note above. Counts every
 * decision; that tally is the evidence for whether this guard does anything.
 */
export function engineHolds(photoId: string): boolean {
  if (holding === null) {
    counts.allowedUnknown++;
    return true;
  }
  if (holding === photoId) {
    counts.allowedKnown++;
    return true;
  }
  counts.refused++;
  return false;
}

/** Decision tally + current ownership. Read-only snapshot. */
export function engineDocumentStats(): SaveGuardStats {
  return { holding, ...counts };
}

/** Attach to window so the re-measure can read it from the console or
 *  automation, same pattern as `__ihContentAudit`. */
export function installSaveGuardProbe(): void {
  (globalThis as unknown as Record<string, unknown>).__ihSaveGuard = engineDocumentStats;
}

/** Test seam. Clears ownership AND the tally. */
export function __resetEngineDocument(): void {
  holding = null;
  counts.allowedKnown = 0;
  counts.allowedUnknown = 0;
  counts.refused = 0;
}
