import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// ── AI job files expire seven days after the job finishes ─────────────────────
//
// THE PILE THIS STOPS. Every AI run keeps up to three frames on its `ai_jobs`
// row: the input the model was handed, the mask (inpaint), and the output the
// webhook wrote back. Nothing in the app ever deletes them, so they stayed
// forever. The client reads a job's output exactly once, right after it
// finishes (useAIJob, useImageGeneration); after that the pixels live in the
// browser and the server copy is dead weight.
//
// WHAT GOES, WHAT STAYS. Seven days after a job finishes (done or failed —
// "failed" covers cancelled and timed out, see failJob), its storage-id fields
// are cleared and the files they named are deleted. THE ROW STAYS: type,
// status, timestamps and error are the usage history, and the AI caps and the
// Settings › AI Usage pane read the user row's counters, not these files.
// `filesExpiredAt` is written on every row this visits, files or none, so the
// index below drops it and a second run reads nothing it has already done.
//
// NEVER A FILE SOMETHING ELSE USES. A frame can be referenced by another job
// (two runs on the same frame), by an edit archive or by a share. Before a file
// is deleted every storage-id index is asked (ADR-089), the same lookups
// `discardFailedUpload` makes. References from the jobs in THIS batch do not
// count, because they are being cleared in the same transaction — otherwise two
// expiring jobs on one frame would each protect the file for the other, the dry
// run would report nothing, and the apply would still delete it.
//
// ⚠️ DRY RUN UNLESS TOLD OTHERWISE, like the orphan sweep. With no arguments
// this deletes nothing and writes nothing: it reports what it WOULD delete.
// Not scheduled — see the commented line in crons.ts. Switching it on is
// Chris's call, after reading a dry run against the deployment.
//
//   pnpm exec convex run aiJobFiles:expire '{}'              # report only
//   pnpm exec convex run aiJobFiles:expire '{"apply": true}' # deletes

/** Days after a job finishes before its files go. */
export const AI_FILES_EXPIRE_DAYS = 7;
const DAY_MS = 86_400_000;
/** Jobs per run, per status. Keeps one run inside a transaction's budget. */
const DEFAULT_MAX_JOBS = 200;

type JobFileField =
  | "inputStorageId"
  | "maskStorageId"
  | "outputStorageId"
  | "referenceStorageId1"
  | "referenceStorageId2"
  | "referenceStorageId3";

/** Every storage-id field on an `ai_jobs` row. References are normally already
 *  released at the terminal state (aiJobs.releaseReferences); they are listed
 *  so an old row that kept one is cleaned the same way. */
const JOB_FILE_FIELDS: readonly JobFileField[] = [
  "inputStorageId",
  "maskStorageId",
  "outputStorageId",
  "referenceStorageId1",
  "referenceStorageId2",
  "referenceStorageId3",
];

function filesOf(job: Doc<"ai_jobs">): Id<"_storage">[] {
  const out: Id<"_storage">[] = [];
  for (const f of JOB_FILE_FIELDS) {
    const id = job[f];
    if (id !== undefined) out.push(id);
  }
  return out;
}

/**
 * Is `id` referenced by any row OTHER than the jobs in `ignore`? One index
 * lookup per storage-id field (ADR-089), so the answer does not depend on how
 * big a table is. An ai_jobs lookup reads at most `ignore.size + 1` rows: that
 * is enough to find one row outside the ignored set if there is one.
 */
async function referencedOutside(
  ctx: MutationCtx,
  id: Id<"_storage">,
  ignore: ReadonlySet<Id<"ai_jobs">>,
): Promise<boolean> {
  if (await ctx.db.query("photo_edits").withIndex("by_storageId", (q) => q.eq("storageId", id)).first()) return true;
  if (await ctx.db.query("shares").withIndex("by_storageId", (q) => q.eq("storageId", id)).first()) return true;
  const n = ignore.size + 1;
  const lookups = [
    ctx.db.query("ai_jobs").withIndex("by_inputStorageId", (q) => q.eq("inputStorageId", id)).take(n),
    ctx.db.query("ai_jobs").withIndex("by_maskStorageId", (q) => q.eq("maskStorageId", id)).take(n),
    ctx.db.query("ai_jobs").withIndex("by_outputStorageId", (q) => q.eq("outputStorageId", id)).take(n),
    ctx.db.query("ai_jobs").withIndex("by_referenceStorageId1", (q) => q.eq("referenceStorageId1", id)).take(n),
    ctx.db.query("ai_jobs").withIndex("by_referenceStorageId2", (q) => q.eq("referenceStorageId2", id)).take(n),
    ctx.db.query("ai_jobs").withIndex("by_referenceStorageId3", (q) => q.eq("referenceStorageId3", id)).take(n),
  ];
  for (const rows of await Promise.all(lookups)) {
    if (rows.some((r) => !ignore.has(r._id))) return true;
  }
  return false;
}

export const expire = internalMutation({
  args: {
    /** Delete the files. Absent or false = report only, nothing written. */
    apply: v.optional(v.boolean()),
    /** Jobs per status per run. Default 200. */
    maxJobs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const apply = args.apply === true;
    const maxJobs = Math.max(1, Math.floor(args.maxJobs ?? DEFAULT_MAX_JOBS));
    const now = Date.now();
    const cutoff = now - AI_FILES_EXPIRE_DAYS * DAY_MS;

    // 1. Finished jobs past the window that have not been visited yet.
    const jobs: Doc<"ai_jobs">[] = [];
    let more = false;
    for (const status of ["done", "failed"] as const) {
      const batch = await ctx.db
        .query("ai_jobs")
        .withIndex("by_status_filesExpiredAt_completedAt", (q) =>
          q.eq("status", status).eq("filesExpiredAt", undefined).lt("completedAt", cutoff),
        )
        .take(maxJobs + 1);
      if (batch.length > maxJobs) more = true;
      jobs.push(...batch.slice(0, maxJobs));
    }
    // `lt` on an optional field also matches rows with no `completedAt` at all
    // (undefined sorts first). A finished job always has one; a row without it
    // is not known to be finished, so it is left alone.
    const finished = jobs.filter((j) => j.completedAt !== undefined);
    const ignore = new Set(finished.map((j) => j._id));

    // 2. Their files, once each, and which of them nothing else uses.
    const candidates = new Set<Id<"_storage">>();
    for (const job of finished) for (const id of filesOf(job)) candidates.add(id);

    const doomed: { storageId: Id<"_storage">; size: number; createdAt: number }[] = [];
    let kept = 0;
    for (const id of candidates) {
      const meta = await ctx.db.system.get("_storage", id);
      if (!meta) continue; // already gone: the field is still cleared below
      if (await referencedOutside(ctx, id, ignore)) {
        kept += 1;
        continue;
      }
      doomed.push({ storageId: id, size: meta.size, createdAt: meta._creationTime });
    }

    // 3. Write only when asked. Rows first, then files, in one transaction.
    if (apply) {
      for (const job of finished) {
        await ctx.db.patch("ai_jobs", job._id, {
          inputStorageId: undefined,
          maskStorageId: undefined,
          outputStorageId: undefined,
          referenceStorageId1: undefined,
          referenceStorageId2: undefined,
          referenceStorageId3: undefined,
          filesExpiredAt: now,
        });
      }
      for (const f of doomed) await ctx.storage.delete(f.storageId);
    }

    const bytes = doomed.reduce((n, f) => n + f.size, 0);
    const oldest = doomed.reduce<number | null>((m, f) => (m === null || f.createdAt < m ? f.createdAt : m), null);
    const mode = apply ? "applied" : "dry-run";
    console.log(
      `aiJobFiles.expire ${mode}: ${finished.length} jobs finished before ${new Date(cutoff).toISOString()}, ` +
        `${doomed.length} files (${bytes} bytes), ${kept} kept as still referenced${more ? ", more remain" : ""}`,
    );

    return {
      mode,
      olderThanDays: AI_FILES_EXPIRE_DAYS,
      jobs: finished.length,
      files: doomed.length,
      bytes,
      oldestFileCreatedAt: oldest,
      keptReferenced: kept,
      /** True when a status had more eligible jobs than `maxJobs`: run again. */
      more,
    };
  },
});
