// The share-link trash (convex/trash.ts, shares.moveToTrash): hide, restore,
// delete now, empty, the purge's dry run, and the quota still counting trash.
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { TRASH_WINDOW_DAYS } from "./entitlement";

const modules = import.meta.glob("./**/*.*s");
const DAY = 86_400_000;
const MiB = 1024 * 1024;

function setup() {
  const t = convexTest(schema, modules);
  const file = (bytes: number) => t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(bytes)])));
  const exists = (id: Id<"_storage">) => t.run(async (ctx) => (await ctx.db.system.get(id)) !== null);
  const user = (subject: string, tier: "free" | "pro") =>
    t.run((ctx) =>
      ctx.db.insert("users", { clerkId: subject, tier, dailyUsage: 0, usageResetAt: 0, createdAt: 0, updatedAt: 0 }),
    );
  /** A share row written directly, so `deletedAt` can be in the past. */
  const shareRow = (userId: Id<"users">, storageId: Id<"_storage">, token: string, deletedAt?: number) =>
    t.run((ctx) =>
      ctx.db.insert("shares", { token, userId, storageId, canvasW: 1, canvasH: 1, views: 0, createdAt: 0, deletedAt }),
    );
  return { t, file, exists, user, shareRow };
}

async function signedIn(tier: "free" | "pro" = "free") {
  const s = setup();
  await s.user("owner", tier);
  const owner = s.t.withIdentity({ subject: "owner" });
  const create = async (bytes: number, title?: string) => {
    const storageId = await s.file(bytes);
    const { token } = await owner.mutation(api.shares.create, { storageId, canvasW: 4, canvasH: 3, title });
    return { token, storageId };
  };
  return { ...s, owner, create };
}

describe("trash: hide, restore, delete now", () => {
  test("a trashed link leaves the list, shows in Trash with its window, and is not served", async () => {
    const { t, owner, create } = await signedIn("free");
    const a = await create(100, "A");
    const b = await create(50, "B");

    await owner.mutation(api.shares.moveToTrash, { token: a.token });
    expect((await owner.query(api.shares.listMine, {})).map((s) => s.token)).toEqual([b.token]);

    const trash = await owner.query(api.trash.listMine, {});
    expect(trash).toMatchObject({ paid: false, windowDays: TRASH_WINDOW_DAYS.free });
    expect(trash!.items).toHaveLength(1);
    const item = trash!.items[0]!;
    expect(item).toMatchObject({ token: a.token, title: "A", bytes: 100 });
    expect(item.purgeAt - item.deletedAt).toBe(7 * DAY);

    // Visitors: gone, and not counted.
    expect(await t.query(api.shares.get, { token: a.token })).toBeNull();
    await t.mutation(api.shares.recordView, { token: a.token });
    expect(await t.run(async (ctx) => (await ctx.db.query("share_views").collect()).length)).toBe(0);
    expect(await t.query(api.shares.get, { token: b.token })).toMatchObject({ status: "live" });
  });

  test("a paid account's window is 30 days; a second Move keeps the first timestamp", async () => {
    const { owner, create } = await signedIn("pro");
    const a = await create(10);
    await owner.mutation(api.shares.moveToTrash, { token: a.token });
    const first = (await owner.query(api.trash.listMine, {}))!.items[0]!;
    await owner.mutation(api.shares.moveToTrash, { token: a.token });
    const again = (await owner.query(api.trash.listMine, {}))!;
    expect(again).toMatchObject({ paid: true, windowDays: 30 });
    expect(again.items[0]!.deletedAt).toBe(first.deletedAt);
    expect(again.items[0]!.purgeAt - again.items[0]!.deletedAt).toBe(30 * DAY);
  });

  test("restore brings it back: listed and served at the same address", async () => {
    const { t, owner, create } = await signedIn();
    const a = await create(10);
    await owner.mutation(api.shares.moveToTrash, { token: a.token });
    await owner.mutation(api.trash.restore, { token: a.token });
    expect((await owner.query(api.shares.listMine, {})).map((s) => s.token)).toEqual([a.token]);
    expect((await owner.query(api.trash.listMine, {}))!.items).toEqual([]);
    expect(await t.query(api.shares.get, { token: a.token })).toMatchObject({ status: "live" });
  });

  test("delete now: the row and its file go, the counter drops; a file an edit also uses survives", async () => {
    const { t, owner, create, exists, file } = await signedIn();
    const a = await create(100);
    const counter = () => t.run(async (ctx) => (await ctx.db.query("storage_usage").first())?.bytes);
    expect(await counter()).toBe(100);
    await owner.mutation(api.shares.moveToTrash, { token: a.token });
    expect(await counter()).toBe(100); // trash still counts
    await owner.mutation(api.trash.deleteNow, { token: a.token });
    expect(await t.run(async (ctx) => (await ctx.db.query("shares").collect()).length)).toBe(0);
    expect(await exists(a.storageId)).toBe(false);
    expect(await counter()).toBe(0);

    // The same image held by a cloud edit as well: deleting the share keeps it.
    const sharedFile = await file(30);
    await owner.mutation(api.photoEdits.save, { photoKey: "p1", storageId: sharedFile, canvasW: 1, canvasH: 1 });
    const { token } = await owner.mutation(api.shares.create, { storageId: sharedFile, canvasW: 1, canvasH: 1 });
    await owner.mutation(api.shares.moveToTrash, { token });
    await owner.mutation(api.trash.deleteNow, { token });
    expect(await exists(sharedFile)).toBe(true);
    expect(await counter()).toBe(30);
  });

  test("delete now refuses a live link, and someone else's", async () => {
    const { t, owner, create, exists, user } = await signedIn();
    const a = await create(10);
    await owner.mutation(api.trash.deleteNow, { token: a.token }); // not trashed: no-op
    expect(await exists(a.storageId)).toBe(true);
    await owner.mutation(api.shares.moveToTrash, { token: a.token });
    await user("other", "free");
    const other = t.withIdentity({ subject: "other" });
    await expect(other.mutation(api.trash.deleteNow, { token: a.token })).rejects.toThrow(/Not your share link/);
    await expect(other.mutation(api.trash.restore, { token: a.token })).rejects.toThrow(/Not your share link/);
    expect(await exists(a.storageId)).toBe(true);
  });

  test("empty trash removes every trashed link and leaves live ones", async () => {
    const { owner, create, exists } = await signedIn();
    const live = await create(5);
    const gone = [await create(6), await create(7)];
    for (const g of gone) await owner.mutation(api.shares.moveToTrash, { token: g.token });
    expect(await owner.mutation(api.trash.empty, {})).toEqual({ deleted: 2, more: false });
    for (const g of gone) expect(await exists(g.storageId)).toBe(false);
    expect(await exists(live.storageId)).toBe(true);
    expect((await owner.query(api.shares.listMine, {})).map((s) => s.token)).toEqual([live.token]);
  });

  test("signed out: no trash", async () => {
    const { t } = setup();
    expect(await t.query(api.trash.listMine, {})).toBeNull();
  });
});

describe("trash counts against the quota", () => {
  test("the gauge splits used and trash; a trashed link still fills the cap and an upload past it is refused", async () => {
    const { owner, create } = await signedIn("free"); // 100 MiB cap
    const big = await create(60 * MiB);
    await create(1 * MiB);
    await owner.mutation(api.shares.moveToTrash, { token: big.token });
    const trash = (await owner.query(api.trash.listMine, {}))!;
    expect(trash.quota).toEqual({ usedBytes: 1 * MiB, trashBytes: 60 * MiB, limitBytes: 100 * MiB });

    await expect(create(50 * MiB)).rejects.toThrow(/storage|full|quota/i);

    // Nothing was deleted to make room.
    expect((await owner.query(api.trash.listMine, {}))!.items).toHaveLength(1);
  }, 60_000);
});

describe("trash.purge", () => {
  test("the dry run lists only rows past their owner's window, and deletes nothing; apply removes exactly those", async () => {
    const { t, file, exists, user, shareRow } = setup();
    const free = await user("free-owner", "free");
    const pro = await user("pro-owner", "pro");
    const now = Date.now();
    const f = {
      free8: await file(8), free6: await file(6), pro10: await file(10), pro31: await file(31), live: await file(1),
    };
    await shareRow(free, f.free8, "free8", now - 8 * DAY);
    await shareRow(free, f.free6, "free6", now - 6 * DAY);
    await shareRow(pro, f.pro10, "pro10", now - 10 * DAY);
    await shareRow(pro, f.pro31, "pro31", now - 31 * DAY);
    await shareRow(free, f.live, "live");

    const dry = await t.mutation(internal.trash.purge, {});
    expect(dry).toMatchObject({ mode: "dry-run", rows: 2, bytes: 8 + 31, filesDeleted: 0, keptByWindow: 1, more: false });
    expect(dry.list.map((r) => r.token).sort()).toEqual(["free8", "pro31"]);
    for (const id of Object.values(f)) expect(await exists(id)).toBe(true);

    const applied = await t.mutation(internal.trash.purge, { apply: true });
    expect(applied).toMatchObject({ mode: "applied", rows: 2, filesDeleted: 2 });
    expect(await exists(f.free8)).toBe(false);
    expect(await exists(f.pro31)).toBe(false);
    for (const id of [f.free6, f.pro10, f.live]) expect(await exists(id)).toBe(true);
    const left = await t.run(async (ctx) => (await ctx.db.query("shares").collect()).map((s) => s.token).sort());
    expect(left).toEqual(["free6", "live", "pro10"]);

    expect(await t.mutation(internal.trash.purge, {})).toMatchObject({ rows: 0, keptByWindow: 1 });
  });
});
