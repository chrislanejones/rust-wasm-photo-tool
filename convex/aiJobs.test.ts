import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { fileIdsOf } from "./testAccount";
import { findOrphans } from "./storageOrphans";

const modules = import.meta.glob("./**/*.*s");

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run(ctx => ctx.db.insert("users", {
    clerkId: "reference-owner", tier: "pro", dailyUsage: 0,
    usageResetAt: Date.now(), createdAt: 0, updatedAt: 0,
  }));
  const refs = await t.run(async ctx => Promise.all([1, 2, 3].map(n =>
    ctx.storage.store(new Blob([new Uint8Array(n)])),
  )));
  return { t, userId, refs, owner: t.withIdentity({ subject: "reference-owner" }) };
}

describe("generate reference ownership", () => {
  test.each(["running", "done", "failed"] as const)("%s jobs protect all three references from discard and sweep", async status => {
    const { t, refs, owner } = await setup();
    const { jobId, referenceUrls } = await owner.mutation(internal.aiJobs.startGenerateJob, {
      prompt: "Test", model: "test/model", referenceStorageIds: refs,
    });
    expect(referenceUrls).toHaveLength(3);
    if (status === "done") await t.mutation(internal.aiJobs.completeJob, { jobId });
    if (status === "failed") await t.mutation(internal.aiJobs.failJob, { jobId, error: "provider refused" });
    const job = await t.run(ctx => ctx.db.get(jobId));
    expect(job?.status).toBe(status);
    expect(fileIdsOf("ai_jobs", job!)).toEqual(refs);
    const stranger = t.withIdentity({ subject: "another-user" });
    for (const storageId of refs) {
      expect(await stranger.mutation(api.photoEdits.discardFailedUpload, { storageId }))
        .toEqual({ deleted: false, reason: "referenced" });
      expect(await t.run(ctx => ctx.db.system.get(storageId))).not.toBeNull();
    }
    const files = refs.map(_id => ({ _id, _creationTime: 0, size: 1 }));
    expect(findOrphans(files, [job], Date.now(), 0).orphans).toEqual([]);
  });

  test("missing references roll back the job and usage, and uploaded siblings can be discarded", async () => {
    const { t, refs, owner, userId } = await setup();
    await t.run(ctx => ctx.storage.delete(refs[1]));
    await expect(owner.mutation(internal.aiJobs.startGenerateJob, {
      prompt: "Test", model: "test/model", referenceStorageIds: refs,
    })).rejects.toThrow("Reference image not found");
    expect(await t.run(ctx => ctx.db.query("ai_jobs").collect())).toEqual([]);
    expect((await t.run(ctx => ctx.db.get(userId)))?.dailyUsage).toBe(0);
    expect(await owner.mutation(api.photoEdits.discardFailedUpload, { storageId: refs[0] }))
      .toEqual({ deleted: true, reason: "unreferenced" });
  });

  test("more than three references fail before charging or inserting", async () => {
    const { t, refs, owner, userId } = await setup();
    await expect(owner.mutation(internal.aiJobs.startGenerateJob, {
      prompt: "Test", model: "test/model", referenceStorageIds: [...refs, refs[0]],
    })).rejects.toThrow("At most three");
    expect((await t.run(ctx => ctx.db.get(userId)))?.dailyUsage).toBe(0);
    expect(await t.run(ctx => ctx.db.query("ai_jobs").collect())).toEqual([]);
  });

  test("a text-only job and an old job need no new fields", async () => {
    const { t, owner } = await setup();
    const { jobId, referenceUrls } = await owner.mutation(internal.aiJobs.startGenerateJob, {
      prompt: "Test", model: "test/model", referenceStorageIds: [],
    });
    expect(referenceUrls).toEqual([]);
    expect(fileIdsOf("ai_jobs", (await t.run(ctx => ctx.db.get(jobId)))!)).toEqual([]);
  });
});
