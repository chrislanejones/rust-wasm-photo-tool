// Backend regression suite for the edit archive's two file-losing paths.
//
// These run the real mutations against convex-test's in-memory backend, so a
// storage delete, an index lookup and a rolled-back throw all behave as they
// do on a deployment. Run with `pnpm test:convex`.
//
// 1. `discardFailedUpload` used to decide "unreferenced" by reading the first
//    2,000 rows of each table. A file referenced by row 2,001 read as garbage
//    and was deleted out from under a live record.
// 2. `save` with the storage id the record already holds (a retried save)
//    deleted "the previous archive" — which was the archive it had just been
//    asked to keep — and left the record pointing at nothing.
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}

const modules = import.meta.glob("./**/*.*s");

const MiB = 1024 * 1024;
/** One past the old scan window, so the referencing row is the 2,001st. */
const FILLER_ROWS = 2_000;

function setup() {
  const t = convexTest(schema, modules);
  return { t, alice: t.withIdentity({ subject: "user_alice" }) };
}

type T = ReturnType<typeof setup>["t"];

async function storeFile(t: T, bytes = 16): Promise<Id<"_storage">> {
  return await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(bytes)])));
}

async function deleteFile(t: T, id: Id<"_storage">): Promise<void> {
  await t.run((ctx) => ctx.storage.delete(id));
}

async function fileExists(t: T, id: Id<"_storage">): Promise<boolean> {
  return (await t.run((ctx) => ctx.db.system.get(id))) !== null;
}

/** A user row for `subject`, as `requireUser` would create it. */
async function userFor(t: T, subject: string): Promise<Id<"users">> {
  return await t.run((ctx) =>
    ctx.db.insert("users", {
      clerkId: subject,
      tier: "free",
      dailyUsage: 0,
      usageResetAt: 0,
      createdAt: 0,
      updatedAt: 0,
    }),
  );
}

async function edits(t: T) {
  return await t.run((ctx) => ctx.db.query("photo_edits").collect());
}

async function insertEdit(t: T, userId: Id<"users">, photoKey: string, storageId: Id<"_storage">) {
  return await t.run((ctx) =>
    ctx.db.insert("photo_edits", { userId, photoKey, storageId, canvasW: 10, canvasH: 10, updatedAt: 0 }),
  );
}

// ── discardFailedUpload ──────────────────────────────────────────────────────

/** Every field that can hold a storage id, with how to write a row that
 *  references one and how to write filler rows in the same table. */
const REFERENCES: ReadonlyArray<{
  field: string;
  filler: (userId: Id<"users">, spare: Id<"_storage">, i: number) => { table: "photo_edits" | "shares" | "ai_jobs"; doc: object };
  ref: (userId: Id<"users">, storageId: Id<"_storage">) => { table: "photo_edits" | "shares" | "ai_jobs"; doc: object };
}> = (() => {
  const edit = (userId: Id<"users">, storageId: Id<"_storage">, key: string) => ({
    table: "photo_edits" as const,
    doc: { userId, photoKey: key, storageId, canvasW: 1, canvasH: 1, updatedAt: 0 },
  });
  const share = (userId: Id<"users">, storageId: Id<"_storage">, token: string) => ({
    table: "shares" as const,
    doc: { token, userId, storageId, canvasW: 1, canvasH: 1, views: 0, createdAt: 0 },
  });
  const job = (userId: Id<"users">, extra: object) => ({
    table: "ai_jobs" as const,
    doc: { userId, photoKey: "p", type: "rembg", status: "done", createdAt: 0, ...extra },
  });
  return [
    {
      field: "photo_edits.storageId",
      filler: (u, spare, i) => edit(u, spare, `filler-${i}`),
      ref: (u, id) => edit(u, id, "the-one"),
    },
    {
      field: "shares.storageId",
      filler: (u, spare, i) => share(u, spare, `filler-${i}`),
      ref: (u, id) => share(u, id, "the-one"),
    },
    {
      field: "ai_jobs.inputStorageId",
      filler: (u) => job(u, {}),
      ref: (u, id) => job(u, { inputStorageId: id }),
    },
    {
      field: "ai_jobs.outputStorageId",
      filler: (u) => job(u, {}),
      ref: (u, id) => job(u, { outputStorageId: id }),
    },
    {
      field: "ai_jobs.maskStorageId",
      filler: (u) => job(u, {}),
      ref: (u, id) => job(u, { maskStorageId: id }),
    },
  ];
})();

describe("discardFailedUpload", () => {
  test.each(REFERENCES)("refuses a file referenced beyond row 2,000 by $field", async ({ filler, ref }) => {
    const { t, alice } = setup();
    // Owned by someone else: the refusal must not depend on who asks.
    const owner = await userFor(t, "user_owner");
    const spare = await storeFile(t);
    const target = await storeFile(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < FILLER_ROWS; i++) {
        const { table, doc } = filler(owner, spare, i);
        await ctx.db.insert(table, doc as never);
      }
      const { table, doc } = ref(owner, target);
      await ctx.db.insert(table, doc as never);
    });

    const result = await alice.mutation(api.photoEdits.discardFailedUpload, { storageId: target });

    expect(result).toEqual({ deleted: false, reason: "referenced" });
    expect(await fileExists(t, target)).toBe(true);
  });

  test("refuses a file referenced by more than one row", async () => {
    const { t, alice } = setup();
    const owner = await userFor(t, "user_owner");
    const target = await storeFile(t);
    await insertEdit(t, owner, "a", target);
    await t.run(async (ctx) => {
      await ctx.db.insert("ai_jobs", {
        userId: owner, photoKey: "a", type: "rembg", status: "done", createdAt: 0,
        inputStorageId: target, outputStorageId: target,
      });
      await ctx.db.insert("ai_jobs", {
        userId: owner, photoKey: "b", type: "rembg", status: "done", createdAt: 0,
        inputStorageId: target,
      });
    });

    const result = await alice.mutation(api.photoEdits.discardFailedUpload, { storageId: target });

    expect(result).toEqual({ deleted: false, reason: "referenced" });
    expect(await fileExists(t, target)).toBe(true);
  });

  test("deletes a file nothing references", async () => {
    const { t, alice } = setup();
    const owner = await userFor(t, "user_owner");
    const other = await storeFile(t);
    await insertEdit(t, owner, "a", other);
    const stranded = await storeFile(t);

    const result = await alice.mutation(api.photoEdits.discardFailedUpload, { storageId: stranded });

    expect(result).toEqual({ deleted: true, reason: "unreferenced" });
    expect(await fileExists(t, stranded)).toBe(false);
    expect(await fileExists(t, other)).toBe(true);
  });
});

// ── save ─────────────────────────────────────────────────────────────────────

const save = (photoKey: string, storageId: Id<"_storage">, canvasW = 100, canvasH = 80) => ({
  photoKey,
  storageId,
  canvasW,
  canvasH,
});

describe("save", () => {
  test("a repeated identical save keeps the archive and leaves the record untouched", async () => {
    const { t, alice } = setup();
    const file = await storeFile(t);
    await alice.mutation(api.photoEdits.save, save("a", file));
    // A known timestamp, so "untouched" is observable even within one ms.
    await t.run(async (ctx) => {
      const row = (await ctx.db.query("photo_edits").unique())!;
      await ctx.db.patch(row._id, { updatedAt: 1_000 });
    });
    const before = await edits(t);

    await alice.mutation(api.photoEdits.save, save("a", file));

    expect(await fileExists(t, file)).toBe(true);
    expect(await edits(t)).toEqual(before);
    expect(before[0].updatedAt).toBe(1_000);
  });

  test("the same file with new dimensions updates the metadata and keeps the archive", async () => {
    const { t, alice } = setup();
    const file = await storeFile(t);
    await alice.mutation(api.photoEdits.save, save("a", file, 100, 80));

    await alice.mutation(api.photoEdits.save, save("a", file, 200, 160));

    expect(await fileExists(t, file)).toBe(true);
    const rows = await edits(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ storageId: file, canvasW: 200, canvasH: 160 });
  });

  test("a same-file save succeeds at the quota without counting its bytes twice", async () => {
    const { t, alice } = setup();
    // 60 MiB of a free account's 100: a second copy would be 120.
    const file = await storeFile(t, 60 * MiB);
    await alice.mutation(api.photoEdits.save, save("a", file));

    await alice.mutation(api.photoEdits.save, save("a", file));

    expect(await fileExists(t, file)).toBe(true);
    expect((await edits(t))[0].storageId).toBe(file);
  });

  test("a same-file save succeeds for an account already over its quota", async () => {
    const { t, alice } = setup();
    const userId = await userFor(t, "user_alice");
    const file = await storeFile(t, 101 * MiB);
    await insertEdit(t, userId, "a", file);

    await alice.mutation(api.photoEdits.save, save("a", file, 10, 10));

    expect(await fileExists(t, file)).toBe(true);
    expect((await edits(t))[0].storageId).toBe(file);
  });

  test("a missing incoming file fails without touching the record", async () => {
    const { t, alice } = setup();
    const kept = await storeFile(t);
    await alice.mutation(api.photoEdits.save, save("a", kept));
    const before = await edits(t);
    const gone = await storeFile(t);
    await deleteFile(t, gone);

    await expect(alice.mutation(api.photoEdits.save, save("a", gone))).rejects.toThrow(/not found in storage/);
    await expect(alice.mutation(api.photoEdits.save, save("b", gone))).rejects.toThrow(/not found in storage/);

    expect(await edits(t)).toEqual(before);
    expect(await fileExists(t, kept)).toBe(true);
  });

  test("a same-file save whose file has vanished fails instead of succeeding as a no-op", async () => {
    const { t, alice } = setup();
    const file = await storeFile(t);
    await alice.mutation(api.photoEdits.save, save("a", file));
    await deleteFile(t, file);

    await expect(alice.mutation(api.photoEdits.save, save("a", file))).rejects.toThrow(/not found in storage/);
  });

  test("a different file within quota moves the pointer and deletes the old archive", async () => {
    const { t, alice } = setup();
    const first = await storeFile(t);
    const second = await storeFile(t);
    await alice.mutation(api.photoEdits.save, save("a", first));

    await alice.mutation(api.photoEdits.save, save("a", second));

    const rows = await edits(t);
    expect(rows).toHaveLength(1);
    expect(rows[0].storageId).toBe(second);
    expect(await fileExists(t, first)).toBe(false);
    expect(await fileExists(t, second)).toBe(true);
  });

  test("a replacement over quota is refused and the existing record and file survive", async () => {
    const { t, alice } = setup();
    const userId = await userFor(t, "user_alice");
    const old = await storeFile(t, 10 * MiB);
    await insertEdit(t, userId, "a", old);
    await insertEdit(t, userId, "b", await storeFile(t, 80 * MiB));
    const before = await edits(t);
    // 90 − 10 + 30 = 110 MiB, over the free 100.
    const incoming = await storeFile(t, 30 * MiB);

    await expect(alice.mutation(api.photoEdits.save, save("a", incoming))).rejects.toThrow(/storage is full/);

    expect(await edits(t)).toEqual(before);
    expect(await fileExists(t, old)).toBe(true);
  });
});

// ── cleanup racing a save ────────────────────────────────────────────────────

describe("discardFailedUpload racing save", () => {
  async function everyRecordHasItsFile(t: T): Promise<boolean> {
    for (const row of await edits(t)) {
      if (!(await fileExists(t, row.storageId))) return false;
    }
    return true;
  }

  test("save lands first: cleanup refuses and the file survives", async () => {
    const { t, alice } = setup();
    const file = await storeFile(t);
    await alice.mutation(api.photoEdits.save, save("a", file));

    const result = await alice.mutation(api.photoEdits.discardFailedUpload, { storageId: file });

    expect(result).toEqual({ deleted: false, reason: "referenced" });
    expect(await everyRecordHasItsFile(t)).toBe(true);
  });

  test("cleanup lands first: the late save is refused and no record is written", async () => {
    const { t, alice } = setup();
    const file = await storeFile(t);
    await alice.mutation(api.photoEdits.discardFailedUpload, { storageId: file });

    await expect(alice.mutation(api.photoEdits.save, save("a", file))).rejects.toThrow(/not found in storage/);

    expect(await edits(t)).toEqual([]);
  });

  test("issued together: no committed record points at a deleted file", async () => {
    const { t, alice } = setup();
    const file = await storeFile(t);

    await Promise.allSettled([
      alice.mutation(api.photoEdits.save, save("a", file)),
      alice.mutation(api.photoEdits.discardFailedUpload, { storageId: file }),
    ]);

    expect(await everyRecordHasItsFile(t)).toBe(true);
  });
});
