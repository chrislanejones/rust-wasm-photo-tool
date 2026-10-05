import { cronJobs } from "convex/server";

const crons = cronJobs();

// ── Orphaned-storage sweep: WRITTEN, DELIBERATELY NOT SCHEDULED ──────────────
//
// TODO(Chris): this is a job that deletes files from user storage with nobody
// watching. It stays off until a person has run the dry run against the live
// deployment and read what it would delete:
//
//   pnpm exec convex run storageSweep:sweep '{}'
//
// To switch it on, add `import { internal } from "./_generated/api";` above and
// uncomment the line below. Every six hours, files unreferenced for a day.
// `crons.interval`, not `crons.hourly` — see convex/_generated/ai/guidelines.md.
//
// crons.interval("sweep orphaned storage", { hours: 6 }, internal.storageSweep.sweep, { apply: true, olderThanHours: 24 });

export default crons;
