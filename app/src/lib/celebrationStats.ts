// GENERATED — do not edit. Run: node marketing/scripts/gen-trail-data.mjs
//
// Shipping stats for the in-app celebration popper (Ctrl/Cmd + \), derived
// from marketing/src/data/releases.ts — the hand-written trail log.
//
// October 2026: 20 entries across 3 releases,
// against 1058 all-time. Latest release v9.9 (2026-10-02).
//
// The headline numbers are ENTRIES and RELEASES, never the feature count. A
// month can ship more than the one before it and carry fewer `feature` tags —
// October did exactly that, because the work landed as infrastructure and
// fixes. Leading with features would have made the busiest month in the log
// read as the quietest.

export interface CelebrationStats {
  /** Month the newest release falls in, e.g. "August". */
  month: string;
  /** Trail-log entries logged this month — the headline number. */
  monthShipped: number;
  /** Releases cut this month. */
  releases: number;
  /** Trail-log entries all time. */
  allTime: number;
  /** This month as a whole-number percentage of all time. */
  monthPct: number;
  /** `tag: "feature"` entries this month — a secondary chip, not the headline. */
  features: number;
  /** `tag: "fix"` entries this month. */
  fixes: number;
  /** Newest release in the log, e.g. "v8.57". */
  latestVersion: string;
}

export const CELEBRATION_STATS: CelebrationStats = {
  month: "October",
  monthShipped: 20,
  releases: 3,
  allTime: 1058,
  monthPct: 2,
  features: 1,
  fixes: 6,
  latestVersion: "v9.9",
};
