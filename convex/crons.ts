import { cronJobs } from "convex/server";

const crons = cronJobs();

// ── Trash purge: WRITTEN, DELIBERATELY NOT SCHEDULED ─────────────────────────
//
// TODO(Chris): removes share links that have been in the trash longer than
// their owner's window (free 7 days, paid 30) — the row, its views and its
// image. Off until a person has read the dry run against the deployment:
//
//   pnpm exec convex run trash:purge '{}'
//
// To switch it on, add the `internal` import above and uncomment the line
// below. Once a day; each run handles up to 200 links.
//
// crons.interval("purge the trash", { hours: 24 }, internal.trash.purge, { apply: true });

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

// ── AI job files: WRITTEN, DELIBERATELY NOT SCHEDULED ────────────────────────
//
// TODO(Chris): deletes the input, mask and output frames of AI jobs that
// finished more than seven days ago (the rows stay). Off until a person has
// read the dry run against the deployment:
//
//   pnpm exec convex run aiJobFiles:expire '{}'
//
// To switch it on, add the `internal` import above and uncomment the line
// below. Once a day; each run handles up to 200 jobs per status.
//
// crons.interval("expire AI job files", { hours: 24 }, internal.aiJobFiles.expire, { apply: true });

// ── Transfer inbox expiry: WRITTEN, DELIBERATELY NOT SCHEDULED ───────────────
//
// TODO(Chris): removes photos that have waited in a Transfer inbox past their
// seven days (the row and its file). Off until a person has read the dry run
// against the deployment:
//
//   pnpm exec convex run transfers:expire '{}'
//
// To switch it on, add the `internal` import above and uncomment the line
// below. Once a day; each run handles up to 200 photos.
//
// crons.interval("expire the transfer inbox", { hours: 24 }, internal.transfers.expire, { apply: true });

// ── MCP call log: WRITTEN, DELIBERATELY NOT SCHEDULED ────────────────────────
//
// TODO(Chris): removes MCP call-log rows older than 30 days. Off until a person
// has read the dry run against the deployment:
//
//   pnpm exec convex run mcp:expire '{}'
//
// To switch it on, add the `internal` import above and uncomment the line below.
//
// crons.interval("expire the MCP call log", { hours: 24 }, internal.mcp.expire, { apply: true });

export default crons;
