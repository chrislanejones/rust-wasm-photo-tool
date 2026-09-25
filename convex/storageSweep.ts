import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id, TableNames } from "./_generated/dataModel";
import schema from "./schema";
import { findOrphans, totalsByWeek, type StoredFile } from "./storageOrphans";

// ── The server-side orphan sweep ──────────────────────────────────────────────
//
// THE GUARANTEE THE CLIENT CANNOT GIVE. An upload is bytes first, pointer
// second, and the second step runs in a browser that can close, lose its
// network, or time out while the upload finishes without it. Measured 09-24:
// every one of the 167 orphans is `application/octet-stream` — the edit-archive
// path — and 108 of them are over 30 MiB, where only 3 of the 34 archives that
// DID commit are. That is the 8-second client timeout around the archive POST
// giving up on a large upload that then lands anyway, with no storage id in
// hand to discard. Only the server can see those files, so only the server can
// collect them. `storageOrphans.ts` has the decision and why it walks every
// string in every table.
//
// ⚠️ DRY RUN UNLESS TOLD OTHERWISE. With no arguments this deletes nothing: it
// reports what it WOULD delete. Deleting needs `apply: true`, spelled out, and
// it is not scheduled anywhere yet — see the commented line in crons.ts. A job
// that deletes user data unattended is Chris's call to switch on, after he has
// read a dry run against the live deployment.
//
//   pnpm exec convex run storageSweep:sweep '{}'              # report only
//   pnpm exec convex run storageSweep:sweep '{"apply": true}' # deletes
//
// WHEN IT REFUSES TO DELETE. If any table (or `_storage` itself) has more rows
// than one transaction may read, the reference scan is incomplete, and a file
// that looks unreferenced may be referenced by a row the scan never reached.
// The sweep then reports `complete: false` and deletes nothing, even with
// `apply: true`. At that size this needs to become a paginated, multi-step job;
// failing closed is what makes that a later problem rather than a data loss.

/** Rows read per table. The live backend's largest table holds 34 rows. */
const ROW_CAP = 4_000;
/** Files read from `_storage`. The live backend holds 207. */
const FILE_CAP = 4_000;
/** Default grace period. An upload→pointer gap is seconds; a day is margin. */
const DEFAULT_OLDER_THAN_HOURS = 24;
/** Never sweep anything younger than this, whatever the caller asks. */
const MIN_OLDER_THAN_HOURS = 1;
/** Deletes per run. Keeps one run inside a transaction's write budget. */
const DEFAULT_MAX_DELETES = 200;
/** Orphans itemized in the return value (totals always cover all of them). */
const LIST_CAP = 500;

export const sweep = internalMutation({
  args: {
    /** Delete the orphans. Absent or false = report only. */
    apply: v.optional(v.boolean()),
    /** Only files at least this old are eligible. Minimum 1. Default 24. */
    olderThanHours: v.optional(v.number()),
    /** Upper bound on deletes in this run. Default 200. */
    maxDeletes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const apply = args.apply === true;
    const olderThanHours = args.olderThanHours ?? DEFAULT_OLDER_THAN_HOURS;
    if (!Number.isFinite(olderThanHours) || olderThanHours < MIN_OLDER_THAN_HOURS) {
      throw new Error(
        `olderThanHours must be at least ${MIN_OLDER_THAN_HOURS}: a younger unreferenced file is very likely an upload whose save has not landed yet`,
      );
    }
    const maxDeletes = Math.max(0, Math.floor(args.maxDeletes ?? DEFAULT_MAX_DELETES));
    const now = Date.now();

    // 1. Every stored file.
    const rawFiles = await ctx.db.system.query("_storage").take(FILE_CAP + 1);
    let complete = rawFiles.length <= FILE_CAP;
    const files: StoredFile[] = rawFiles.slice(0, FILE_CAP).map((f) => ({
      _id: f._id,
      _creationTime: f._creationTime,
      size: f.size,
      contentType: f.contentType,
    }));

    // 2. Every row of every table the schema declares. `findOrphans` walks
    //    every string in them for a storage id (storageOrphans.ts says why).
    const rows: unknown[] = [];
    const truncatedTables: string[] = [];
    for (const table of Object.keys(schema.tables) as TableNames[]) {
      const tableRows = await ctx.db.query(table).take(ROW_CAP + 1);
      if (tableRows.length > ROW_CAP) {
        complete = false;
        truncatedTables.push(table);
      }
      rows.push(...tableRows);
    }

    // 3. Decide.
    const verdict = findOrphans(files, rows, now, olderThanHours * 3_600_000);
    const orphanBytes = verdict.orphans.reduce((n, f) => n + f.size, 0);

    // 4. Delete only when asked AND the scan saw everything.
    let deleted = 0;
    if (apply && complete) {
      for (const f of verdict.orphans.slice(0, maxDeletes)) {
        await ctx.storage.delete(f._id as Id<"_storage">);
        deleted += 1;
      }
    }

    const mode = apply ? (complete ? "applied" : "refused-incomplete-scan") : "dry-run";
    console.log(
      `storageSweep ${mode}: ${files.length} files, ${verdict.referenced} referenced, ` +
        `${verdict.orphans.length} orphans (${orphanBytes} bytes) older than ${olderThanHours}h, ` +
        `${verdict.tooYoung.length} too young, ${deleted} deleted`,
    );

    return {
      mode,
      complete,
      truncatedTables,
      olderThanHours,
      files: files.length,
      referenced: verdict.referenced,
      tooYoung: {
        files: verdict.tooYoung.length,
        bytes: verdict.tooYoung.reduce((n, f) => n + f.size, 0),
      },
      orphans: {
        files: verdict.orphans.length,
        bytes: orphanBytes,
        byWeek: totalsByWeek(verdict.orphans),
        list: verdict.orphans.slice(0, LIST_CAP).map((f) => ({
          storageId: f._id,
          size: f.size,
          contentType: f.contentType ?? null,
          createdAt: f._creationTime,
        })),
      },
      deleted,
    };
  },
});
