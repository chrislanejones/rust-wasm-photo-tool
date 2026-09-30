// The document queue: every engine LOAD and every archive SAVE runs through
// here, one at a time. Split out of useEngineCore.ts (line-capped).
//
// THE BUG THIS FIXES. On the one shared worker port, two overlapping loads
// interleaved: B's follow-up calls (set_artboard_border, clear_history,
// `toolRef = tool`, canvas sizing) ran against C's freshly loaded document, and
// whichever finished last won. And a save could run between a load replacing
// the document and the ownership marker saying so: the trace showed photo A's
// archive written with photo B's pixels. Measured: edit A, PgDn/PgUp five times
// in a second → A lit in the gallery but the canvas black or showing B, 4 runs
// of 6 (e2e photo-switch-state §0.7).
//
// Half of it. The other half was the engine: a read that landed mid-rebuild of a
// saved photo panicked (src/layer.rs `active_layer`), and a panic poisons the
// instance. Over 30 runs each: this queue alone still failed 6/24, the engine
// fix alone 11/30, both 0/30.
import { setEngineDocument } from "@/lib/engineDocument";

/** Options every document load takes.
 *
 *  A load whose `isCurrent()` is already false when its turn comes, or before
 *  it touches the engine, is skipped. A load that HAS touched the engine always
 *  finishes (border, history, toolRef, canvas), so the engine, toolRef, the
 *  canvas and the ownership marker agree after every load, and the newest one,
 *  always queued last, always lands last. */
export interface LoadOpts {
  isCurrent?: () => boolean;
  /** The photo this load puts in the engine. The ownership marker
   *  (lib/engineDocument) moves to it INSIDE the queue, when the document is
   *  replaced — never in the caller after its await returns. Omitted = the
   *  marker is left alone (an AI result or a reload of the same photo replaces
   *  the pixels, not the owner). */
  photoId?: string;
}

/** A fresh queue. A rejected link must not wedge the chain, so each link
 *  swallows the previous one's failure (the failing call still rejects to ITS
 *  caller). */
export function makeLoadQueue(): <T>(run: () => Promise<T>) => Promise<T> {
  let chain: Promise<unknown> = Promise.resolve();
  return <T,>(run: () => Promise<T>): Promise<T> => {
    const next = chain.catch(() => undefined).then(run);
    chain = next;
    return next;
  };
}

export const isStale = (opts?: LoadOpts): boolean =>
  !!opts?.isCurrent && !opts.isCurrent();

/** Marker update for a load that just replaced the document. Called inside the
 *  queue, so no queued save can run between the engine changing and the marker
 *  saying so. */
export function claimEngineDocument(opts?: LoadOpts): void {
  if (opts?.photoId !== undefined) setEngineDocument(opts.photoId);
}
