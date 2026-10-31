// When the Halloween banner shows, and how "I closed it" is remembered.
//
// The window is the last week of October in the user's OWN time zone — a
// banner that says "Happy Halloween" on the wrong day reads as a bug, so it
// follows the local calendar, not UTC. It comes back by itself next year and
// needs no release to take it down: after October 31 it renders nothing.

/** First day (of October) the banner shows. Through the 31st, inclusive. */
const HALLOWEEN_FIRST_DAY = 24;

/** True from October 24 through October 31, local time. */
export function isHalloweenSeason(now: Date): boolean {
  return now.getMonth() === 9 && now.getDate() >= HALLOWEEN_FIRST_DAY;
}

/**
 * One key per YEAR, so closing the banner this October does not hide it next
 * October.
 */
export function dismissKey(now: Date): string {
  return `ih_halloween_banner_closed_${now.getFullYear()}`;
}

/** Storage can throw (private mode, blocked cookies) — a throw reads as "not closed". */
export function readDismissed(storage: Pick<Storage, "getItem"> | undefined, now: Date): boolean {
  try {
    return storage?.getItem(dismissKey(now)) === "1";
  } catch {
    return false;
  }
}

export function writeDismissed(storage: Pick<Storage, "setItem"> | undefined, now: Date): void {
  try {
    storage?.setItem(dismissKey(now), "1");
  } catch {
    // Closing still works for this visit; it just will not be remembered.
  }
}
