// An in-memory stand-in for the Convex deployment that runs the REAL
// handlers from convex/sync.ts — not a re-implementation of them — against a
// fake `ctx.db`. Test-only: imported by server.test.ts and
// useCloudSync.test.ts, never by app code. (The name keeps it out of vitest's
// `*.test.ts` collection; it is a helper, not a spec.)
//
// Why not convex-test: it is a new dependency, and the rule here is none. The
// handlers touch four db calls — query().withIndex().unique(), insert, patch —
// which is small enough to fake faithfully, including `patch` with
// `undefined` removing a field, which is what Forget relies on.
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import { pull, push, clear } from "../../../../convex/sync";

export type PullResult = FunctionReturnType<typeof api.sync.pull>;
export type PushResult = FunctionReturnType<typeof api.sync.push>;
export interface PushArgs {
  key: string;
  value: string;
  format: number;
  baseRev: number;
}

type Row = Record<string, unknown> & { _id: string };

interface Registered {
  _handler: (ctx: unknown, args: unknown) => Promise<unknown>;
}

export function createFakeConvex() {
  const tables = new Map<string, Map<string, Row>>([
    ["users", new Map()],
    ["sync_docs", new Map()],
  ]);
  let seq = 0;
  let identity: { subject: string } | null = null;

  const db = {
    query(table: string) {
      return {
        withIndex(_index: string, build: (q: unknown) => unknown) {
          const eqs: [string, unknown][] = [];
          const q = {
            eq(field: string, value: unknown) {
              eqs.push([field, value]);
              return q;
            },
          };
          build(q);
          const rows = [...tables.get(table)!.values()].filter((r) =>
            eqs.every(([f, v]) => r[f] === v),
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
    async get(id: string) {
      return tables.get(id.split("|")[0])?.get(id) ?? null;
    },
  };

  const ctx = { db, auth: { getUserIdentity: async () => identity } };
  const call = <R>(fn: unknown, args: unknown) =>
    (fn as Registered)._handler(ctx, args) as Promise<R>;

  function userRow(subject: string): Row | undefined {
    return [...tables.get("users")!.values()].find((u) => u.clerkId === subject);
  }

  return {
    /** Sign in as `subject`, creating the users row (with an optional legacy
     *  `settings` blob) the first time. Returns the row id — the `account`. */
    async signIn(subject: string, legacySettings?: string): Promise<string> {
      identity = { subject };
      const existing = userRow(subject);
      if (existing) return existing._id;
      return db.insert("users", {
        clerkId: subject,
        tier: "free",
        dailyUsage: 0,
        usageResetAt: 0,
        createdAt: 0,
        updatedAt: 0,
        ...(legacySettings ? { settings: legacySettings, settingsHash: "legacy" } : {}),
      });
    },
    signOut() {
      identity = null;
    },
    pull: () => call<PullResult>(pull, {}),
    push: (args: PushArgs) => call<PushResult>(push, args),
    clear: () => call<{ forgotten: number }>(clear, {}),
    /** The `sync_docs` row for `key`, for one account or the only one. */
    row(key: string, account?: string): Row | undefined {
      return [...tables.get("sync_docs")!.values()].find(
        (r) => r.key === key && (account === undefined || r.userId === account),
      );
    },
    user(subject: string): Row | undefined {
      return userRow(subject);
    },
  };
}

export type FakeConvex = ReturnType<typeof createFakeConvex>;
