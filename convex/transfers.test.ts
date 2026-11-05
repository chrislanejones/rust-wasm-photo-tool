// Transfer (convex/transfers.ts, ADR-102): a private 7-day inbox from the
// phone to the editor. Isolation, the server's own size and type, the quota
// and its counter, the limits, receive/remove, and the expiry's dry run.
//
// convex-test's `storage.store` records no content type (only size and sha),
// so through the functions the type is the name's extension: the fallback in
// `resolveMime`. Its recorded-type branch is pinned by the unit test below.
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import {
  TRANSFER_INBOX_LIMIT,
  TRANSFER_MAX_BYTES,
  cleanDevice,
  cleanName,
  isTransferMime,
  resolveMime,
} from "./transfers";

const modules = import.meta.glob("./**/*.*s");
const DAY = 86_400_000;
const MiB = 1024 * 1024;

function setup() {
  const t = convexTest(schema, modules);
  const file = (bytes: number) => t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(bytes)])));
  const exists = (id: Id<"_storage">) => t.run(async (ctx) => (await ctx.db.system.get(id)) !== null);
  const user = (subject: string, tier: "free" | "pro" = "free") =>
    t.run((ctx) =>
      ctx.db.insert("users", { clerkId: subject, tier, dailyUsage: 0, usageResetAt: 0, createdAt: 0, updatedAt: 0 }),
    );
  const counter = (userId: Id<"users">) =>
    t.run(
      async (ctx) =>
        (await ctx.db.query("storage_usage").withIndex("by_userId", (q) => q.eq("userId", userId)).unique())?.bytes ??
        null,
    );
  const rows = () => t.run((ctx) => ctx.db.query("transfers").collect());
  return { t, file, exists, user, counter, rows };
}

async function phone(subject = "owner", tier: "free" | "pro" = "free") {
  const s = setup();
  const userId = await s.user(subject, tier);
  const as = s.t.withIdentity({ subject });
  /** What the phone does for one photo: ask for a URL, upload, create. */
  const send = async (bytes: number, name = "IMG_0001.JPG") => {
    await as.mutation(api.transfers.generateUploadUrl, {});
    const storageId = await s.file(bytes);
    const result = await as.mutation(api.transfers.create, { storageId, name, fromDevice: "iPhone" });
    return { storageId, result };
  };
  return { ...s, userId, as, send };
}

describe("transfers: the inbox", () => {
  test("a sent photo is listed for its owner with the server's size and type, and an expiry 7 days out", async () => {
    const { as, send } = await phone();
    const { result } = await send(1234, "IMG_0042.HEIC");
    expect(result).toMatchObject({ ok: true, bytes: 1234 });

    const inbox = await as.query(api.transfers.listMine, {});
    expect(inbox!.limit).toBe(TRANSFER_INBOX_LIMIT);
    expect(inbox!.items).toHaveLength(1);
    const item = inbox!.items[0]!;
    expect(item).toMatchObject({ name: "IMG_0042.HEIC", mime: "image/heic", bytes: 1234, fromDevice: "iPhone" });
    expect(item.expiresAt - item.createdAt).toBe(7 * DAY);
    expect(item.url).toEqual(expect.any(String));
  });

  test("newest first", async () => {
    const { as, send } = await phone();
    await send(1, "first.jpg");
    await send(2, "second.jpg");
    const names = (await as.query(api.transfers.listMine, {}))!.items.map((i) => i.name);
    expect(names).toEqual(["second.jpg", "first.jpg"]);
  });

  test("signed out: no inbox, and no upload URL", async () => {
    const { t } = setup();
    expect(await t.query(api.transfers.listMine, {})).toBeNull();
    await expect(t.mutation(api.transfers.generateUploadUrl, {})).rejects.toThrow(/Not authenticated/);
  });
});

describe("transfers: only the owner", () => {
  test("B cannot list, receive or remove A's transfer", async () => {
    const { t, as, send, user, exists, rows } = await phone("alice");
    const { storageId } = await send(100);
    const id = (await rows())[0]!._id;

    await user("bob");
    const bob = t.withIdentity({ subject: "bob" });
    expect((await bob.query(api.transfers.listMine, {}))!.items).toEqual([]);
    await expect(bob.mutation(api.transfers.receive, { id })).rejects.toThrow(/Not your transfer/);
    await expect(bob.mutation(api.transfers.remove, { id })).rejects.toThrow(/Not your transfer/);

    expect(await exists(storageId)).toBe(true);
    expect((await as.query(api.transfers.listMine, {}))!.items).toHaveLength(1);
  });

  test("create refuses a file some row already points at, and leaves that file alone", async () => {
    const { t, as, file, user, exists } = await phone("alice");
    await user("bob");
    const bob = t.withIdentity({ subject: "bob" });
    const bobsFile = await file(50);
    await bob.mutation(api.shares.create, { storageId: bobsFile, canvasW: 1, canvasH: 1 });

    await expect(as.mutation(api.transfers.create, { storageId: bobsFile, name: "x.png" })).rejects.toThrow(
      /already in use/,
    );
    expect(await exists(bobsFile)).toBe(true);
  });
});

describe("transfers: the server decides size and type", () => {
  test("bytes and mime come from storage, not the client; an extra `bytes` argument is rejected", async () => {
    const { as, file, rows } = await phone();
    const storageId = await file(10);
    // The name says "huge". The size kept is the stored one.
    const r = await as.mutation(api.transfers.create, { storageId, name: "C:\\Users\\me\\huge.jpg" });
    expect(r).toMatchObject({ ok: true, bytes: 10 });
    expect((await rows())[0]).toMatchObject({ bytes: 10, mime: "image/jpeg", name: "huge.jpg", fromDevice: "Phone" });

    const other = await file(10);
    await expect(
      as.mutation(api.transfers.create, { storageId: other, name: "a.jpg", bytes: 1 } as never),
    ).rejects.toThrow();
  });

  test("too big and not-a-photo are refused, and the refused file is deleted", async () => {
    const { send, exists, rows } = await phone("owner", "pro");
    const big = await send(TRANSFER_MAX_BYTES + 1);
    expect(big.result).toMatchObject({ ok: false, reason: "too-big" });
    expect((big.result as { message: string }).message).toMatch(/Too big: 50\.0 MB/);
    expect(await exists(big.storageId)).toBe(false);

    const text = await send(10, "notes.txt");
    expect(text.result).toMatchObject({ ok: false, reason: "not-an-image" });
    expect(await exists(text.storageId)).toBe(false);

    const exactlyMax = await send(TRANSFER_MAX_BYTES);
    expect(exactlyMax.result).toMatchObject({ ok: true });
    expect(await rows()).toHaveLength(1);
  }, 60_000);

  test("the label and the name are cleaned", () => {
    expect(cleanDevice("Android phone")).toBe("Android phone");
    expect(cleanDevice("<script>")).toBe("Phone");
    expect(cleanDevice(undefined)).toBe("Phone");
    expect(cleanName("  /DCIM/100APPLE/IMG_1.HEIC ")).toBe("IMG_1.HEIC");
    expect(cleanName("   ")).toBe("Photo");
    expect(cleanName("a".repeat(300))).toHaveLength(200);
    expect(isTransferMime("IMAGE/JPEG; charset=binary")).toBe(true);
    expect(isTransferMime("application/pdf")).toBe(false);
    expect(isTransferMime(undefined)).toBe(false);
  });

  test("resolveMime: the recorded type wins; the extension only fills in a missing or generic one", () => {
    expect(resolveMime("image/png", "photo.jpg")).toBe("image/png");
    expect(resolveMime("Image/HEIC", "IMG_1.HEIC")).toBe("image/heic");
    expect(resolveMime("text/html", "photo.jpg")).toBeNull(); // a real non-image type is refused, name or not
    expect(resolveMime("application/octet-stream", "IMG_1.HEIC")).toBe("image/heic");
    expect(resolveMime(undefined, "IMG_1.jpeg")).toBe("image/jpeg");
    expect(resolveMime(undefined, "notes.txt")).toBeNull();
    expect(resolveMime(undefined, "no-extension")).toBeNull();
  });
});

describe("transfers: quota and the counter", () => {
  test("a transfer fills the quota; past the cap it is refused with what is left, deleted, and nothing else goes", async () => {
    const { userId, send, counter, exists, rows } = await phone("owner", "free"); // 100 MiB
    await send(45 * MiB);
    expect(await counter(userId)).toBe(45 * MiB);
    await send(45 * MiB);
    expect(await counter(userId)).toBe(90 * MiB);

    const third = await send(45 * MiB);
    expect(third.result).toMatchObject({ ok: false, reason: "storage-full", bytesLeft: 10 * MiB });
    expect((third.result as { message: string }).message).toMatch(/Storage full: 10 MB left/);
    expect(await exists(third.storageId)).toBe(false);
    expect(await rows()).toHaveLength(2);
    expect(await counter(userId)).toBe(90 * MiB);
  }, 60_000);

  test("an account over its cap is refused an upload URL", async () => {
    const { t, as, userId, send } = await phone("owner", "pro");
    await send(45 * MiB);
    await send(45 * MiB);
    await send(45 * MiB);
    // Pro → free: 135 MiB held against a 100 MiB cap.
    await t.run((ctx) => ctx.db.patch(userId, { tier: "free" }));
    await expect(as.mutation(api.transfers.generateUploadUrl, {})).rejects.toThrow(/storage is full/);
  }, 60_000);

  test("receive removes the row and the file and gives the bytes back; a second receive is harmless", async () => {
    const { as, userId, send, counter, exists, rows } = await phone();
    const a = await send(300);
    await send(200);
    expect(await counter(userId)).toBe(500);
    const id = (a.result as { id: Id<"transfers"> }).id;

    expect(await as.mutation(api.transfers.receive, { id })).toEqual({ removed: true });
    expect(await exists(a.storageId)).toBe(false);
    expect(await counter(userId)).toBe(200);
    expect(await as.mutation(api.transfers.receive, { id })).toEqual({ removed: false });
    expect(await counter(userId)).toBe(200);
    expect(await rows()).toHaveLength(1);
  });

  test("remove deletes without importing, and moves the counter the same way", async () => {
    const { as, userId, send, counter, exists } = await phone();
    const a = await send(70);
    const id = (a.result as { id: Id<"transfers"> }).id;
    await as.mutation(api.transfers.remove, { id });
    expect(await exists(a.storageId)).toBe(false);
    expect(await counter(userId)).toBe(0);
    expect((await as.query(api.transfers.listMine, {}))!.items).toEqual([]);
  });

  test("a waiting photo's file is referenced, so the failed-upload cleanup will not delete it", async () => {
    const { as, send, exists } = await phone();
    const { storageId } = await send(10);
    expect(await as.mutation(api.photoEdits.discardFailedUpload, { storageId })).toMatchObject({ deleted: false });
    expect(await exists(storageId)).toBe(true);
  });
});

describe("transfers: the inbox limit", () => {
  test(`the ${TRANSFER_INBOX_LIMIT + 1}st photo is refused, at the URL and at create`, async () => {
    const { as, file, send, exists, rows } = await phone();
    for (let i = 0; i < TRANSFER_INBOX_LIMIT; i++) {
      const { result } = await send(1, `p${i}.jpg`);
      expect(result).toMatchObject({ ok: true });
    }
    await expect(as.mutation(api.transfers.generateUploadUrl, {})).rejects.toThrow(/50 photos waiting/);

    // A phone that got its URL before the inbox filled up: create refuses and cleans up.
    const late = await file(1);
    expect(await as.mutation(api.transfers.create, { storageId: late, name: "late.jpg" })).toMatchObject({
      ok: false,
      reason: "inbox-full",
    });
    expect(await exists(late)).toBe(false);
    expect(await rows()).toHaveLength(TRANSFER_INBOX_LIMIT);
  }, 60_000);
});

describe("transfers.expire", () => {
  test("the dry run lists only expired rows and deletes nothing; apply removes exactly those and moves the counter", async () => {
    const { t, userId, send, counter, exists, rows } = await phone();
    const fresh = await send(5, "fresh.jpg");
    const old1 = await send(7, "old1.jpg");
    const old2 = await send(11, "old2.png");
    const past = Date.now() - 1;
    for (const o of [old1, old2]) {
      const id = (o.result as { id: Id<"transfers"> }).id;
      await t.run((ctx) => ctx.db.patch(id, { expiresAt: past }));
    }
    expect(await counter(userId)).toBe(23);

    const dry = await t.mutation(internal.transfers.expire, {});
    expect(dry).toMatchObject({ mode: "dry-run", rows: 2, bytes: 18, filesDeleted: 0, more: false });
    expect(dry.list.map((r) => r.name).sort()).toEqual(["old1.jpg", "old2.png"]);
    for (const f of [fresh, old1, old2]) expect(await exists(f.storageId)).toBe(true);
    expect(await rows()).toHaveLength(3);
    expect(await counter(userId)).toBe(23);

    const applied = await t.mutation(internal.transfers.expire, { apply: true });
    expect(applied).toMatchObject({ mode: "applied", rows: 2, filesDeleted: 2, bytesFreed: 18 });
    expect(await exists(old1.storageId)).toBe(false);
    expect(await exists(old2.storageId)).toBe(false);
    expect(await exists(fresh.storageId)).toBe(true);
    expect((await rows()).map((r) => r.name)).toEqual(["fresh.jpg"]);
    expect(await counter(userId)).toBe(5);

    expect(await t.mutation(internal.transfers.expire, {})).toMatchObject({ rows: 0 });
  });

  test("maxRows bounds a run and says more remain", async () => {
    const { t, send } = await phone();
    for (let i = 0; i < 3; i++) {
      const { result } = await send(1);
      await t.run((ctx) => ctx.db.patch((result as { id: Id<"transfers"> }).id, { expiresAt: 1 }));
    }
    expect(await t.mutation(internal.transfers.expire, { maxRows: 2 })).toMatchObject({ rows: 2, more: true });
  });
});
