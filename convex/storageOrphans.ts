// Which stored files does nothing point at? Pure, and imports nothing.
//
// WHY THIS EXISTS. Every upload in this app is two steps: the browser POSTs the
// bytes to a Convex upload URL, THEN a mutation writes the storage id into a
// row. Anything that stops the second step — a tab closed mid-save, a network
// drop, a client timeout that gives up while the upload carries on in the
// background — leaves a file in `_storage` that no row references and that no
// code path will ever reach again. `photoEdits.discardFailedUpload` collects
// some of them, but it is called by the client, so it cannot run when the
// client is the thing that died. Measured 09-24-2026 on the live backend: 167
// of 207 files, 6,334 MiB, all of them edit archives.
//
// This module is the half of the server-side sweep that decides; the half that
// reads the database and (only when told to) deletes is `storageSweep.ts`.
// Keeping the decision pure is what lets the tests prove it without a Convex
// backend.
//
// HOW A REFERENCE IS FOUND. Not from a list of known fields. Every string, at
// any depth, in every row of every table is checked, including storage ids
// embedded inside a JSON string (`sync_docs.value`, `users.settings`). That is
// the same walk the 09-24 measurement used, and it has one property a field
// list cannot have: a table or field added next month that holds a storage id
// is covered without anyone remembering to update the sweep. A sweep that
// deletes user data must fail toward keeping a file, never toward losing one.

/** One row of the `_storage` system table, as much of it as the sweep reads. */
export interface StoredFile {
  _id: string;
  _creationTime: number;
  size: number;
  contentType?: string;
}

/** Convex document ids are lowercase base32. A run of 25–40 such characters is
 *  a CANDIDATE — the answer is decided by membership in the real id set, so a
 *  false candidate costs one Set lookup and can never mark anything. */
const ID_TOKEN = /[0-9a-z]{25,40}/g;

/**
 * Add every storage id that appears anywhere inside `value` to `found`.
 *
 * `known` is the set of ids that actually exist in `_storage`: a string only
 * counts as a reference when it IS one of them (exactly), or when it CONTAINS
 * one as a whole token (a JSON blob, a URL). Walks objects and arrays to any
 * depth; numbers, booleans and null carry no reference.
 */
export function collectStorageRefs(value: unknown, known: ReadonlySet<string>, found: Set<string>): void {
  if (typeof value === "string") {
    if (known.has(value)) {
      found.add(value);
      return;
    }
    if (value.length > 40) {
      for (const token of value.match(ID_TOKEN) ?? []) {
        if (known.has(token)) found.add(token);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStorageRefs(item, known, found);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStorageRefs(item, known, found);
    }
  }
}

export interface OrphanVerdict {
  /** Unreferenced AND older than the grace period: what a sweep may delete. */
  orphans: StoredFile[];
  /** Unreferenced but younger than the grace period. Very likely an upload
   *  whose pointer is about to be written — left alone, reported for context. */
  tooYoung: StoredFile[];
  /** Referenced by at least one row. Never touched. */
  referenced: number;
}

/**
 * Split stored files into orphans, too-young-to-judge, and referenced.
 *
 * THE GRACE PERIOD IS LOAD-BEARING. Between an upload landing and the
 * mutation that points at it there is a window — seconds normally, longer on a
 * slow line — in which a perfectly healthy file is unreferenced. A sweep that
 * ran inside that window would delete the file and then let `save` write a
 * pointer to nothing. `minAgeMs` must be far longer than any upload→commit gap.
 */
export function classifyStorage(
  files: readonly StoredFile[],
  referencedIds: ReadonlySet<string>,
  now: number,
  minAgeMs: number,
): OrphanVerdict {
  const orphans: StoredFile[] = [];
  const tooYoung: StoredFile[] = [];
  let referenced = 0;
  for (const f of files) {
    if (referencedIds.has(f._id)) {
      referenced += 1;
    } else if (now - f._creationTime >= minAgeMs) {
      orphans.push(f);
    } else {
      tooYoung.push(f);
    }
  }
  return { orphans, tooYoung, referenced };
}

/**
 * The whole decision the sweep makes, in one call: which of `files` does no
 * row in `rows` reference, and which of those are old enough to delete.
 * `rows` is every row of every table, in any grouping.
 */
export function findOrphans(
  files: readonly StoredFile[],
  rows: Iterable<unknown>,
  now: number,
  minAgeMs: number,
): OrphanVerdict {
  const known = new Set(files.map((f) => f._id));
  const referenced = new Set<string>();
  for (const row of rows) collectStorageRefs(row, known, referenced);
  return classifyStorage(files, referenced, now, minAgeMs);
}

export interface WeekTotal {
  /** Monday of the week, UTC, `YYYY-MM-DD`. */
  weekOf: string;
  files: number;
  bytes: number;
}

/** Orphan totals per ISO week (weeks start Monday, UTC), oldest first. */
export function totalsByWeek(files: readonly StoredFile[]): WeekTotal[] {
  const DAY = 86_400_000;
  const weeks = new Map<string, WeekTotal>();
  for (const f of files) {
    const dayStart = Math.floor(f._creationTime / DAY) * DAY;
    // getUTCDay: 0 = Sunday. Monday-based offset: Sunday is 6 days after Monday.
    const offset = (new Date(dayStart).getUTCDay() + 6) % 7;
    const weekOf = new Date(dayStart - offset * DAY).toISOString().slice(0, 10);
    const w = weeks.get(weekOf) ?? { weekOf, files: 0, bytes: 0 };
    w.files += 1;
    w.bytes += f.size;
    weeks.set(weekOf, w);
  }
  return [...weeks.values()].sort((a, b) => a.weekOf.localeCompare(b.weekOf));
}
