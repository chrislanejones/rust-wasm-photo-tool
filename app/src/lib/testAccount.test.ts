// The test-account wipe's decisions (convex/testAccount.ts), proven without a
// Convex backend. The repo has no convex-test harness, so this is the same
// shape PR #235 used for the orphan sweep: the part that can select the wrong
// rows is pure, and it is tested here against an in-memory store.
//
// What this does NOT prove: that the Convex store in convex/testAccountWipe.ts
// pairs each row with its files. That pairing lives in the app's own delete
// helpers (deletePhotoEditRecord, deleteShareRecord), which the app already
// runs on every Remove; the fake below mirrors them.
//
// Fixture ids are real-shaped (lowercase base32, 32 chars) like the live rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FILE_FIELDS,
  TEST_ACCOUNT_EMAIL,
  WIPE_ORDER,
  fileIdsOf,
  resolveTestAccount,
  summarizePlan,
  wipeBatch,
  type AnyRow,
  type WipeStore,
  type WipeTable,
} from "../../../convex/testAccount";

const TEST_USER = "j57a1test0000000000000000000test";
const REAL_USER = "j57b2real0000000000000000000real";
const TEST_CLERK = "user_test2zAbCdEfGhIjKlMnOpQrSt";
const REAL_CLERK = "user_real9zAbCdEfGhIjKlMnOpQrSt";

const testRow = { _id: TEST_USER, clerkId: TEST_CLERK, email: TEST_ACCOUNT_EMAIL };

describe("resolveTestAccount", () => {
  it("refuses any email that is not the allowlisted one, even with a matching row", () => {
    const r = resolveTestAccount("chrislanejones@gmail.com", [{ ...testRow, email: "chrislanejones@gmail.com" }], "plan", "");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not the allowlisted test account/);
  });

  it("refuses a near-miss spelling of the allowlisted email", () => {
    expect(resolveTestAccount("ChrisLaneJones+test@gmail.com", [testRow], "plan", "").ok).toBe(false);
    expect(resolveTestAccount(`${TEST_ACCOUNT_EMAIL} `, [testRow], "plan", "").ok).toBe(false);
  });

  it("reports zero rows as not-ok with matched 0 (the account may not exist yet)", () => {
    const r = resolveTestAccount(TEST_ACCOUNT_EMAIL, [], "plan", "");
    expect(r).toMatchObject({ ok: false, matched: 0 });
  });

  it("refuses when more than one users row carries the email, and says why", () => {
    const r = resolveTestAccount(
      TEST_ACCOUNT_EMAIL,
      [testRow, { _id: REAL_USER, clerkId: REAL_CLERK, email: TEST_ACCOUNT_EMAIL }],
      "plan",
      "",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.matched).toBe(2);
      expect(r.reason).toMatch(/2 users rows share email/);
    }
  });

  it("ignores rows the caller passed whose email does not match", () => {
    const r = resolveTestAccount(TEST_ACCOUNT_EMAIL, [testRow, { _id: REAL_USER, clerkId: REAL_CLERK, email: "x@y.z" }], "plan", "");
    expect(r).toMatchObject({ ok: true, userId: TEST_USER });
  });

  it("allows a dry run while TEST_CLERK_ID is unset, and reports it unpinned", () => {
    expect(resolveTestAccount(TEST_ACCOUNT_EMAIL, [testRow], "plan", "")).toEqual({
      ok: true,
      userId: TEST_USER,
      clerkId: TEST_CLERK,
      clerkIdPinned: false,
    });
  });

  it("refuses to APPLY while TEST_CLERK_ID is unset", () => {
    const r = resolveTestAccount(TEST_ACCOUNT_EMAIL, [testRow], "apply", "");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/TEST_CLERK_ID is not set/);
  });

  it("requires BOTH email and clerkId once TEST_CLERK_ID is set", () => {
    expect(resolveTestAccount(TEST_ACCOUNT_EMAIL, [testRow], "apply", REAL_CLERK).ok).toBe(false);
    expect(resolveTestAccount(TEST_ACCOUNT_EMAIL, [testRow], "plan", REAL_CLERK).ok).toBe(false);
    expect(resolveTestAccount(TEST_ACCOUNT_EMAIL, [testRow], "apply", TEST_CLERK)).toMatchObject({
      ok: true,
      clerkIdPinned: true,
    });
  });
});

describe("FILE_FIELDS matches convex/schema.ts", () => {
  it("names every v.id(\"_storage\") field of every table, and nothing else", () => {
    const schema = readFileSync(join(__dirname, "../../../convex/schema.ts"), "utf8");
    const found: Record<string, string[]> = {};
    // Split at each `name: defineTable(`; each chunk is one table's body.
    const parts = schema.split(/\n\s*(\w+): defineTable\(/);
    for (let i = 1; i < parts.length; i += 2) {
      const table = parts[i];
      const body = parts[i + 1];
      for (const m of body.matchAll(/(\w+): (?:v\.optional\()?v\.id\("_storage"\)/g)) {
        (found[table] ??= []).push(m[1]);
      }
    }
    const expected = Object.fromEntries(Object.entries(FILE_FIELDS).map(([t, f]) => [t, [...f]]));
    expect(found).toEqual(expected);
  });
});

describe("fileIdsOf", () => {
  it("reads only the declared fields, skips absent ones, and ignores file-less tables", () => {
    expect(fileIdsOf("ai_jobs", { inputStorageId: "a", outputStorageId: "c", other: "zzz" })).toEqual(["a", "c"]);
    expect(fileIdsOf("photo_edits", { storageId: "s" })).toEqual(["s"]);
    expect(fileIdsOf("images", {})).toEqual([]);
    expect(fileIdsOf("projects", { storageId: "looks-like-one" })).toEqual([]);
  });
});

// ── In-memory backend ────────────────────────────────────────────────────────

type Tables = Record<WipeTable | "users", AnyRow[]>;

function emptyTables(): Tables {
  return Object.fromEntries([...WIPE_ORDER, "users"].map((t) => [t, []])) as unknown as Tables;
}

/** Whose row is this? Parents carry `userId`; children are reached through
 *  their parent, exactly as convex/testAccountWipe.ts reaches them. */
function ownerOf(db: Tables, table: WipeTable, row: AnyRow): unknown {
  if (table === "share_views") return db.shares.find((s) => s._id === row.shareId)?.userId;
  if (table === "annotations" || table === "layers" || table === "history") {
    return db.images.find((i) => i._id === row.imageId)?.userId;
  }
  return row.userId;
}

/** A store scoped to one account. deleteRecord mirrors the app's helpers:
 *  the row's files, then (for shares) its views, then the row. */
function memoryStore(db: Tables, files: Map<string, number>, userId: string, calls: { list: number }): WipeStore {
  return {
    async listOwned(table, limit) {
      calls.list += 1;
      return db[table].filter((r) => ownerOf(db, table, r) === userId).slice(0, limit);
    },
    async deleteRecord(table, row) {
      let n = 0;
      let bytes = 0;
      for (const id of new Set(fileIdsOf(table, row))) {
        const size = files.get(id);
        if (size === undefined) continue;
        files.delete(id);
        n += 1;
        bytes += size;
      }
      if (table === "shares") db.share_views = db.share_views.filter((v) => v.shareId !== row._id);
      db[table] = db[table].filter((r) => r._id !== row._id);
      return { files: n, bytes };
    },
  };
}

function ownedCounts(db: Tables, files: Map<string, number>, userId: string) {
  let rows = 0;
  const ids = new Set<string>();
  for (const table of WIPE_ORDER) {
    for (const row of db[table]) {
      if (ownerOf(db, table, row) !== userId) continue;
      rows += 1;
      for (const id of fileIdsOf(table, row)) if (files.has(id)) ids.add(id);
    }
  }
  return { rows, files: ids.size };
}

async function runToCompletion(store: WipeStore, batch: number) {
  const total = { rows: 0, files: 0, bytes: 0, batches: 0 };
  for (let i = 0; i < 100; i++) {
    const r = await wipeBatch(store, batch);
    total.rows += r.rows;
    total.files += r.files;
    total.bytes += r.bytes;
    total.batches += 1;
    if (r.done) return total;
  }
  throw new Error("wipe did not finish in 100 batches");
}

/** The fixture: the test account owns 3 file-owning rows holding 3 files; a
 *  second (real) account owns the same shapes with its own files. */
function fixture() {
  const db = emptyTables();
  const files = new Map<string, number>([
    ["kg2test0edit000000000000000000aa", 31_000_000],
    ["kg2test0share00000000000000000bb", 2_400_000],
    ["kg2test0aiin0000000000000000000c", 5_100_000],
    ["kg2real0edit000000000000000000aa", 29_000_000],
    ["kg2real0share00000000000000000bb", 1_900_000],
  ]);
  db.users.push({ _id: TEST_USER, clerkId: TEST_CLERK, email: TEST_ACCOUNT_EMAIL });
  db.users.push({ _id: REAL_USER, clerkId: REAL_CLERK, email: "someone@example.com" });
  db.photo_edits.push({ _id: "pe_test", userId: TEST_USER, photoKey: "k1", storageId: "kg2test0edit000000000000000000aa" });
  db.shares.push({ _id: "sh_test", userId: TEST_USER, token: "t1", storageId: "kg2test0share00000000000000000bb" });
  db.ai_jobs.push({ _id: "ai_test", userId: TEST_USER, photoKey: "k1", inputStorageId: "kg2test0aiin0000000000000000000c" });
  db.photo_edits.push({ _id: "pe_real", userId: REAL_USER, photoKey: "k9", storageId: "kg2real0edit000000000000000000aa" });
  db.shares.push({ _id: "sh_real", userId: REAL_USER, token: "t9", storageId: "kg2real0share00000000000000000bb" });
  db.share_views.push({ _id: "sv_real", shareId: "sh_real", at: 1 });
  return { db, files };
}

describe("wipeBatch against an in-memory backend", () => {
  it("takes the test account from 3 rows + 3 files to 0 and 0, in batches, and leaves the other account alone", async () => {
    const { db, files } = fixture();
    const realBefore = JSON.stringify({
      rows: WIPE_ORDER.flatMap((t) => db[t].filter((r) => ownerOf(db, t, r) === REAL_USER)),
      files: [...files].filter(([id]) => id.startsWith("kg2real")),
    });
    expect(ownedCounts(db, files, TEST_USER)).toEqual({ rows: 3, files: 3 });

    const total = await runToCompletion(memoryStore(db, files, TEST_USER, { list: 0 }), 1);

    expect(ownedCounts(db, files, TEST_USER)).toEqual({ rows: 0, files: 0 });
    expect(total).toMatchObject({ rows: 3, files: 3, bytes: 31_000_000 + 2_400_000 + 5_100_000 });
    expect(total.batches).toBeGreaterThanOrEqual(3); // batch size 1 → at least one call per row
    expect(ownedCounts(db, files, REAL_USER)).toEqual({ rows: 3, files: 2 });
    const realAfter = JSON.stringify({
      rows: WIPE_ORDER.flatMap((t) => db[t].filter((r) => ownerOf(db, t, r) === REAL_USER)),
      files: [...files].filter(([id]) => id.startsWith("kg2real")),
    });
    expect(realAfter).toBe(realBefore);
    expect(db.users).toHaveLength(2); // the users rows are never wiped
  });

  it("drains children before their parent, so no child is left unreachable", async () => {
    const db = emptyTables();
    const files = new Map<string, number>([["kg2img0000000000000000000000000a", 10]]);
    db.images.push({ _id: "im1", userId: TEST_USER, projectId: "pr1", storageId: "kg2img0000000000000000000000000a" });
    db.projects.push({ _id: "pr1", userId: TEST_USER });
    for (let i = 0; i < 4; i++) {
      db.layers.push({ _id: `ly${i}`, imageId: "im1" });
      db.annotations.push({ _id: `an${i}`, imageId: "im1", layerId: `ly${i}` });
      db.history.push({ _id: `hi${i}`, imageId: "im1" });
    }
    db.shares.push({ _id: "sh1", userId: TEST_USER, storageId: undefined as unknown as string });
    for (let i = 0; i < 3; i++) db.share_views.push({ _id: `sv${i}`, shareId: "sh1", at: i });

    await runToCompletion(memoryStore(db, files, TEST_USER, { list: 0 }), 2);

    for (const t of WIPE_ORDER) expect(db[t]).toEqual([]);
    expect(files.size).toBe(0);
  });

  it("does not claim done on a batch that only ran out of budget", async () => {
    const { db, files } = fixture();
    const store = memoryStore(db, files, TEST_USER, { list: 0 });
    const first = await wipeBatch(store, 3); // exactly the 3 rows
    expect(first).toMatchObject({ rows: 3, done: false });
    const second = await wipeBatch(store, 3);
    expect(second).toMatchObject({ rows: 0, done: true });
  });

  it("rejects a non-positive or fractional budget", async () => {
    const { db, files } = fixture();
    const store = memoryStore(db, files, TEST_USER, { list: 0 });
    await expect(wipeBatch(store, 0)).rejects.toThrow(/positive integer/);
    await expect(wipeBatch(store, 1.5)).rejects.toThrow(/positive integer/);
  });
});

describe("summarizePlan", () => {
  it("counts rows per table, unique files, bytes, missing files and cross-account files", () => {
    const rows = Object.fromEntries(WIPE_ORDER.map((t) => [t, [] as AnyRow[]])) as Record<WipeTable, AnyRow[]>;
    rows.photo_edits.push({ _id: "a", storageId: "f1" }, { _id: "b", storageId: "f2" });
    rows.ai_jobs.push({ _id: "c", inputStorageId: "f1", outputStorageId: "f3", maskStorageId: "f4" });
    rows.share_views.push({ _id: "d" });
    const sizes: Record<string, number | null> = { f1: 100, f2: 20, f3: 3, f4: null };
    const s = summarizePlan(rows, (id) => sizes[id] ?? null, new Set(["f2"]));
    expect(s.rows.photo_edits).toBe(2);
    expect(s.rows.ai_jobs).toBe(1);
    expect(s.rows.share_views).toBe(1);
    expect(s.totalRows).toBe(4);
    expect(s.files).toBe(4); // f1 counted once
    expect(s.bytes).toBe(123);
    expect(s.missingFiles).toBe(1);
    expect(s.sharedWithOtherAccounts).toBe(1);
  });
});
