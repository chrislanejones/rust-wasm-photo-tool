# db-snapshot — legacy IndexedDB fixtures

Fixture support for the `image-horse-originals` legacy store, used to prove the
Dexie read-through migration (`app/src/lib/dexie/originalsAdapter.ts`) against
realistic pre-migration data. Required by the `dexie-migration` skill: *"seed a
DB at the previous shipped version with realistic data, then confirm the upgrade
path."* Here the "upgrade path" is lazy read-through, so the fixture seeds the
**legacy** store and we assert every original reads back through the adapter.

## Two fixtures, one shape

- **Automated (headless):**
  `app/src/lib/dexie/__fixtures__/legacyOriginals.ts` — the canonical fixture as
  a typed module. `seedLegacyOriginals()` writes it into the legacy store via the
  real `originalsStore.putOriginal`, so the bytes/keys are produced exactly as a
  user's gallery would produce them. Consumed by
  `app/src/lib/dexie/legacyFixture.test.ts` (vitest + fake-indexeddb).
- **Manual (browser QC):** a real gallery snapshot. IndexedDB cannot be captured
  headlessly — it lives in the browser — so the manual capture/restore procedure
  is below. Keep it in sync with the typed fixture when the record shape changes.

## Capture a real legacy snapshot (browser)

Run in the app's DevTools console with a populated gallery, BEFORE upgrading:

```js
// Dump every legacy original to a JSON file (base64 bytes).
const req = indexedDB.open("image-horse-originals");
req.onsuccess = async () => {
  const db = req.result;
  const tx = db.transaction("originals", "readonly");
  const store = tx.objectStore("originals");
  const keys = await new Promise((res) => (store.getAllKeys().onsuccess = (e) => res(e.target.result)));
  const out = {};
  for (const k of keys) {
    const rec = await new Promise((res) => (store.get(k).onsuccess = (e) => res(e.target.result)));
    out[k] = {
      name: rec.name, mimeType: rec.mimeType, width: rec.width, height: rec.height,
      bytesB64: btoa(String.fromCharCode(...new Uint8Array(rec.bytes))),
    };
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "legacy-originals-snapshot.json";
  a.click();
};
```

## Restore a snapshot into a test browser profile

Paste the same JSON back with `store.put(payload, key)` (reverse of the capture,
`atob` → `Uint8Array` → `ArrayBuffer`). Use this to reproduce a specific user's
gallery for `imagehorse-qc` before a release that touches persistence.

## Verification checklist (dexie-migration skill gate)

- [ ] Automated: `pnpm exec vitest run` — `legacyFixture.test.ts` green
      (every fixture original reads back through the adapter; legacy untouched).
- [ ] Manual (pre-release QC, NOT headless): capture a real gallery, boot the
      build, confirm every photo opens and edits via the adapter, then confirm
      the legacy DB is byte-identical (same keys, same bytes) afterwards.
- [ ] `imagehorse-qc` flagged before the next release (persistence touched).
