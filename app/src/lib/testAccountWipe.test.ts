// The test-account wipe's CONVEX HANDLERS (convex/testAccountWipe.ts: `plan`
// and `applyBatch`), run for real against an in-memory ctx — the same harness
// shape as shareLimits.test.ts. The repo has no convex-test; this is the
// closest thing to it, and unlike testAccount.test.ts it goes through the
// app's own delete helpers (deletePhotoEditRecord, deleteShareRecord), so the
// "file goes with its row" pairing is exercised, not mirrored.
//
// TEST_CLERK_ID is empty in the source (Chris pins it once the Clerk login
// exists). The resolver is wrapped here so a test can pin it, or not.
import { beforeEach, describe, expect, it, vi } from "vitest";

const pin = vi.hoisted(() => ({ clerkId: "user_test" }));

vi.mock("../../../convex/testAccount", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../convex/testAccount")>();
  return {
    ...actual,
    resolveTestAccount: (email: string, users: Parameters<typeof actual.resolveTestAccount>[1], mode: "plan" | "apply") =>
      actual.resolveTestAccount(email, users, mode, pin.clerkId),
  };
});

import { applyBatch, plan } from "../../../convex/testAccountWipe";
import { TEST_ACCOUNT_EMAIL } from "../../../convex/testAccount";

type Row = Record<string, unknown> & { _id: string };

interface Registered {
  _handler: (ctx: unknown, args: unknown) => Promise<unknown>;
}

const TABLES = [
  "users", "photo_edits", "shares", "share_views", "ai_jobs", "images", "layers",
  "annotations", "history", "projects", "sync_docs", "subscriptions", "recent_texts", "user_colors",
];

function createFakeConvex() {
  const tables = new Map<string, Map<string, Row>>(TABLES.map((t) => [t, new Map()]));
  const files = new Map<string, number>();
  let seq = 0;

  const results = (rows: Row[]) => ({
    take: async (n: number) => rows.slice(0, n),
    collect: async () => rows,
    unique: async () => {
      if (rows.length > 1) throw new Error("more than one row");
      return rows[0] ?? null;
    },
  });

  const db = {
    query(table: string) {
      const all = () => [...tables.get(table)!.values()];
      return {
        ...results(all()),
        withIndex(_index: string, build: (q: unknown) => unknown) {
          const eqs: [string, unknown][] = [];
          const q = {
            eq(field: string, value: unknown) {
              eqs.push([field, value]);
              return q;
            },
          };
          build(q);
          return results(all().filter((r) => eqs.every(([f, v]) => r[f] === v)));
        },
      };
    },
    async insert(table: string, doc: Record<string, unknown>) {
      const _id = `${table}|${++seq}`;
      tables.get(table)!.set(_id, { ...doc, _id, _creationTime: 0 });
      return _id;
    },
    async delete(id: string) {
      if (!tables.get(id.split("|")[0])!.delete(id)) throw new Error(`delete: no row ${id}`);
    },
    async get(id: string) {
      return tables.get(id.split("|")[0])?.get(id) ?? null;
    },
    system: {
      async get(_table: "_storage", id: string) {
        const size = files.get(id);
        return size === undefined ? null : { _id: id, _creationTime: 0, size, sha256: "" };
      },
    },
  };
  const storage = {
    delete: async (id: string) => {
      if (!files.delete(id)) throw new Error(`storage.delete: no file ${id}`);
    },
  };
  const ctx = { db, storage };
  const call = <R>(fn: unknown, args: unknown) => (fn as Registered)._handler(ctx, args) as Promise<R>;

  return {
    tables,
    files,
    insert: db.insert,
    file(id: string, size: number) {
      files.set(id, size);
      return id;
    },
    plan: (email: string) => call<PlanResult>(plan, { email }),
    applyBatch: (email: string, batchSize: number) => call<BatchResult>(applyBatch, { email, batchSize }),
    rowsOf(userId: string) {
      const out: Row[] = [];
      for (const [name, t] of tables) {
        if (name === "users") continue;
        for (const r of t.values()) if (r.userId === userId) out.push(r);
      }
      return out;
    },
  };
}

type PlanResult =
  | { ok: false; reason: string; matched: number }
  | {
      ok: true;
      totalRows: number;
      files: number;
      bytes: number;
      rows: Record<string, number>;
      kept: Record<string, number>;
      sharedWithOtherAccounts: number;
      missingFiles: number;
      clerkIdPinned: boolean;
    };
type BatchResult = { rows: number; files: number; bytes: number; done: boolean };

let server: ReturnType<typeof createFakeConvex>;
let testUser: string;
let realUser: string;

beforeEach(async () => {
  pin.clerkId = "user_test";
  server = createFakeConvex();
  testUser = await server.insert("users", { clerkId: "user_test", email: TEST_ACCOUNT_EMAIL, tier: "free" });
  realUser = await server.insert("users", { clerkId: "user_real", email: "someone@example.com", tier: "pro" });

  // The test account: 3 file-owning rows holding 3 files, plus a kept sync row.
  await server.insert("photo_edits", { userId: testUser, photoKey: "k1", storageId: server.file("kg2testedit", 31_000_000) });
  await server.insert("shares", { userId: testUser, token: "t1", storageId: server.file("kg2testshare", 2_400_000) });
  await server.insert("ai_jobs", { userId: testUser, photoKey: "k1", inputStorageId: server.file("kg2testaiin", 5_100_000) });
  await server.insert("sync_docs", { userId: testUser, key: "prefs", value: "{}", rev: 3 });

  // Another account with the same shapes.
  await server.insert("photo_edits", { userId: realUser, photoKey: "k9", storageId: server.file("kg2realedit", 29_000_000) });
  const realShare = await server.insert("shares", { userId: realUser, token: "t9", storageId: server.file("kg2realshare", 1_900_000) });
  await server.insert("share_views", { shareId: realShare, at: 1 });
});

async function applyAll(batchSize: number) {
  const total = { rows: 0, files: 0, bytes: 0, batches: 0 };
  for (let i = 0; i < 50; i++) {
    const r = await server.applyBatch(TEST_ACCOUNT_EMAIL, batchSize);
    total.rows += r.rows;
    total.files += r.files;
    total.bytes += r.bytes;
    total.batches += 1;
    if (r.done) return total;
  }
  throw new Error("did not finish");
}

describe("testAccountWipe handlers", () => {
  it("plan reports 3 rows, 3 files and their bytes, and deletes nothing", async () => {
    const before = JSON.stringify([...server.tables].map(([t, m]) => [t, [...m.keys()]]));
    const p = await server.plan(TEST_ACCOUNT_EMAIL);
    expect(p).toMatchObject({
      ok: true,
      totalRows: 3,
      files: 3,
      bytes: 31_000_000 + 2_400_000 + 5_100_000,
      missingFiles: 0,
      sharedWithOtherAccounts: 0,
      clerkIdPinned: true,
    });
    if (p.ok) {
      expect(p.rows).toMatchObject({ photo_edits: 1, shares: 1, ai_jobs: 1, share_views: 0 });
      expect(p.kept).toMatchObject({ users: 1, sync_docs: 1 });
    }
    expect(JSON.stringify([...server.tables].map(([t, m]) => [t, [...m.keys()]]))).toBe(before);
    expect(server.files.size).toBe(5);
  });

  it("apply takes the account from 3 rows + 3 files to 0 and 0, and leaves the other account untouched", async () => {
    const realRowsBefore = JSON.stringify(server.rowsOf(realUser));
    const total = await applyAll(1);

    expect(total).toMatchObject({ rows: 3, files: 3, bytes: 31_000_000 + 2_400_000 + 5_100_000 });
    expect(total.batches).toBeGreaterThanOrEqual(3);
    const after = await server.plan(TEST_ACCOUNT_EMAIL);
    expect(after).toMatchObject({ ok: true, totalRows: 0, files: 0 });
    expect(["kg2testedit", "kg2testshare", "kg2testaiin"].filter((f) => server.files.has(f))).toEqual([]);

    expect(JSON.stringify(server.rowsOf(realUser))).toBe(realRowsBefore);
    expect(server.files.has("kg2realedit") && server.files.has("kg2realshare")).toBe(true);
    expect(server.tables.get("share_views")!.size).toBe(1);
    // Kept: the users rows and the test account's sync row.
    expect(server.tables.get("users")!.size).toBe(2);
    expect(server.tables.get("sync_docs")!.size).toBe(1);
  });

  it("refuses any other email, on both entry points", async () => {
    await expect(server.plan("someone@example.com")).resolves.toMatchObject({ ok: false });
    await expect(server.applyBatch("someone@example.com", 5)).rejects.toThrow(/not the allowlisted/);
    expect(server.files.size).toBe(5);
  });

  it("refuses to apply while TEST_CLERK_ID is unset, and when it names a different account", async () => {
    pin.clerkId = "";
    await expect(server.plan(TEST_ACCOUNT_EMAIL)).resolves.toMatchObject({ ok: true, clerkIdPinned: false });
    await expect(server.applyBatch(TEST_ACCOUNT_EMAIL, 5)).rejects.toThrow(/TEST_CLERK_ID is not set/);
    pin.clerkId = "user_real";
    await expect(server.applyBatch(TEST_ACCOUNT_EMAIL, 5)).rejects.toThrow(/Both must match/);
    expect(server.files.size).toBe(5);
  });

  it("refuses when two users rows carry the test email", async () => {
    await server.insert("users", { clerkId: "user_dupe", email: TEST_ACCOUNT_EMAIL, tier: "free" });
    await expect(server.plan(TEST_ACCOUNT_EMAIL)).resolves.toMatchObject({ ok: false, matched: 2 });
    await expect(server.applyBatch(TEST_ACCOUNT_EMAIL, 5)).rejects.toThrow(/2 users rows share email/);
    expect(server.files.size).toBe(5);
  });

  it("refuses, deleting nothing, when another account's row references one of the files", async () => {
    await server.insert("ai_jobs", { userId: realUser, photoKey: "k9", inputStorageId: "kg2testedit" });
    await expect(server.plan(TEST_ACCOUNT_EMAIL)).resolves.toMatchObject({ ok: true, sharedWithOtherAccounts: 1 });
    await expect(server.applyBatch(TEST_ACCOUNT_EMAIL, 5)).rejects.toThrow(/also referenced by another account/);
    expect(server.files.size).toBe(5);
    expect(server.rowsOf(testUser)).toHaveLength(4); // 3 file rows + sync_docs
  });

  it("rejects a batch size outside 1..50", async () => {
    await expect(server.applyBatch(TEST_ACCOUNT_EMAIL, 0)).rejects.toThrow(/batchSize/);
    await expect(server.applyBatch(TEST_ACCOUNT_EMAIL, 51)).rejects.toThrow(/batchSize/);
  });
});
