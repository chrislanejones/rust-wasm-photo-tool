// This device's bookkeeping for each synced document, PER ACCOUNT, kept across
// reloads.
//
// A document's VALUE lives where the app already keeps it (localStorage for
// preferences, IndexedDB for the two zustand stores). What lives here is what
// the sync layer knows ABOUT that value, for one account:
//
//   rev        the server revision the value is based on
//   pending    the value the user set here, signed in to this account, that
//              the server has not been told — or null
//   updatedAt  when that change was made — the conflict tiebreak
//   seen       this device has reconciled this document with this account
//              before (false ⇒ first contact: take the account's copy)
//
// PENDING IS A VALUE, NOT A FLAG. The document is "dirty" for an account only
// while the app still holds exactly the value that account is owed. A boolean
// outlived its value: sign in as A, change a setting while offline, switch to
// B (the device adopts B's settings), switch back — and A was "owed" a push of
// B's settings. Kept as the value, the obligation lapses the moment the device
// stops holding it, and nothing but what that person set can be sent into
// their account.
//
// WHY PERSISTED. `dirty` used to live in memory only, so a change made just
// before a reload, a crash or a dropped connection was quietly never sent —
// while Settings said "Nothing is lost". Now the obligation survives the tab.
//
// WHY PER ACCOUNT. On a shared browser, person A's unsent change must never be
// sent into person B's account, and a device that has synced with A must
// still count as a stranger to B. Every entry is filed under the Convex user
// id the server reported, and a change made while nobody is signed in is
// filed under nobody: it is never owed to any account.
//
// WHY localStorage. Synchronous, so a change is recorded in the same turn it
// happens, and shared by every tab of the profile, so whichever tab ends up
// sending the change reads the same record. It holds numbers, flags, the
// Convex account id, and a copy of any setting still waiting to be sent — a
// few kilobytes at most, never photos, and never leaving the device. Where it
// is unavailable (blocked storage), a per-tab in-memory copy keeps sync
// working for the session, which is exactly what the app's own settings get
// there too.
import type { SyncKey } from "./keys";

const LEDGER_KEY = "image-horse-sync-ledger-v1";
const ACCOUNT_KEY = "image-horse-sync-account";

export interface LedgerEntry {
  rev: number;
  pending: string | null;
  updatedAt: number;
  seen: boolean;
}

export const EMPTY_ENTRY: LedgerEntry = Object.freeze({
  rev: 0,
  pending: null,
  updatedAt: 0,
  seen: false,
});

type Ledger = Record<string, Partial<Record<SyncKey, LedgerEntry>>>;

// Fallback for when localStorage throws (blocked storage) or does not exist.
let memoryLedger: Ledger = {};
let memoryAccount: string | null = null;

function storage(): Storage | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    // Reading is what throws in a blocked-storage context, not the lookup.
    ls.getItem(ACCOUNT_KEY);
    return ls;
  } catch {
    return null;
  }
}

/** Validated read: the blob is same-origin-writable, so a malformed or
 *  foreign entry reads as absent rather than landing in the reconcile rule
 *  as, say, a string revision. */
function readLedger(): Ledger {
  const ls = storage();
  if (!ls) return memoryLedger;
  try {
    const raw = ls.getItem(LEDGER_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Ledger = {};
    for (const [account, docs] of Object.entries(parsed as Record<string, unknown>)) {
      if (!docs || typeof docs !== "object" || Array.isArray(docs)) continue;
      const entries: Partial<Record<SyncKey, LedgerEntry>> = {};
      for (const [key, e] of Object.entries(docs as Record<string, unknown>)) {
        const entry = e as Partial<LedgerEntry> | null;
        if (
          entry &&
          typeof entry.rev === "number" &&
          Number.isFinite(entry.rev) &&
          (entry.pending === null || typeof entry.pending === "string") &&
          typeof entry.updatedAt === "number" &&
          typeof entry.seen === "boolean"
        ) {
          entries[key as SyncKey] = {
            rev: entry.rev,
            pending: entry.pending,
            updatedAt: entry.updatedAt,
            seen: entry.seen,
          };
        }
      }
      out[account] = entries;
    }
    return out;
  } catch {
    return {};
  }
}

function writeLedger(ledger: Ledger): void {
  const ls = storage();
  if (!ls) {
    memoryLedger = ledger;
    return;
  }
  try {
    ls.setItem(LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    // Quota. Keep it for this tab rather than lose it outright.
    memoryLedger = ledger;
  }
}

/** The account this device is signed in to, as the server last reported it,
 *  or null when signed out. Shared by every tab of the profile. */
export function currentAccount(): string | null {
  const ls = storage();
  if (!ls) return memoryAccount;
  try {
    return ls.getItem(ACCOUNT_KEY);
  } catch {
    return memoryAccount;
  }
}

export function setCurrentAccount(account: string | null): void {
  memoryAccount = account;
  const ls = storage();
  if (!ls) return;
  try {
    if (account === null) ls.removeItem(ACCOUNT_KEY);
    else if (ls.getItem(ACCOUNT_KEY) !== account) ls.setItem(ACCOUNT_KEY, account);
  } catch {
    // Blocked storage: the in-memory copy above is what this tab uses.
  }
}

/** Drop everything this device knows about `account`: its revisions, what it
 *  still owed, and whether it has met the account at all. The next reconcile
 *  with that account is first contact. Used by the sync switch (enabled.ts). */
export function forgetAccount(account: string): void {
  const ledger = readLedger();
  if (!(account in ledger)) return;
  delete ledger[account];
  writeLedger(ledger);
}

export function readEntry(account: string, key: SyncKey): LedgerEntry {
  return readLedger()[account]?.[key] ?? EMPTY_ENTRY;
}

export function updateEntry(
  account: string,
  key: SyncKey,
  update: (prev: LedgerEntry) => LedgerEntry,
): LedgerEntry {
  const ledger = readLedger();
  const docs = ledger[account] ?? {};
  const next = update(docs[key] ?? EMPTY_ENTRY);
  ledger[account] = { ...docs, [key]: next };
  writeLedger(ledger);
  return next;
}
