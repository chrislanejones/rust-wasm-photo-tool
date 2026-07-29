// Verification for the upgrade-deadlock guard in db.ts.
//
// WHY THIS FILE EXISTS: the guard was written and then sat uncommitted with no
// gate run against it, and an unverified deadlock guard is worse than none —
// because it is believed. The failure it claims to prevent (a stale tab blocks
// a schema upgrade, `db.open()` never settles, every IndexedDB call hangs
// forever including the local save that deliberately has no timeout) cannot be
// checked by reading. Either the events fire and the handlers run, or they do
// not.
//
// It drives the REAL `db` singleton from db.ts, so the handlers under test are
// the ones the app actually registers — not a replica constructed here that
// could agree with a wrong assumption about how Dexie binds them.
//
// The version bump is supplied by the TEST rather than by editing db.ts. A
// fabricated `.version(3)` in the source would be a real schema change under
// the `dexie-migration` skill and must not be committed to make a test pass;
// opening the same database name at a higher version from raw IndexedDB
// produces the identical upgrade pressure, which is the thing being exercised.
//
// ⚠️ DEXIE MULTIPLIES ITS VERSION BY TEN. `this.version(2)` in db.ts is
// IndexedDB version **20**, not 2 — found the hard way here, when raw opens at
// 3 and 4 failed with VersionError for being LOWER than the live database. So
// a fabricated "version 3" is IDB 30, and the stale-tab fixture below has to
// build IDB 10 (Dexie v1) by hand. Anything reasoning about these numbers from
// outside Dexie has to know this.
//
// Harness: node + fake-indexeddb (vitest.setup.ts), same as the adapter tests.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/dexie/db";
import { clearDiagnostics, getDiagnostics } from "@/lib/diagnosticsLog";

const DB_NAME = "image-horse-dexie";
/** db.ts declares `.version(2)`; Dexie stores that as IDB version 20. */
const DEXIE_V2_AS_IDB = 20;
/** What a future `.version(3)` release would open as. */
const FABRICATED_V3_AS_IDB = 30;

function rawOpen(
  version: number,
  opts: { onBlocked?: () => void; onUpgrade?: (db: IDBDatabase) => void } = {},
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, version);
    req.onupgradeneeded = () => opts.onUpgrade?.(req.result);
    req.onblocked = () => opts.onBlocked?.();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve) => {
    const del = indexedDB.deleteDatabase(DB_NAME);
    del.onsuccess = () => resolve();
    del.onerror = () => resolve();
    del.onblocked = () => resolve();
  });
}

/** Let queued IndexedDB events run — fake-indexeddb dispatches on its own
 *  schedule, so awaiting the opening promise alone is not enough. */
const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms));

function indexedDbLogs(): string {
  return getDiagnostics()
    .filter((e) => e.source === "INDEXEDDB")
    .map((e) => e.message)
    .join(" ");
}

/** A stale tab from the previous release: a database at Dexie v1 (IDB 10) built
 *  by hand, held open, with NO versionchange listener — the exact case `blocked`
 *  exists for. Schema mirrors db.ts's `.version(1).stores({...})` so Dexie's own
 *  v1 → v2 upgrade is what runs against it. */
function openStaleV1Tab(): Promise<IDBDatabase> {
  return rawOpen(10, {
    onUpgrade: (raw) => {
      const originals = raw.createObjectStore("originals", { keyPath: "id" });
      void originals;
      const working = raw.createObjectStore("workingCopies", { keyPath: "id" });
      working.createIndex("photoId", "photoId");
      const photos = raw.createObjectStore("photos", { keyPath: "id" });
      photos.createIndex("updatedAt", "updatedAt");
      photos.createIndex("originalId", "originalId");
    },
  });
}

beforeEach(async () => {
  if (db.isOpen()) db.close();
  await deleteDatabase();
  clearDiagnostics();
});

afterEach(async () => {
  if (db.isOpen()) db.close();
  await deleteDatabase();
});

describe("versionchange — the half that actually prevents the deadlock", () => {
  it("closes this connection when another tab opens a higher version, and lets that upgrade through", async () => {
    await db.open();
    expect(db.isOpen()).toBe(true);

    // Another tab ships a schema bump. Without the guard this open would sit in
    // `blocked`, because the connection above is still holding v2 — and the new
    // tab's db.open() would never settle.
    let sawBlocked = false;
    const upgraded = await rawOpen(FABRICATED_V3_AS_IDB, {
      onBlocked: () => (sawBlocked = true),
    });
    await settle();

    // The upgrade completed rather than hanging: no deadlock.
    expect(upgraded.version).toBe(FABRICATED_V3_AS_IDB);
    // And it completed because THIS connection got out of the way.
    expect(db.isOpen()).toBe(false);
    expect(sawBlocked).toBe(false);

    // Visible, not silent — and the message names an action.
    expect(indexedDbLogs()).toMatch(/another tab is upgrading/i);
    expect(indexedDbLogs()).toMatch(/reload this tab/i);

    upgraded.close();
  });

  it("without the guard the same upgrade IS blocked — proving the fixture is real", async () => {
    // A connection that ignores versionchange, holding the current version.
    const stubborn = await rawOpen(DEXIE_V2_AS_IDB);
    clearDiagnostics();

    let sawBlocked = false;
    const opening = rawOpen(FABRICATED_V3_AS_IDB, { onBlocked: () => (sawBlocked = true) });
    await settle();

    // This is what the guard prevents: the upgrade is stuck behind a live
    // connection, and nothing in the logs, because this connection is not ours.
    expect(sawBlocked).toBe(true);
    expect(indexedDbLogs()).toBe("");

    stubborn.close();
    const upgraded = await opening;
    expect(upgraded.version).toBe(FABRICATED_V3_AS_IDB);
    upgraded.close();
  });
});

describe("blocked — the half that can only make it visible", () => {
  it("fires and logs when a stale tab holds the old version open", async () => {
    const stale = await openStaleV1Tab();
    // Deliberately no `stale.onversionchange` handler: this tab is from a build
    // that predates the guard, which is precisely the case being tested.
    clearDiagnostics();

    // Dexie wants v2 (IDB 20); the v1 connection above is in the way.
    const opening = db.open();
    await settle(150);

    expect(indexedDbLogs()).toMatch(/blocked by another open tab/i);
    expect(indexedDbLogs()).toMatch(/close other image horse tabs/i);

    // Releasing the stale connection lets the upgrade finish — the block is a
    // wait, not a failure, which is why surfacing it is the whole remedy.
    stale.close();
    await expect(opening).resolves.toBeDefined();
    expect(db.isOpen()).toBe(true);
  });

  it("the message tells the user which action clears it", async () => {
    const stale = await openStaleV1Tab();
    clearDiagnostics();
    const opening = db.open();
    await settle(150);
    expect(indexedDbLogs()).toMatch(/close other/i);
    stale.close();
    await opening.catch(() => {});
  });
});
