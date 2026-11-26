// When the "Happy Thanksgiving" banner shows, and how "I closed it" is
// remembered.
//
// US Thanksgiving is the fourth Thursday of November. The banner shows from
// the Friday the week before through the Sunday after, in the user's OWN time
// zone (a holiday banner that turns up on the wrong day reads as a bug, so it
// follows the local calendar, not UTC). It comes back by itself next year and
// needs no release to take it down.

/** Days before Thanksgiving the banner starts showing (the Friday before). */
const DAYS_BEFORE = 6;
/** Days after it keeps showing (through the Sunday after). */
const DAYS_AFTER = 3;

/** The fourth Thursday of November in `year`. */
export function thanksgivingDay(year: number): Date {
  const nov1 = new Date(year, 10, 1);
  const firstThursday = 1 + ((4 - nov1.getDay() + 7) % 7);
  return new Date(year, 10, firstThursday + 21);
}

/** True from the Friday before Thanksgiving through the Sunday after, local time. */
export function isThanksgivingSeason(now: Date): boolean {
  const day = thanksgivingDay(now.getFullYear());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Whole calendar days, rounded so a DST shift in between cannot tip it.
  const offset = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  return offset >= -DAYS_BEFORE && offset <= DAYS_AFTER;
}

/**
 * One key per YEAR, so closing the banner this November does not hide it
 * next November.
 */
export function dismissKey(now: Date): string {
  return `ih_thanksgiving_banner_closed_${now.getFullYear()}`;
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
