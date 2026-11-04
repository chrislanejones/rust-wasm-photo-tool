import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.*s");
const DAY = 86_400_000;

type Status = "pending" | "running" | "done" | "failed";

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      clerkId: "ai-owner", tier: "pro", dailyUsage: 0, usageResetAt: 0, createdAt: 0, updatedAt: 0,
    }),
  );
  /** A stored file of `n` bytes. */
  const file = (n: number) => t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(n)])));
  /** A job that finished `daysAgo` days ago (or is still running, with no completedAt). */
  const job = (
    status: Status,
    daysAgo: number | null,
    files: { input?: Id<"_storage">; mask?: Id<"_storage">; output?: Id<"_storage"> },
  ) =>
    t.run((ctx) =>
      ctx.db.insert("ai_jobs", {
        userId, photoKey: "p1", type: "inpaint", status,
        inputStorageId: files.input, maskStorageId: files.mask, outputStorageId: files.output,
        createdAt: Date.now() - 30 * DAY,
        completedAt: daysAgo === null ? undefined : Date.now() - daysAgo * DAY,
      }),
    );
  const exists = (id: Id<"_storage">) => t.run(async (ctx) => (await ctx.db.system.get(id)) !== null);
  const row = (id: Id<"ai_jobs">) => t.run((ctx) => ctx.db.get(id));
  return { t, userId, file, job, exists, row };
}

describe("aiJobFiles.expire", () => {
  test("a finished 8-day-old job: the dry run lists its files and deletes nothing; apply deletes them and keeps the row", async () => {
    const { t, file, job, exists, row } = await setup();
    const input = await file(100), mask = await file(20), output = await file(300);
    const id = await job("done", 8, { input, mask, output });

    const dry = await t.mutation(internal.aiJobFiles.expire, {});
    expect(dry).toMatchObject({ mode: "dry-run", jobs: 1, files: 3, bytes: 420, keptReferenced: 0, more: false });
    expect(dry.oldestFileCreatedAt).toEqual(expect.any(Number));
    for (const f of [input, mask, output]) expect(await exists(f)).toBe(true);
    expect(await row(id)).toMatchObject({ inputStorageId: input, outputStorageId: output });
    expect((await row(id))?.filesExpiredAt).toBeUndefined();

    const applied = await t.mutation(internal.aiJobFiles.expire, { apply: true });
    expect(applied).toMatchObject({ mode: "applied", jobs: 1, files: 3, bytes: 420 });
    for (const f of [input, mask, output]) expect(await exists(f)).toBe(false);
    const kept = await row(id);
    expect(kept).toMatchObject({ status: "done", type: "inpaint", photoKey: "p1" });
    expect(kept?.inputStorageId).toBeUndefined();
    expect(kept?.maskStorageId).toBeUndefined();
    expect(kept?.outputStorageId).toBeUndefined();
    expect(kept?.filesExpiredAt).toEqual(expect.any(Number));
  });

  test("failed jobs (failed, cancelled, timed out all land as failed) expire the same way", async () => {
    const { t, file, job, exists } = await setup();
    const input = await file(50);
    await job("failed", 10, { input });
    expect(await t.mutation(internal.aiJobFiles.expire, { apply: true })).toMatchObject({ jobs: 1, files: 1, bytes: 50 });
    expect(await exists(input)).toBe(false);
  });

  test("a 6-day-old job and a running job are untouched", async () => {
    const { t, file, job, exists, row } = await setup();
    const recent = await file(10), running = await file(11), pending = await file(12);
    const recentJob = await job("done", 6, { input: recent });
    const runningJob = await job("running", null, { input: running });
    await job("pending", null, { input: pending });

    expect(await t.mutation(internal.aiJobFiles.expire, { apply: true })).toMatchObject({ jobs: 0, files: 0, bytes: 0 });
    for (const f of [recent, running, pending]) expect(await exists(f)).toBe(true);
    expect((await row(recentJob))?.inputStorageId).toBe(recent);
    expect((await row(runningJob))?.inputStorageId).toBe(running);
  });

  test("a file shared with a share, an edit or a job that is not expiring survives; the expired job still lets go of it", async () => {
    const { t, userId, file, job, exists, row } = await setup();
    const sharedWithShare = await file(1), sharedWithEdit = await file(2), sharedWithRecentJob = await file(3);
    await t.run(async (ctx) => {
      await ctx.db.insert("shares", {
        token: "tok", userId, storageId: sharedWithShare, canvasW: 1, canvasH: 1, views: 0, createdAt: 0,
      });
      await ctx.db.insert("photo_edits", {
        userId, photoKey: "p1", storageId: sharedWithEdit, canvasW: 1, canvasH: 1, updatedAt: 0,
      });
    });
    await job("done", 2, { input: sharedWithRecentJob });
    const old = await job("done", 9, { input: sharedWithShare, mask: sharedWithEdit, output: sharedWithRecentJob });

    const dry = await t.mutation(internal.aiJobFiles.expire, {});
    expect(dry).toMatchObject({ jobs: 1, files: 0, bytes: 0, keptReferenced: 3 });

    await t.mutation(internal.aiJobFiles.expire, { apply: true });
    for (const f of [sharedWithShare, sharedWithEdit, sharedWithRecentJob]) expect(await exists(f)).toBe(true);
    const r = await row(old);
    expect(r?.inputStorageId).toBeUndefined();
    expect(r?.filesExpiredAt).toEqual(expect.any(Number));
  });

  test("two expiring jobs on one frame: the dry run counts it once, and apply deletes it", async () => {
    const { t, file, job, exists } = await setup();
    const frame = await file(64);
    await job("done", 8, { input: frame });
    await job("failed", 12, { input: frame });

    expect(await t.mutation(internal.aiJobFiles.expire, {})).toMatchObject({ jobs: 2, files: 1, bytes: 64, keptReferenced: 0 });
    expect(await t.mutation(internal.aiJobFiles.expire, { apply: true })).toMatchObject({ jobs: 2, files: 1, bytes: 64 });
    expect(await exists(frame)).toBe(false);
  });

  test("a second run finds nothing new; a job whose file had already vanished is still cleared", async () => {
    const { t, file, job, row } = await setup();
    const gone = await file(5);
    const id = await job("done", 8, { output: gone });
    await t.run((ctx) => ctx.storage.delete(gone));

    expect(await t.mutation(internal.aiJobFiles.expire, { apply: true })).toMatchObject({ jobs: 1, files: 0 });
    expect((await row(id))?.outputStorageId).toBeUndefined();
    expect(await t.mutation(internal.aiJobFiles.expire, { apply: true })).toMatchObject({ jobs: 0, files: 0, bytes: 0 });
    expect(await t.mutation(internal.aiJobFiles.expire, {})).toMatchObject({ jobs: 0, files: 0 });
  });

  test("more than maxJobs: one run does a batch and says more remain", async () => {
    const { t, file, job } = await setup();
    for (let i = 0; i < 3; i++) await job("done", 8 + i, { input: await file(1) });
    expect(await t.mutation(internal.aiJobFiles.expire, { apply: true, maxJobs: 2 })).toMatchObject({ jobs: 2, files: 2, more: true });
    expect(await t.mutation(internal.aiJobFiles.expire, { apply: true, maxJobs: 2 })).toMatchObject({ jobs: 1, files: 1, more: false });
  });
});
