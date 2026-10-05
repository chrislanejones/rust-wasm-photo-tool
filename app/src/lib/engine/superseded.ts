// A request the engine will never answer because its document was replaced
// (a photo switch, an import, an AI result) or released. That is not a
// failure — the work it was for no longer exists — so it resolves as
// "dropped" (Plan C §3): no error UI, and never an unhandled rejection.
//
// The messages are the ones `workerClient.failAll` rejects pending calls with.
const SUPERSEDED = ["engine document replaced", "engine released"];

export function isSuperseded(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return SUPERSEDED.some((m) => msg.includes(m));
}

/** For a fire-and-forget promise: swallow a superseded rejection, let any
 *  real failure through. `void p.catch(dropSuperseded)`. */
export function dropSuperseded(err: unknown): void {
  if (!isSuperseded(err)) throw err;
}

/**
 * The catch-all half of the rule. Dozens of engine calls are fired and
 * forgotten (a slider commit, a brush setting, a sync), and any of them can be
 * in flight when a photo switch replaces the document. Catching each one is a
 * list that is never finished, so the rule lives here once: a superseded
 * rejection nobody handled is dropped, silently. Anything else is still an
 * unhandled rejection and still reaches the console. Installed once, at boot.
 */
export function installDroppedRejectionHandler(target: Pick<Window, "addEventListener"> = window): void {
  target.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    if (isSuperseded(e.reason)) e.preventDefault();
  });
}
