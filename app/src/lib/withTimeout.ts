/**
 * Race `p` against a timer, and when the timer wins, CANCEL the work rather
 * than abandon it.
 *
 * The version this replaces rejected and walked away. For a Convex mutation
 * that is all a client can do, but for an upload it was the storage leak
 * ADR-083 measured (167 of 207 files, 6,333.7 MiB): the 8 s timer rejected,
 * the `fetch` kept streaming, the file landed in storage, and the client never
 * learned its id, so nothing could ever point at it or collect it. On a slow
 * link that is the COMMON case, not the edge.
 *
 * Pass the `AbortController` whose signal the work was started with, and a
 * timeout aborts it: the browser tears the request down and the upload never
 * completes, so there is no file to strand. Leave it out (a Convex mutation,
 * which has no signal) and this behaves as before.
 *
 * Only the TIMER aborts. A caller that stops waiting for other reasons (a
 * photo switch detaching its save) simply does not await; the work is meant
 * to finish in the background, and it does.
 *
 * The timer is cleared when `p` settles, so a fast call leaves nothing armed.
 */
export function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  what: string,
  opts?: { abort?: AbortController; message?: string },
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(opts?.message ?? `${what} did not settle within ${ms}ms`);
      // Abort FIRST, so by the time anyone sees the rejection the request is
      // already being torn down.
      opts?.abort?.abort(err);
      reject(err);
    }, ms);
  });
  return Promise.race([p, timedOut]).finally(() => clearTimeout(timer));
}
