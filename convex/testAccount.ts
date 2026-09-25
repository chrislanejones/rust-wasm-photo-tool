// The test-account wipe's decisions. Pure, and imports nothing.
//
// WHY THIS EXISTS. Retention testing needs an account whose uploads can be
// thrown away on demand without anyone writing a one-off delete against the
// live backend (which is the DEV deployment, brave-ant-608, and holds the real
// users). The dangerous part of such a tool is not the delete, it is WHICH rows
// it selects, so that part lives here where the tests can reach it without a
// Convex backend (the repo has no convex-test harness). The Convex half —
// reading rows and calling the app's own delete helpers — is
// `testAccountWipe.ts`; the CLI is `scripts/wipe-test-account.mjs`, which
// imports the constants below directly (Node strips the types), so the
// allowlist exists exactly once.
//
// Erasable TypeScript only (no enums, no namespaces, no parameter properties):
// Node runs this file as-is for the script.

/** The ONLY account this tool will touch. Hardcoded on purpose: an argument or
 *  an env var is one typo away from someone else's photos. */
export const TEST_ACCOUNT_EMAIL = "chrislanejones+test@gmail.com";

/**
 * The test account's Clerk user id — the second factor. TODO(Chris): set this
 * once the Clerk login exists (Clerk dashboard → Users → the +test user →
 * "User ID", `user_...`), then redeploy.
 *
 * While it is EMPTY the dry run still works (it reports the row it matched and
 * that row's clerkId, so the value can be copied from there), but `--apply`
 * refuses: an email alone is not enough to delete on.
 */
export const TEST_CLERK_ID: string = "";

/** What the resolver needs from a `users` row. */
export interface UserLike {
  _id: string;
  clerkId: string;
  email?: string;
}

export type WipeMode = "plan" | "apply";

export type Resolution =
  | { ok: true; userId: string; clerkId: string; clerkIdPinned: boolean }
  | { ok: false; reason: string; matched: number };

/**
 * Decide whether `email` names exactly one allowlisted account.
 *
 * `users` is whatever the caller found by email (the `by_email` index); it is
 * filtered again here so a sloppy caller cannot widen it. `pinnedClerkId` is a
 * parameter only so the tests can exercise both states — production passes
 * `TEST_CLERK_ID`.
 */
export function resolveTestAccount(
  email: string,
  users: readonly UserLike[],
  mode: WipeMode,
  pinnedClerkId: string = TEST_CLERK_ID,
): Resolution {
  if (email !== TEST_ACCOUNT_EMAIL) {
    return {
      ok: false,
      matched: 0,
      reason: `refused: ${JSON.stringify(email)} is not the allowlisted test account (${TEST_ACCOUNT_EMAIL})`,
    };
  }
  const matches = users.filter((u) => u.email === email);
  if (matches.length === 0) {
    return {
      ok: false,
      matched: 0,
      reason: `no users row has email ${email} — sign in with it once to create one`,
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      matched: matches.length,
      reason:
        `refused: ${matches.length} users rows share email ${email} ` +
        `(${matches.map((u) => `${u._id}/${u.clerkId}`).join(", ")}). ` +
        `An email that maps to more than one account cannot say which one is the test account.`,
    };
  }
  const user = matches[0];
  if (pinnedClerkId !== "" && user.clerkId !== pinnedClerkId) {
    return {
      ok: false,
      matched: 1,
      reason:
        `refused: the row for ${email} has clerkId ${user.clerkId}, ` +
        `but TEST_CLERK_ID is ${pinnedClerkId}. Both must match.`,
    };
  }
  if (mode === "apply" && pinnedClerkId === "") {
    return {
      ok: false,
      matched: 1,
      reason:
        `refused: TEST_CLERK_ID is not set in convex/testAccount.ts. ` +
        `The dry run matched clerkId ${user.clerkId}; pin it, redeploy, then apply.`,
    };
  }
  return { ok: true, userId: user._id, clerkId: user.clerkId, clerkIdPinned: pinnedClerkId !== "" };
}

// ── What gets deleted ────────────────────────────────────────────────────────

/** Every table that holds a `v.id("_storage")`, and the fields that do. Keep
 *  in step with convex/schema.ts — the test asserts it against the schema
 *  source so a new storage field cannot be missed silently. */
export const FILE_FIELDS = {
  photo_edits: ["storageId"],
  shares: ["storageId"],
  ai_jobs: ["inputStorageId", "maskStorageId", "outputStorageId"],
  images: ["storageId"],
} as const;

export type FileTable = keyof typeof FILE_FIELDS;

/**
 * Delete order. Children before the parent they hang off, because the child
 * rows are FOUND through the parent (a share's views by `shareId`, an image's
 * layers by `imageId`) — delete the parent first and its children become rows
 * nothing can reach, which is how orphans are made.
 */
export const WIPE_ORDER = [
  "share_views",
  "annotations",
  "layers",
  "history",
  "photo_edits",
  "shares",
  "ai_jobs",
  "images",
  "projects",
] as const;

export type WipeTable = (typeof WIPE_ORDER)[number];

/**
 * Owned by the account and deliberately NOT wiped. Counted in the dry run so
 * nothing about the account is invisible.
 *  - users: the identity. Deleting it only makes `requireUser` mint a new one.
 *  - sync_docs: the schema forbids deleting these rows — a row that vanished
 *    restarts at rev 1 under devices that remember a higher one.
 *  - subscriptions: Stripe linkage; deleting the row does not cancel anything.
 *  - recent_texts, user_colors: preferences, not retention-relevant storage.
 */
export const KEPT_TABLES = ["users", "sync_docs", "subscriptions", "recent_texts", "user_colors"] as const;

export type KeptTable = (typeof KEPT_TABLES)[number];

function isFileTable(table: string): table is FileTable {
  return Object.prototype.hasOwnProperty.call(FILE_FIELDS, table);
}

/** The storage ids a row points at (0–3). Rows of tables without files → []. */
export function fileIdsOf(table: string, row: Record<string, unknown>): string[] {
  if (!isFileTable(table)) return [];
  const ids: string[] = [];
  for (const field of FILE_FIELDS[table]) {
    const value = row[field];
    if (typeof value === "string" && value !== "") ids.push(value);
  }
  return ids;
}

// ── The dry-run summary ──────────────────────────────────────────────────────

export interface PlanSummary {
  rows: Record<WipeTable, number>;
  totalRows: number;
  /** Unique storage ids referenced by the rows above. */
  files: number;
  /** Sum of `_storage.size` over the files that exist. */
  bytes: number;
  /** Referenced by a row but absent from `_storage` (already gone). */
  missingFiles: number;
  /** Also referenced by ANOTHER account's row. Must be 0 to apply. */
  sharedWithOtherAccounts: number;
}

/**
 * Totals for a dry run. `sizeOf` returns the `_storage` size, or null when the
 * file does not exist; `otherAccountsFileIds` is every storage id referenced by
 * a row that belongs to someone else.
 */
export function summarizePlan(
  rowsByTable: Readonly<Record<WipeTable, readonly Record<string, unknown>[]>>,
  sizeOf: (id: string) => number | null,
  otherAccountsFileIds: ReadonlySet<string>,
): PlanSummary {
  const rows = {} as Record<WipeTable, number>;
  const ids = new Set<string>();
  let totalRows = 0;
  for (const table of WIPE_ORDER) {
    const list = rowsByTable[table];
    rows[table] = list.length;
    totalRows += list.length;
    for (const row of list) for (const id of fileIdsOf(table, row)) ids.add(id);
  }
  let bytes = 0;
  let missingFiles = 0;
  let sharedWithOtherAccounts = 0;
  for (const id of ids) {
    const size = sizeOf(id);
    if (size === null) missingFiles += 1;
    else bytes += size;
    if (otherAccountsFileIds.has(id)) sharedWithOtherAccounts += 1;
  }
  return { rows, totalRows, files: ids.size, bytes, missingFiles, sharedWithOtherAccounts };
}

// ── The apply loop ───────────────────────────────────────────────────────────

/** A row as the orchestrator sees it: an id plus whatever fields it has. */
export type AnyRow = { _id: string } & Record<string, unknown>;

/** What one record deletion removed from `_storage`. */
export interface DeletedFiles {
  files: number;
  bytes: number;
}

/**
 * The two things a wipe needs from a database, already scoped to ONE account.
 * The Convex implementation (testAccountWipe.ts) answers `deleteRecord` with
 * the app's own delete helpers, which remove a row's files and the row in the
 * same transaction — never one without the other.
 */
export interface WipeStore {
  listOwned(table: WipeTable, limit: number): Promise<AnyRow[]>;
  deleteRecord(table: WipeTable, row: AnyRow): Promise<DeletedFiles>;
}

export interface BatchResult {
  rows: number;
  files: number;
  bytes: number;
  /** True only when every table was seen to be empty in this call. */
  done: boolean;
}

/**
 * Delete up to `budget` records, in WIPE_ORDER. Called repeatedly (one Convex
 * mutation per call, so each stays inside the transaction limits) until
 * `done`. A table is only passed over once it returned FEWER rows than asked
 * for, so `done` is never claimed on a batch that merely ran out of budget.
 */
export async function wipeBatch(store: WipeStore, budget: number): Promise<BatchResult> {
  if (!Number.isInteger(budget) || budget < 1) throw new Error(`budget must be a positive integer, got ${budget}`);
  const result: BatchResult = { rows: 0, files: 0, bytes: 0, done: false };
  let left = budget;
  for (const table of WIPE_ORDER) {
    for (;;) {
      if (left === 0) return result;
      const rows = await store.listOwned(table, left);
      for (const row of rows) {
        const deleted = await store.deleteRecord(table, row);
        result.rows += 1;
        result.files += deleted.files;
        result.bytes += deleted.bytes;
      }
      left -= rows.length;
      if (rows.length === 0) break;
    }
  }
  result.done = true;
  return result;
}
