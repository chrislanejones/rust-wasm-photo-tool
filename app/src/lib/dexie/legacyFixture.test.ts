// Task C — legacy fixture round-trip. Seed the legacy raw-IndexedDB originals
// store to look like a real pre-migration gallery, then prove the app reads
// EVERY photo back through the Dexie adapter (read-through), and that each read
// lazily backfills Dexie without ever mutating the legacy store.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/dexie/db";
import {
  getOriginal as legacyGetOriginal,
  deleteOriginal as legacyDeleteOriginal,
  listOriginalKeys as legacyListKeys,
} from "@/lib/originalsStore";
import { getOriginal, listOriginals } from "@/lib/dexie/originalsAdapter";
import {
  LEGACY_ORIGINALS_FIXTURE,
  seedLegacyOriginals,
  decodeContent,
} from "@/lib/dexie/__fixtures__/legacyOriginals";

beforeEach(async () => {
  await db.originals.clear();
  for (const k of await legacyListKeys()) await legacyDeleteOriginal(k);
});

afterEach(async () => {
  await db.originals.clear();
});

describe("legacy fixture → adapter read-through", () => {
  it("reads every fixture photo through the adapter and backfills Dexie", async () => {
    const keys = await seedLegacyOriginals();
    expect(keys).toHaveLength(LEGACY_ORIGINALS_FIXTURE.length);
    // Nothing in Dexie yet — the fixture only touched the legacy store.
    expect(await db.originals.count()).toBe(0);

    // Read each one through the adapter; every record comes back intact.
    for (let i = 0; i < keys.length; i++) {
      const rec = await getOriginal(keys[i]);
      expect(rec).not.toBeNull();
      expect(decodeContent(rec!)).toBe(LEGACY_ORIGINALS_FIXTURE[i].content);
      expect(rec!.name).toBe(LEGACY_ORIGINALS_FIXTURE[i].name);
      expect(rec!.mimeType).toBe(LEGACY_ORIGINALS_FIXTURE[i].mimeType);
      expect(rec!.width).toBe(LEGACY_ORIGINALS_FIXTURE[i].width);
    }

    // Read-through backfilled all of them into Dexie…
    expect(await db.originals.count()).toBe(keys.length);
    // …and the legacy store is untouched (still holds every original).
    expect((await legacyListKeys()).sort()).toEqual([...keys].sort());
    for (const k of keys) expect(await legacyGetOriginal(k)).not.toBeNull();

    // The union listing sees the full gallery, deduped.
    const listed = await listOriginals();
    expect(listed.sort()).toEqual([...keys].sort());
  });
});
