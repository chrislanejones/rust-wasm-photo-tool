// The stored-bytes counter (convex/storageUsage.ts): every add/remove path
// moves it by the file's size, a same-file save moves it by 0, a mixed run
// ends equal to a full recount, and the backfill is exact past the 2,000-row
// window that `storedBytes` reads.
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { storedBytes } from "./storageQuota";

const modules = import.meta.glob("./**/*.*s");

function setup() {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "user_alice" });
  const file = (bytes: number) => t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(bytes)])));
  const aliceId = () =>
    t.run(async (ctx) => (await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "user_alice")).unique())!._id);
  const counter = async () => {
    const id = await aliceId();
    return t.run(async (ctx) => (await ctx.db.query("storage_usage").withIndex("by_userId", (q) => q.eq("userId", id)).unique())?.bytes ?? null);
  };
  /** What the counter must equal: distinct referenced files, summed, uncapped. */
  const recount = async () => {
    const id = await aliceId();
    return t.run(async (ctx) => {
      const ids = new Set<Id<"_storage">>();
      for (const e of await ctx.db.query("photo_edits").collect()) if (e.userId === id) ids.add(e.storageId);
      for (const s of await ctx.db.query("shares").collect()) if (s.userId === id) ids.add(s.storageId);
      let n = 0;
      for (const f of ids) n += (await ctx.db.system.get(f))?.size ?? 0;
      return n;
    });
  };
  const save = (photoKey: string, storageId: Id<"_storage">) =>
    alice.mutation(api.photoEdits.save, { photoKey, storageId, canvasW: 10, canvasH: 10 });
  const share = (storageId: Id<"_storage">) => alice.mutation(api.shares.create, { storageId, canvasW: 10, canvasH: 10 });
  return { t, alice, file, aliceId, counter, recount, save, share };
}

describe("stored-bytes counter: every path moves it by the file's size", () => {
  test("photoEdits.save: insert +size, replace +new −old, same-file save 0; remove and clearAll −size", async () => {
    const { alice, file, counter, save } = setup();
    const a = await file(100), b = await file(250), c = await file(40);

    await save("p1", a);
    expect(await counter()).toBe(100);
    await save("p1", b); // replaces a
    expect(await counter()).toBe(250);
    await save("p1", b); // the same file again (#367's retried save)
    expect(await counter()).toBe(250);
    await save("p2", c);
    expect(await counter()).toBe(290);

    await alice.mutation(api.photoEdits.remove, { photoKey: "p2" });
    expect(await counter()).toBe(250);
    await alice.mutation(api.photoEdits.clearAll, {});
    expect(await counter()).toBe(0);
  });

  test("shares.create +size, shares.remove −size", async () => {
    const { alice, file, counter, share } = setup();
    const s1 = await file(70), s2 = await file(30);
    const { token } = await share(s1);
    await share(s2);
    expect(await counter()).toBe(100);
    await alice.mutation(api.shares.remove, { token });
    expect(await counter()).toBe(30);
  });

  test("two of the user's rows on one file count it once, as the recount does", async () => {
    const { file, counter, recount, save, share } = setup();
    const a = await file(100);
    await save("p1", a);
    await share(a);
    await save("p2", a);
    expect(await recount()).toBe(100);
    expect(await counter()).toBe(100);
  });

  test("an account that predates the counter is counted exactly by its first change", async () => {
    const { t, file, aliceId, counter, save } = setup();
    await save("seed", await file(1)); // creates the user (and a counter row)
    const id = await aliceId();
    // Rows from before the counter existed: no counter row.
    await t.run(async (ctx) => {
      const row = await ctx.db.query("storage_usage").withIndex("by_userId", (q) => q.eq("userId", id)).unique();
      await ctx.db.delete(row!._id);
      for (let i = 0; i < 3; i++) {
        const sid = await ctx.storage.store(new Blob([new Uint8Array(10)]));
        await ctx.db.insert("photo_edits", { userId: id, photoKey: `old${i}`, storageId: sid, canvasW: 1, canvasH: 1, updatedAt: 0 });
      }
    });
    expect(await counter()).toBeNull();
    await save("new", await file(5));
    expect(await counter()).toBe(1 + 30 + 5);
  });

  test("a same-file save on an uncounted account writes no counter row", async () => {
    const { t, file, aliceId, counter, save } = setup();
    const a = await file(9);
    await save("p", a);
    const id = await aliceId();
    await t.run(async (ctx) => {
      const row = await ctx.db.query("storage_usage").withIndex("by_userId", (q) => q.eq("userId", id)).unique();
      await ctx.db.delete(row!._id);
    });
    await save("p", a);
    expect(await counter()).toBeNull();
  });

  test("counter equals a full recount after a mixed sequence of adds and removes", async () => {
    const { alice, file, counter, recount, save, share } = setup();
    // A fixed pseudo-random walk, so a failure reproduces.
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) % n);
    const tokens: string[] = [];
    for (let step = 0; step < 60; step++) {
      const op = rnd(5);
      const key = `p${rnd(6)}`;
      if (op === 0 || op === 1) await save(key, await file(1 + rnd(500)));
      else if (op === 2) await alice.mutation(api.photoEdits.remove, { photoKey: key });
      else if (op === 3) tokens.push((await share(await file(1 + rnd(500)))).token);
      else if (tokens.length) await alice.mutation(api.shares.remove, { token: tokens.splice(rnd(tokens.length), 1)[0]! });
      expect(await counter() ?? 0, `step ${step}`).toBe(await recount());
    }
  });
});

describe("backfillStoredBytes", () => {
  test("2,500 rows: storedBytes' 2,000-row window undercounts, the backfill is exact; dry run writes nothing", async () => {
    const { t, file, aliceId, counter, save } = setup();
    await save("seed", await file(3));
    const id = await aliceId();
    await t.run(async (ctx) => {
      const row = await ctx.db.query("storage_usage").withIndex("by_userId", (q) => q.eq("userId", id)).unique();
      await ctx.db.delete(row!._id);
      for (let i = 0; i < 2_499; i++) {
        const sid = await ctx.storage.store(new Blob([new Uint8Array(3)]));
        await ctx.db.insert("photo_edits", { userId: id, photoKey: `k${i}`, storageId: sid, canvasW: 1, canvasH: 1, updatedAt: 0 });
      }
    });
    const exact = 2_500 * 3;

    // The bug this fixes: the quota's sum stops at 2,000 rows.
    const capped = await t.run((ctx) => storedBytes(ctx, id));
    expect(capped).toBe(2_000 * 3);

    const dry = await t.mutation(internal.storageUsage.backfillStoredBytes, {});
    expect(dry).toMatchObject({ mode: "dry-run", users: 1, bytes: exact, written: 0, isDone: true });
    expect(dry.mismatches).toEqual({ count: 1, list: [{ userId: id, counter: null, recount: exact }] });
    expect(await counter()).toBeNull();

    const applied = await t.mutation(internal.storageUsage.backfillStoredBytes, { apply: true });
    expect(applied).toMatchObject({ mode: "applied", written: 1 });
    expect(await counter()).toBe(exact);

    // The rerun is the check: nothing differs, nothing written.
    expect(await t.mutation(internal.storageUsage.backfillStoredBytes, {})).toMatchObject({ mismatches: { count: 0 }, written: 0 });
  }, 120_000);

  test("pages through users with a cursor and corrects a drifted counter", async () => {
    const { t } = setup();
    const ids = await t.run(async (ctx) => {
      const out: Id<"users">[] = [];
      for (let i = 0; i < 3; i++) {
        const uid = await ctx.db.insert("users", { clerkId: `u${i}`, tier: "free", dailyUsage: 0, usageResetAt: 0, createdAt: 0, updatedAt: 0 });
        const sid = await ctx.storage.store(new Blob([new Uint8Array(10 * (i + 1))]));
        await ctx.db.insert("shares", { token: `t${i}`, userId: uid, storageId: sid, canvasW: 1, canvasH: 1, views: 0, createdAt: 0 });
        out.push(uid);
      }
      await ctx.db.insert("storage_usage", { userId: out[1]!, bytes: 999, updatedAt: 0 }); // drifted
      return out;
    });
    const first = await t.mutation(internal.storageUsage.backfillStoredBytes, { apply: true, usersPerRun: 2 });
    expect(first).toMatchObject({ users: 2, isDone: false });
    const second = await t.mutation(internal.storageUsage.backfillStoredBytes, { apply: true, usersPerRun: 2, cursor: first.continueCursor });
    expect(second).toMatchObject({ users: 1 });
    const rows = await t.run((ctx) => ctx.db.query("storage_usage").collect());
    expect(Object.fromEntries(rows.map((r) => [r.userId, r.bytes]))).toEqual({ [ids[0]!]: 10, [ids[1]!]: 20, [ids[2]!]: 30 });
  });
});
