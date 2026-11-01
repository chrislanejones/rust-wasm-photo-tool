// When the "Fall Back" banner shows, and how "I closed it" is remembered.
//
// Clocks fall back an hour on the first Sunday of November (US and Canada).
// The banner shows from the Monday before that Sunday through the Tuesday
// after it, in the user's OWN time zone — a reminder that turns up on the
// wrong day reads as a bug, so it follows the local calendar, not UTC. It
// comes back by itself next year and needs no release to take it down.

/** Days before the change the banner starts showing (the Monday before). */
const DAYS_BEFORE = 6;
/** Days after the change it keeps showing (through the Tuesday after). */
const DAYS_AFTER = 2;

/** The first Sunday of November in `year`: the day clocks fall back. */
export function fallBackDay(year: number): Date {
  const nov1 = new Date(year, 10, 1);
  return new Date(year, 10, 1 + ((7 - nov1.getDay()) % 7));
}

/** True from the Monday before the first Sunday of November through the Tuesday after, local time. */
export function isFallBackSeason(now: Date): boolean {
  const day = fallBackDay(now.getFullYear());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Whole calendar days, rounded so a DST shift in between cannot tip it.
  const offset = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  return offset >= -DAYS_BEFORE && offset <= DAYS_AFTER;
}

/**
 * One key per YEAR, so closing the banner this autumn does not hide it next
 * autumn.
 */
export function dismissKey(now: Date): string {
  return `ih_fall_back_banner_closed_${now.getFullYear()}`;
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
