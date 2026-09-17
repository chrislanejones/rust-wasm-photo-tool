// GENERATED — do not edit. Run: node marketing/scripts/gen-trail-data.mjs
//
// Shipping stats for the in-app celebration popper (Ctrl/Cmd + \), derived
// from marketing/src/data/releases.ts — the hand-written trail log.
//
// September 2026: 97 entries across 18 releases,
// against 890 all-time. Latest release v8.79 (2026-09-16).
//
// The headline numbers are ENTRIES and RELEASES, never the feature count. A
// month can ship more than the one before it and carry fewer `feature` tags —
// September did exactly that, because the work landed as infrastructure and
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
  month: "September",
  monthShipped: 97,
  releases: 18,
  allTime: 890,
  monthPct: 11,
  features: 17,
  fixes: 28,
  latestVersion: "v8.79",
};
