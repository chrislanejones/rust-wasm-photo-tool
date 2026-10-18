import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { fileIdsOf } from "./testAccount";
import { findOrphans } from "./storageOrphans";

afterEach(() => vi.unstubAllEnvs());

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
  test("running jobs protect all three references from discard and sweep", async () => {
    const status = "running";
    const { t, refs, owner } = await setup();
    const { jobId, referenceUrls } = await owner.mutation(internal.aiJobs.startGenerateJob, {
      prompt: "Test", model: "test/model", referenceStorageIds: refs,
    });
    expect(referenceUrls).toHaveLength(3);
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

  test.each(["succeeded", "failed", "cancelled", "timed out"])("%s releases all reference files, including repeated callbacks", async status => {
    const { t, refs, owner } = await setup();
    const { jobId } = await owner.mutation(internal.aiJobs.startGenerateJob, {
      prompt: "Test", model: "test/model", referenceStorageIds: refs,
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      if (status === "succeeded") await t.mutation(internal.aiJobs.completeJob, { jobId });
      else await t.mutation(internal.aiJobs.failJob, { jobId, error: status });
    }
    expect(fileIdsOf("ai_jobs", (await t.run(ctx => ctx.db.get(jobId)))!)).toEqual([]);
    expect(await t.run(ctx => ctx.db.system.query("_storage").collect())).toEqual([]);
  });

  test.each([
    ["succeeded", ""], ["failed", "provider error"],
    ["canceled", "cancelled"], ["failed", "Prediction timed out"],
  ])("signed %s webhook (%s) releases references", async (status, error) => {
    const { t, refs, owner } = await setup();
    const { jobId } = await owner.mutation(internal.aiJobs.startGenerateJob, {
      prompt: "Test", model: "test/model", referenceStorageIds: refs,
    });
    await t.mutation(internal.aiJobs.setReplicateId, { jobId, replicateId: "prediction" });
    const secret = new TextEncoder().encode("test-only-webhook-key");
    vi.stubEnv("REPLICATE_WEBHOOK_SIGNING_SECRET", btoa(String.fromCharCode(...secret)));
    const body = JSON.stringify({ id: "prediction", status, error, output: [] });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`event.${timestamp}.${body}`));
    const response = await t.fetch("/replicate-webhook", {
      method: "POST", body, headers: {
        "webhook-id": "event", "webhook-timestamp": timestamp,
        "webhook-signature": `v1,${btoa(String.fromCharCode(...new Uint8Array(signature)))}`,
      },
    });
    expect(response.status).toBe(200);
    expect(await t.run(ctx => ctx.db.system.query("_storage").collect())).toEqual([]);
  });

  test("another running job retains a shared reference until its own completion", async () => {
    const { t, refs, owner } = await setup();
    const start = () => owner.mutation(internal.aiJobs.startGenerateJob, {
      prompt: "Test", model: "test/model", referenceStorageIds: [refs[0], refs[0]],
    });
    const first = await start();
    const second = await start();
    await t.mutation(internal.aiJobs.completeJob, { jobId: first.jobId });
    expect(await t.run(ctx => ctx.db.system.get(refs[0]))).not.toBeNull();
    await t.mutation(internal.aiJobs.failJob, { jobId: second.jobId, error: "cancelled" });
    expect(await t.run(ctx => ctx.db.system.get(refs[0]))).toBeNull();
  });

  test("a saved archive and the job output survive reference cleanup", async () => {
    const { t, refs, owner } = await setup();
    const { jobId } = await owner.mutation(internal.aiJobs.startGenerateJob, {
      prompt: "Test", model: "test/model", referenceStorageIds: refs,
    });
    await owner.mutation(api.photoEdits.save, {
      photoKey: "shared", storageId: refs[0], canvasW: 1, canvasH: 1,
    });
    await t.mutation(internal.aiJobs.completeJob, { jobId, outputStorageId: refs[1] });
    expect(await t.run(ctx => ctx.db.system.get(refs[0]))).not.toBeNull();
    expect(await t.run(ctx => ctx.db.system.get(refs[1]))).not.toBeNull();
    expect(await t.run(ctx => ctx.db.system.get(refs[2]))).toBeNull();
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
