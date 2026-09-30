// Trash: when an item goes for good, said the way people read time
// (UI Night 6 §3).
//
// RELATIVE, not a date. "Removes in 5 days" — an absolute date makes people do
// arithmetic, and the one question they have is "how long have I got".
//
// Free and paid differ ONLY in the window (7 days vs 30). The view is the same;
// the number is the difference.
//
// BACKEND (Night 6 §0): no `deletedAt`, no purge cron — `convex/crons.ts`
// registers no jobs. Fixture-tested, wired to nothing.

export const TRASH_WINDOW_DAYS = { free: 7, paid: 30 } as const;

const DAY = 24 * 60 * 60 * 1000;

/** When an item trashed at `deletedAt` is removed for good. */
function purgeAt(deletedAt: number, paid: boolean): number {
  return deletedAt + (paid ? TRASH_WINDOW_DAYS.paid : TRASH_WINDOW_DAYS.free) * DAY;
}

/** "Removes in 5 days", "Removes tomorrow", "Removes today".
 *
 *  Rounds UP to whole days — "in 0 days" for something with twenty hours left
 *  would read as already gone. Anything already past its time is "today": the
 *  purge runs on a schedule, so it is still there until it does. */
export function removesIn(deletedAt: number, paid: boolean, now: number): string {
  const days = Math.ceil((purgeAt(deletedAt, paid) - now) / DAY);
  if (days <= 0) return "Removes today";
  if (days === 1) return "Removes tomorrow";
  return `Removes in ${days} days`;
}
