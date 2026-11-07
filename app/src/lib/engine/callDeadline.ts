// A call's caller stops waiting at its timeout, and the worker must not run it
// after that.
//
// Cancellation alone can't promise this. The worker reads its port in order, so
// a request and its later "cancel" arrive with the wasm call ahead of them still
// running, and the drain can shift the request and enter wasm before the cancel
// is read. The mutation then lands on a document whose caller was told it failed.
// So each call carries its deadline, and the worker checks it just before entering
// wasm. A refused call is reported and never retried: a retry of a mutation could
// apply it twice.

/** Past this, nobody is waiting for the reply. */
export const CALL_TIMEOUT_MS = 30_000;

export const CALL_EXPIRED_ERROR = "engine call expired before it ran";

export function callExpired(deadline: number | undefined, now: number): boolean {
  return deadline !== undefined && now >= deadline;
}
