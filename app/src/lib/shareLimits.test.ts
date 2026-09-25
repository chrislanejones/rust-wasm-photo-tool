// convex/shares.ts — the share-link limits, against an in-memory db.
//
// Settings › Shared lets an owner pause a link, cap its views, or give it an
// end date. The rule that makes all three safe is in ONE pure function,
// `availability`, and every handler asks it: a link is never counted while it
// is not viewable, and never viewable while it is stopped. The tests below
// pin that function, the 30-day bucketing the pane draws, and the handlers'
// answers — the `get` union in particular, because a stale ShareViewer keys
// off it, and the unavailable branch must carry NO image URL.
//
// The fake here follows lib/sync/fakeConvex.testkit.ts (real handlers via
// `_handler`, fake `ctx.db`) and adds the two things these handlers need that
// sync's do not: a `gte` on the index builder and `ctx.storage`. It lives in
// this file rather than the testkit because the testkit is sync's.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import {
  availability,
  checkLimits,
  dailyBuckets,
  dailyWindowStart,
  DAILY_DAYS,
  MAX_VIEWS_CEILING,
  create,
  get,
  recordView,
  listMine,
  setLimits,
  expire,
  pause,
  resume,
  remove,
} from "../../../convex/shares";

const DAY = 86_400_000;
/** 09-22-2026 12:00:00 UTC — "now" for every clock-sensitive test. */
const NOON = Date.UTC(2026, 8, 22, 12, 0, 0);
const TODAY_START = Date.UTC(2026, 8, 22, 0, 0, 0);

// ── The pure rule ────────────────────────────────────────────────────────────

describe("availability", () => {
  it("is live with no limits at all", () => {
    expect(availability({ views: 0 }, NOON)).toBe("live");
    expect(availability({ views: 999_999 }, NOON)).toBe("live");
  });

  it("names each stop", () => {
    expect(availability({ views: 0, pausedAt: NOON - 1 }, NOON)).toBe("paused");
    expect(availability({ views: 0, expiresAt: NOON - 1 }, NOON)).toBe("expired");
    expect(availability({ views: 5, maxViews: 5 }, NOON)).toBe("views");
  });

  it("checks pause, then date, then cap — the owner's own act wins", () => {
    const all = { views: 10, maxViews: 5, expiresAt: NOON - DAY, pausedAt: NOON - 1 };
    expect(availability(all, NOON)).toBe("paused");
    expect(availability({ ...all, pausedAt: undefined }, NOON)).toBe("expired");
    expect(availability({ ...all, pausedAt: undefined, expiresAt: undefined }, NOON)).toBe("views");
  });

  it("stops AT the cap: views === maxViews is stopped, one under is live", () => {
    expect(availability({ views: 24, maxViews: 25 }, NOON)).toBe("live");
    expect(availability({ views: 25, maxViews: 25 }, NOON)).toBe("views");
    expect(availability({ views: 26, maxViews: 25 }, NOON)).toBe("views");
  });

  it("stops AT the date: now === expiresAt is expired, one ms before is live", () => {
    expect(availability({ views: 0, expiresAt: NOON }, NOON - 1)).toBe("live");
    expect(availability({ views: 0, expiresAt: NOON }, NOON)).toBe("expired");
  });
});

describe("dailyBuckets", () => {
  it("is exactly 30 numbers, all zero with no views", () => {
    const daily = dailyBuckets([], NOON);
    expect(daily).toHaveLength(DAILY_DAYS);
    expect(daily.every((n) => n === 0)).toBe(true);
  });

  it("puts today at index 29 and 29 days ago at index 0, by UTC day", () => {
    const daily = dailyBuckets(
      [
        TODAY_START, // 00:00:00.000Z today → 29
        NOON, // → 29
        TODAY_START - 1, // 23:59:59.999Z yesterday → 28
        TODAY_START - 29 * DAY, // → 0
      ],
      NOON,
    );
    expect(daily[29]).toBe(2);
    expect(daily[28]).toBe(1);
    expect(daily[0]).toBe(1);
    expect(daily.reduce((a, b) => a + b, 0)).toBe(4);
  });

  it("drops a view from 30 days ago — it is outside the window", () => {
    const daily = dailyBuckets([TODAY_START - 30 * DAY, NOON - 30 * DAY], NOON);
    expect(daily.reduce((a, b) => a + b, 0)).toBe(0);
    expect(dailyWindowStart(NOON)).toBe(TODAY_START - 29 * DAY);
  });

  it("lands a timestamp after `now` on today rather than losing the view", () => {
    expect(dailyBuckets([NOON + DAY], NOON)[29]).toBe(1);
  });
});

describe("checkLimits", () => {
  it("accepts null (clear), 1, and the ceiling; refuses 0, fractions, past the ceiling, NaN", () => {
    expect(checkLimits({ maxViews: null, expiresAt: null })).toBeNull();
    expect(checkLimits({ maxViews: 1, expiresAt: null })).toBeNull();
    expect(checkLimits({ maxViews: MAX_VIEWS_CEILING, expiresAt: null })).toBeNull();
    for (const bad of [0, -1, 1.5, MAX_VIEWS_CEILING + 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(checkLimits({ maxViews: bad, expiresAt: null })).toMatch(/maxViews/);
    }
  });

  it("accepts any finite date, including one in the past; refuses NaN and Infinity", () => {
    expect(checkLimits({ maxViews: null, expiresAt: 0 })).toBeNull();
    expect(checkLimits({ maxViews: null, expiresAt: NOON - DAY })).toBeNull();
    expect(checkLimits({ maxViews: null, expiresAt: Number.NaN })).toMatch(/expiresAt/);
    expect(checkLimits({ maxViews: null, expiresAt: Number.POSITIVE_INFINITY })).toMatch(/expiresAt/);
  });
});

// ── The handlers, against a fake deployment ─────────────────────────────────

type GetResult = FunctionReturnType<typeof api.shares.get>;
type ListResult = FunctionReturnType<typeof api.shares.listMine>;
type Row = Record<string, unknown> & { _id: string };

interface Registered {
  _handler: (ctx: unknown, args: unknown) => Promise<unknown>;
}

function createFakeConvex() {
  const tables = new Map<string, Map<string, Row>>([
    ["users", new Map()],
    ["shares", new Map()],
    ["share_views", new Map()],
  ]);
  const blobs = new Set<string>();
  let seq = 0;
  let identity: { subject: string } | null = null;

  const db = {
    query(table: string) {
      return {
        withIndex(_index: string, build: (q: unknown) => unknown) {
          const eqs: [string, unknown][] = [];
          const gtes: [string, number][] = [];
          const q = {
            eq(field: string, value: unknown) {
              eqs.push([field, value]);
              return q;
            },
            gte(field: string, value: number) {
              gtes.push([field, value]);
              return q;
            },
          };
          build(q);
          const rows = [...tables.get(table)!.values()].filter(
            (r) =>
              eqs.every(([f, v]) => r[f] === v) &&
              gtes.every(([f, v]) => (r[f] as number) >= v),
          );
          return {
            unique: async () => {
              if (rows.length > 1) throw new Error(`${table}: more than one row`);
              return rows[0] ?? null;
            },
            collect: async () => rows,
          };
        },
      };
    },
    async insert(table: string, doc: Record<string, unknown>) {
      const _id = `${table}|${++seq}`;
      tables.get(table)!.set(_id, { ...doc, _id, _creationTime: Date.now() });
      return _id;
    },
    async patch(id: string, fields: Record<string, unknown>) {
      const row = tables.get(id.split("|")[0])!.get(id);
      if (!row) throw new Error(`patch: no row ${id}`);
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) delete row[k];
        else row[k] = v;
      }
    },
    async delete(id: string) {
      tables.get(id.split("|")[0])!.delete(id);
    },
    async get(id: string) {
      return tables.get(id.split("|")[0])?.get(id) ?? null;
    },
  };

  const storage = {
    getUrl: async (id: string) => (blobs.has(id) ? `https://blob.test/${id}` : null),
    delete: async (id: string) => {
      blobs.delete(id);
    },
  };

  // The scheduler only records: a test runs a due job itself, with the args
  // the handler scheduled, through the real `expire` handler.
  const scheduled: { at: number; args: { shareId: string; at: number } }[] = [];
  const scheduler = {
    runAt: async (at: number, _fn: unknown, args: { shareId: string; at: number }) => {
      scheduled.push({ at, args });
    },
  };

  const ctx = { db, storage, scheduler, auth: { getUserIdentity: async () => identity } };
  const call = <R>(fn: unknown, args: unknown) =>
    (fn as Registered)._handler(ctx, args) as Promise<R>;

  return {
    async signIn(subject: string): Promise<string> {
      identity = { subject };
      const existing = [...tables.get("users")!.values()].find((u) => u.clerkId === subject);
      if (existing) return existing._id;
      return db.insert("users", {
        clerkId: subject,
        tier: "free",
        dailyUsage: 0,
        usageResetAt: 0,
        createdAt: 0,
        updatedAt: 0,
      });
    },
    signOut() {
      identity = null;
    },
    /** Upload a blob and mint a link for it, as the signed-in user. */
    async share(title = "sky", blob = `blob-${seq + 1}`): Promise<string> {
      blobs.add(blob);
      const r = await call<{ token: string }>(create, {
        storageId: blob,
        canvasW: 1920,
        canvasH: 1080,
        title,
      });
      return r.token;
    },
    dropBlob: (id: string) => blobs.delete(id),
    get: (token: string) => call<GetResult>(get, { token }),
    recordView: (token: string) => call<void>(recordView, { token }),
    listMine: () => call<ListResult>(listMine, {}),
    setLimits: (args: { token: string; maxViews: number | null; expiresAt: number | null }) =>
      call<void>(setLimits, args),
    pause: (token: string) => call<void>(pause, { token }),
    resume: (token: string) => call<void>(resume, { token }),
    remove: (token: string) => call<void>(remove, { token }),
    scheduled,
    /** Run every job due at or before the fake clock, in order, once. */
    async runDue() {
      const due = scheduled.filter((j) => j.at <= Date.now());
      for (const j of due) {
        scheduled.splice(scheduled.indexOf(j), 1);
        await call<void>(expire, j.args);
      }
    },
    row(token: string): Row | undefined {
      return [...tables.get("shares")!.values()].find((r) => r.token === token);
    },
    viewRows(token: string): Row[] {
      const share = this.row(token);
      return [...tables.get("share_views")!.values()].filter((r) => r.shareId === share?._id);
    },
    hasBlob: (id: string) => blobs.has(id),
  };
}

type FakeConvex = ReturnType<typeof createFakeConvex>;

let server: FakeConvex;
let token: string;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOON);
  server = createFakeConvex();
  await server.signIn("owner");
  token = await server.share("sky", "blob-1");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("shares:get — the union a viewer keys off", () => {
  it("answers a live link with the pre-limits shape plus status: live", async () => {
    expect(await server.get(token)).toEqual({
      status: "live",
      imageUrl: "https://blob.test/blob-1",
      canvasW: 1920,
      canvasH: 1080,
      title: "sky",
      views: 0,
      createdAt: NOON,
    });
  });

  it("answers a stopped link with the reason and NO image URL", async () => {
    await server.pause(token);
    expect(await server.get(token)).toEqual({
      status: "unavailable",
      reason: "paused",
      title: "sky",
      createdAt: NOON,
    });

    await server.resume(token);
    await server.setLimits({ token, maxViews: null, expiresAt: NOON - 1 });
    expect(await server.get(token)).toMatchObject({ status: "unavailable", reason: "expired" });
  });

  it("is null only for a token that does not exist or a blob that is gone", async () => {
    expect(await server.get("nope")).toBeNull();
    await server.pause(token);
    server.dropBlob("blob-1");
    expect(await server.get(token)).toBeNull();
  });
});

describe("shares:recordView — counts only what was served", () => {
  it("bumps the total, stamps lastViewedAt, and writes one timestamp-only row", async () => {
    await server.recordView(token);
    expect(server.row(token)).toMatchObject({ views: 1, lastViewedAt: NOON });
    const rows = server.viewRows(token);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["_creationTime", "_id", "at", "shareId"]);
    expect(rows[0].at).toBe(NOON);
  });

  it("is a no-op while the link is paused, expired, or at its cap", async () => {
    await server.pause(token);
    await server.recordView(token);
    await server.resume(token);
    await server.setLimits({ token, maxViews: null, expiresAt: NOON });
    await server.recordView(token);
    expect(server.row(token)!.views).toBe(0);
    expect(server.row(token)!.lastViewedAt).toBeUndefined();
    expect(server.viewRows(token)).toHaveLength(0);
  });

  it("serves the 25th view of a 25-view link, then stops", async () => {
    await server.setLimits({ token, maxViews: 25, expiresAt: null });
    for (let i = 0; i < 30; i++) await server.recordView(token);
    expect(server.row(token)!.views).toBe(25);
    expect(server.viewRows(token)).toHaveLength(25);
    expect(await server.get(token)).toMatchObject({ status: "unavailable", reason: "views" });
  });

  it("does not throw for a token that does not exist", async () => {
    await expect(server.recordView("nope")).resolves.toBeUndefined();
  });
});

describe("shares:setLimits — limits are derived, not written as a pause", () => {
  it("un-stops a capped link the moment the cap is raised or cleared, with no other write", async () => {
    await server.setLimits({ token, maxViews: 2, expiresAt: null });
    await server.recordView(token);
    await server.recordView(token);
    expect(await server.get(token)).toMatchObject({ reason: "views" });

    await server.setLimits({ token, maxViews: 3, expiresAt: null });
    expect(await server.get(token)).toMatchObject({ status: "live", views: 2 });
    expect(server.row(token)!.pausedAt).toBeUndefined();

    await server.setLimits({ token, maxViews: null, expiresAt: null });
    expect(server.row(token)!.maxViews).toBeUndefined();
    expect(server.row(token)!.expiresAt).toBeUndefined();
  });

  it("refuses an out-of-range cap or a non-date, and keeps the row as it was", async () => {
    await expect(server.setLimits({ token, maxViews: 0, expiresAt: null })).rejects.toThrow(/maxViews/);
    await expect(server.setLimits({ token, maxViews: 2.5, expiresAt: null })).rejects.toThrow(/maxViews/);
    await expect(
      server.setLimits({ token, maxViews: MAX_VIEWS_CEILING + 1, expiresAt: null }),
    ).rejects.toThrow(/maxViews/);
    await expect(
      server.setLimits({ token, maxViews: null, expiresAt: Number.NaN }),
    ).rejects.toThrow(/expiresAt/);
    expect(server.row(token)!.maxViews).toBeUndefined();
    expect(server.row(token)!.expiresAt).toBeUndefined();
  });

  it("is owner-only", async () => {
    await server.signIn("someone_else");
    await expect(server.setLimits({ token, maxViews: 1, expiresAt: null })).rejects.toThrow(/Not your/);
    await expect(server.pause(token)).rejects.toThrow(/Not your/);
    await expect(server.remove(token)).rejects.toThrow(/Not your/);
    server.signOut();
    await expect(server.setLimits({ token, maxViews: 1, expiresAt: null })).rejects.toThrow(
      /Not authenticated/,
    );
    expect(server.row(token)).toBeDefined();
  });
});

describe("shares:pause / resume", () => {
  it("pause is idempotent and keeps the first timestamp; resume removes the field", async () => {
    await server.pause(token);
    expect(server.row(token)!.pausedAt).toBe(NOON);
    vi.setSystemTime(NOON + DAY);
    await server.pause(token);
    expect(server.row(token)!.pausedAt).toBe(NOON);

    await server.resume(token);
    expect("pausedAt" in server.row(token)!).toBe(false);
    expect(await server.get(token)).toMatchObject({ status: "live" });
  });

  it("resume clears only the pause — a cap that is also hit keeps the link stopped for THAT reason", async () => {
    await server.setLimits({ token, maxViews: 1, expiresAt: null });
    await server.recordView(token);
    await server.pause(token);
    expect(await server.get(token)).toMatchObject({ reason: "paused" });
    await server.resume(token);
    expect(await server.get(token)).toMatchObject({ reason: "views" });
  });
});

describe("shares:listMine — the pane's rows", () => {
  it("is empty when signed out", async () => {
    server.signOut();
    expect(await server.listMine()).toEqual([]);
  });

  it("lists newest first with status, limits as null-or-number, and 30 daily buckets", async () => {
    vi.setSystemTime(NOON + 1000);
    const newer = await server.share("later", "blob-2");
    await server.setLimits({ token: newer, maxViews: 10, expiresAt: NOON + DAY });
    vi.setSystemTime(NOON);

    const rows = await server.listMine();
    expect(rows.map((r) => r.token)).toEqual([newer, token]);
    expect(rows[1]).toEqual({
      token,
      title: "sky",
      canvasW: 1920,
      canvasH: 1080,
      views: 0,
      createdAt: NOON,
      lastViewedAt: null,
      maxViews: null,
      expiresAt: null,
      pausedAt: null,
      status: "live",
      imageUrl: "https://blob.test/blob-1",
      daily: new Array(DAILY_DAYS).fill(0),
    });
    expect(rows[0]).toMatchObject({ maxViews: 10, expiresAt: NOON + DAY, status: "live" });
  });

  it("buckets views by UTC day: 00:00:00Z today is index 29, 30 days ago is outside", async () => {
    // Views recorded through the real mutation at controlled clocks.
    for (const at of [TODAY_START - 30 * DAY, TODAY_START - 29 * DAY, TODAY_START - 1, TODAY_START, NOON]) {
      vi.setSystemTime(at);
      await server.recordView(token);
    }
    vi.setSystemTime(NOON);

    const [row] = await server.listMine();
    expect(row.views).toBe(5);
    expect(row.lastViewedAt).toBe(NOON);
    expect(row.daily).toHaveLength(DAILY_DAYS);
    expect(row.daily[29]).toBe(2);
    expect(row.daily[28]).toBe(1);
    expect(row.daily[0]).toBe(1);
    // The 30-days-ago view is in the total but not in the window.
    expect(row.daily.reduce((a, b) => a + b, 0)).toBe(4);
  });

  it("reports each stop reason as status", async () => {
    await server.pause(token);
    expect((await server.listMine())[0].status).toBe("paused");
    await server.resume(token);
    await server.setLimits({ token, maxViews: null, expiresAt: NOON - 1 });
    expect((await server.listMine())[0].status).toBe("expired");
  });
});

describe("shares:remove", () => {
  it("drops the row, its blob, and its view rows — and nobody else's", async () => {
    const other = await server.share("other", "blob-2");
    await server.recordView(token);
    await server.recordView(other);

    await server.remove(token);
    expect(server.row(token)).toBeUndefined();
    expect(server.hasBlob("blob-1")).toBe(false);
    expect(server.viewRows(token)).toHaveLength(0);
    expect(server.viewRows(other)).toHaveLength(1);
    expect(server.hasBlob("blob-2")).toBe(true);

    // A second revoke (another tab) is a no-op, not a throw.
    await expect(server.remove(token)).resolves.toBeUndefined();
  });
});

describe("shares:setLimits — an end date needs a write at that instant", () => {
  // Convex caches a query and does not re-run it as time passes, so `get`
  // alone would keep answering "live" past the date until something touched
  // the row. The scheduled `expire` is that touch.
  it("a future date schedules one job at that instant, and the job stamps expiredAt", async () => {
    const at = NOON + 3_600_000;
    await server.setLimits({ token, maxViews: null, expiresAt: at });
    expect(server.scheduled).toEqual([{ at, args: { shareId: server.row(token)!._id, at } }]);

    vi.setSystemTime(at);
    await server.runDue();
    expect(server.row(token)!.expiredAt).toBe(at);
    expect(await server.get(token)).toMatchObject({ status: "unavailable", reason: "expired" });
  });

  it("a job for a date that was moved since does nothing", async () => {
    await server.setLimits({ token, maxViews: null, expiresAt: NOON + 1_000 });
    await server.setLimits({ token, maxViews: null, expiresAt: NOON + 5_000 });
    vi.setSystemTime(NOON + 1_000);
    await server.runDue();
    expect(server.row(token)!.expiredAt).toBeUndefined();
    expect(await server.get(token)).toMatchObject({ status: "live" });
  });

  it("moving the date later after it passed clears expiredAt and the link is live again", async () => {
    await server.setLimits({ token, maxViews: null, expiresAt: NOON + 1_000 });
    vi.setSystemTime(NOON + 1_000);
    await server.runDue();
    expect(server.row(token)!.expiredAt).toBe(NOON + 1_000);

    await server.setLimits({ token, maxViews: null, expiresAt: NOON + DAY });
    expect(server.row(token)!.expiredAt).toBeUndefined();
    expect(await server.get(token)).toMatchObject({ status: "live" });
  });

  it("a date already past schedules nothing — the patch itself is the write", async () => {
    await server.setLimits({ token, maxViews: null, expiresAt: NOON - 1 });
    expect(server.scheduled).toEqual([]);
    expect(await server.get(token)).toMatchObject({ reason: "expired" });
  });
});
