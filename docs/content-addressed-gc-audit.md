# Content-Addressed Store — GC Reachability Audit

The **audit** half of the content-addressed garbage-collection item, and
deliberately only that half. Collecting blobs is a deletion pass over user data
that has no backup and no server copy, so it is not something to design from a
guess or run unattended. This measures what a collector *would* find, so the
collector becomes a bounded decision instead of one.

Tool: `app/src/lib/contentAudit.ts`. Unit tests: `app/src/lib/contentAudit.test.ts`.

## It only reads

Three guarantees, enforced in the code rather than promised in a comment:

1. Every transaction is `"readonly"`. There is no `put` / `delete` / `clear` in
   the module, and it calls no store helper that has one.
2. `indexedDB.open(name)` is called with **no version argument**, so it can
   never trigger an upgrade or a schema change.
3. It only opens databases that `indexedDB.databases()` already reports.
   Opening a name that does not exist **creates** an empty database — a write,
   and a neat way to leave junk behind while "just auditing". Browsers without
   `databases()` (older Safari) get a `null` result and nothing is opened.

It is raw IndexedDB on purpose and imports nothing from `originalsStore` /
`galleryManifest` / `editPersistence` / `dexie`: those modules open with explicit
versions and carry write paths, and an audit that borrows a write path is one
refactor away from being a collector.

### Running it

No UI surface yet — deliberately, because `DiagnosticLogOverlay.tsx` is
mid-change for the Dexie upgrade guard and this had no business touching it.
From the app's own console (dev or a preview build):

```js
const m = await import("/src/lib/contentAudit.ts");   // "/assets/…" in a built bundle
const r = await m.auditContentStores();
console.log(m.formatAuditMarkdown(r));                // the table below
console.log(r);                                       // full report + orphan key samples
```

`formatAuditMarkdown` lives next to the analysis so this document's shape and the
tool cannot drift apart. A Diagnostics Window tab is the natural home once the
Dexie work lands.

## What references what

Read out of the source on 2026-07-28. The root set is the gallery manifest:

| store | key means | reachable when |
| --- | --- | --- |
| `image-horse-gallery` / `manifest` / `"current"` | the root set itself | — |
| `…/originals` (content store) | SHA-256 of the bytes | some live photo's `originalKey` **or** `uploadKey` equals the key |
| `image-horse-edits` / `edits` | `edit-<photoId>` | `<photoId>` is a live photo id |
| `image-horse-dexie` / `opLogs`, `keyframes`, `oplogManifests` | `photoId` (leading segment of the compound key) | `photoId` is a live photo id |

Two reference *kinds*, which matters for any collector design:

- **Originals are content-addressed** and shared. The same bytes imported twice,
  or a duplicated photo, produce one blob with several referrers.
- **Edit archives hold no original key at all** — a `SavedEdit` is canvas PNG +
  undo/redo stacks + annotations, keyed only by photo id. So they are reachable
  by *photo*, and a photo dropped from the manifest strands its whole history.
  This is the class most likely to dominate the byte count, because it is the
  only one storing history rather than a single image.

## Measured run — 2026-07-28

One real profile: 12 photos, imported, never compressed, none deleted.

Root set: 12 live photos · 12 distinct content keys referenced (12 `originalKey`, 12 `uploadKey`)
`navigator.storage.estimate()`: 54.8 MB used of 10.05 GB quota

| store | key | rows | total | reachable | orphans | orphan bytes |
| --- | --- | --- | --- | --- | --- | --- |
| `image-horse-originals/originals` | content-hash | — | — | — | — | _database not present_ |
| `image-horse-edits/edits` | photo-id | 0 | 0 B | 0 | **0** | **0 B** |
| `image-horse-dexie/originals` | content-hash | 12 | 54.1 MB | 12 | **0** | **0 B** |
| `image-horse-dexie/workingCopies` | photo-id | 0 | 0 B | 0 | **0** | **0 B** |
| `image-horse-dexie/photos` | photo-id | 0 | 0 B | 0 | **0** | **0 B** |
| `image-horse-dexie/opLogs` | photo-id | 0 | 0 B | 0 | **0** | **0 B** |
| `image-horse-dexie/keyframes` | photo-id | 0 | 0 B | 0 | **0** | **0 B** |
| `image-horse-dexie/oplogManifests` | photo-id | 0 | 0 B | 0 | **0** | **0 B** |

**Nothing is stranded on this profile: 0 orphaned rows, 0 B.**

That zero is a measurement, not an absence of evidence. The reachability rule is
unit-tested against synthetic stores (17 tests) precisely because a detector that
reports zero *because it is broken* looks identical to a clean store: with an
empty root set the same code classifies all 12 originals as orphans, an
`edit-<deleted-photo>` row is caught as stranded, and orphaned op-log chunks are
found through their compound key.

Byte figures are a **floor**: `ArrayBuffer.byteLength` and `Blob.size` are summed
off the real records, and JSON / structured-clone overhead for the non-binary
fields is not counted. The `storage.estimate()` line is an independent
cross-check — 54.8 MB against 54.1 MB of measured blobs, so essentially all
usage is image bytes.

### Two things the run itself turned up

- **The legacy `image-horse-originals` database does not exist on this profile.**
  The originals live in `image-horse-dexie/originals`, so `USE_DEXIE_ORIGINALS`
  is on and Dexie is the real store for originals. `db.ts`'s header still
  describes itself as "a NEW, parallel database" that "does NOT touch the three
  live hand-rolled stores" — accurate when written, now stale for originals
  (`photos` and `workingCopies` are genuinely still empty, and the live gallery
  list is still the hand-rolled manifest). Worth correcting when someone is next
  in that file.
- **`image-horse-zustand` is present and not audited.** It is the persist
  adapter's preferences store, not content, so it has no reachability question —
  noted so its absence from the table isn't read as an oversight.

## The two named orphan sources, checked

### 1. Auto Compress repoints `originalKey` without collecting — CONFIRMED, but narrower than parked

The parked note says compression "repoints `originalKey` on every run without
collecting the previous blob". Of the four repoint sites, **three do collect**:

| site | collects? |
| --- | --- |
| `AppShell.persistActiveCanvas` (Apply Compression & Resize, Canvas Size) | **yes** — `deleteOriginal(oldKey)` guarded by `oldKey !== newKey && oldKey !== entry.uploadKey` |
| `BatchSettings` bulk-logo | **yes** — same shape, guarded against `baselineKey` |
| `BatchSettings` bulk-text | **yes** — same shape |
| `AppShell.handleAutoCompress` per-photo callback | **NO** — `putOriginal(nf, …)` then repoints the entry, with no `deleteOriginal` anywhere in the path |

So the leak is real and it is specifically **Auto Compress** (`scope: "selected"
| "all"`, the "make it web-ready" batch). Every run over a photo whose
`originalKey` has already moved off its `uploadKey` strands one blob, and running
it repeatedly strands one per run — the "measurable pile" the note predicted,
just from one site rather than all of them. The pile is 0 B on this profile only
because Auto Compress has never run here (`photosRepointedByCompression: 0`).

### 2. Deleted photos leave their originals behind — CONFIRMED

`useImageSession.handleRemovePhoto` calls `deletePhotoEdit(id)` and drops the
entry from `photos`, and never touches the content store. Neither the
`originalKey` blob nor the `uploadKey` blob is collected, so deleting a photo
strands up to two originals — on this gallery, ~4.5 MB per photo on average.
The edit archive *is* deleted, which is why the `edits` store shows 0 orphans
even though photos have come and gone here.

### 3. Not asked for, and more serious: `deleteOriginal` is not refcounted

The inverse failure, found while checking the above. `originalsAdapter.deleteOriginal`
is an unconditional `db.originals.delete(key)` — compare `db.ts:285`, which
guards the same operation with `if (refs === 0)`. Originals are content-addressed
and therefore **shared**, and `handleDuplicateSelected` deliberately shares them
("the copies reuse the same `originalKey`/`thumbBlob` — zero pixel copy").

The `oldKey !== entry.uploadKey` guard on the collecting paths protects *that
photo's own* baseline. It does not know about other photos. So:

1. Import photo **P** → `originalKey = K`, `uploadKey = K`.
2. Apply Compression on P → new blob **N**. Guard holds (`K === uploadKey`), so
   K survives. P is now `originalKey = N`, `uploadKey = K`.
3. Duplicate P → copy **C** shares `originalKey = N` and `uploadKey = K`.
4. Apply Compression on C → `oldKey = N`, and `N !== C.uploadKey (K)`, so
   `deleteOriginal(N)` runs. **P's current original is deleted while P still
   points at it.**

That is data loss, not garbage: P's bytes are gone and its entry still references
them. Reached by reading the four paths, not by running it on a real gallery —
deliberately, since reproducing it destroys an original. It needs its own session
with fixtures.

**This is the reason a collector must not be bolted on next.** A mark-and-sweep
over the manifest would be safe here, but the existing eager deletes are already
unsafe for shared keys, and adding a sweep on top of them fixes the leak while
leaving the sharp edge in place.

## What this makes decidable

- **Refcount or sweep?** The audit already computes the mark phase (roots →
  reachable set), so a sweep is a small step from here. Refcounting would have to
  be retrofitted onto four write sites and would need a repair path for counts
  that have already drifted; the reachable-set walk needs no stored state and
  cannot drift.
- **Fix the eager deletes first.** Whatever the collector is, the four existing
  `deleteOriginal` calls should stop deleting shared blobs — either refcount them
  or drop them entirely and let the sweep do all collection. The second is
  simpler and turns finding 3 from a data-loss bug into a bounded amount of
  garbage.
- **Decide what `uploadKey` is worth.** It exists so A/B compare can show the
  untouched import, and it doubles the storage of every compressed photo. That is
  a product call, not a GC one, but a collector has to know whether it is a root.
- **Photo delete needs the same treatment.** Once collection exists, deletion can
  simply drop the entry; until it does, `handleRemovePhoto` is stranding pairs of
  originals every time.
- **Op-log and keyframe GC ride along.** Both are keyed by photo id and both are
  already audited by the same reachability rule, which covers the parked
  "keyframe GC" item without a second mechanism.

## Re-run it when

- After a batch of Auto Compress runs, to put a real number on the pile.
- After deleting photos, to confirm the strand rate above.
- Before designing the collector, on a profile that has been used for real work
  — this one is clean, which is a fine baseline but a poor stress case.
