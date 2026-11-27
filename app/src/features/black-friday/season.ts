// When the "Black Friday" banner shows, and how "I closed it" is remembered.
//
// Black Friday is the day after US Thanksgiving (the fourth Thursday of
// November). The banner shows that Friday through the Sunday after, in the
// user's OWN time zone (a banner that turns up on the wrong day reads as a
// bug, so it follows the local calendar, not UTC). It comes back by itself
// next year and needs no release to take it down.

/** Days after Black Friday it keeps showing (through the Sunday). */
const DAYS_AFTER = 2;

/** The day after the fourth Thursday of November in `year`. */
export function blackFriday(year: number): Date {
  const nov1 = new Date(year, 10, 1);
  const firstThursday = 1 + ((4 - nov1.getDay() + 7) % 7);
  return new Date(year, 10, firstThursday + 22);
}

/** True from Black Friday through the Sunday after, local time. */
export function isBlackFridaySeason(now: Date): boolean {
  const day = blackFriday(now.getFullYear());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Whole calendar days, rounded so a DST shift in between cannot tip it.
  const offset = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  return offset >= 0 && offset <= DAYS_AFTER;
}

/**
 * One key per YEAR, so closing the banner this November does not hide it
 * next November.
 */
export function dismissKey(now: Date): string {
  return `ih_black_friday_banner_closed_${now.getFullYear()}`;
}

/** Storage can throw (private mode, blocked cookies), and a throw reads as "not closed". */
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
