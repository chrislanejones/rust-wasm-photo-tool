# Content-addressed GC — does anything still strand?

Measured 2026-08-06. The sweeper was always conditional: build it only if
orphans accumulate. This is the measurement that decides.

## Verdict: the cloud half is clean, the local half is not

| Half | Orphans | Verdict |
|---|---|---|
| Convex `_storage` | **0** of 11 files | clean |
| Local IndexedDB (`__ihContentAudit`) | **376 rows · 252.8 MiB** | **not clean** |

Both numbers are in now. The local measurement landed 2026-08-06 22:46 UTC,
against the deployed origin in a real profile after months of use.

**Orphaned bytes are 51% of everything the app is storing.** That settles the
question this document was opened to answer: the sweeper is not unnecessary.

**A note on units.** `__ihContentAudit` labels its figures "MB" but computes
them in binary units. This document uses **MiB** throughout, so its numbers are
the report's numbers — 265,054,082 bytes is 252.8 MiB, or 265.1 MB if you
prefer decimal. Earlier summaries mixed the two and the difference looked like
a discrepancy. It is not.

## Convex measurement

Deployment `brave-ant-608` (the one production actually talks to; the `prod`
deployment `pastel-alligator-180` reports `inferredSchema: Never` on every
table, i.e. it holds no documents).

| Metric | Value |
|---|---|
| `_storage` files | **11** |
| Total size | 72.1 MB |
| Files referenced | **11** |
| **Orphans** | **0** |
| Orphan bytes | 0 |

Every table was scanned, not just the three named roots:

| Table | Rows | Storage refs | Field |
|---|---|---|---|
| `photo_edits` | 11 | **11** | `storageId` |
| `recent_texts` | 4 | 0 | — |
| `users` | 3 | 0 | — |
| `images`, `layers`, `annotations`, `history`, `projects`, `shares`, `ai_jobs`, `subscriptions` | 0 | 0 | — |

Perfect 1:1 correspondence: 11 files, 11 references, nothing unreferenced.

## What this does and does not prove

It proves the `photo_edits` path — the refcount guard on `handleAutoCompress`
plus the Convex-side delete cascade — is not stranding anything. That is the
path that has actually been exercised, and it is clean. (The *Dexie*-side
cascade is a different story; see cause 3 below.)

It does **not** exercise two cascades, because their tables have never held a
row: `shares` (0 rows) and `ai_jobs` (0 rows). `ai_jobs` is the wider surface —
it carries **three** storage fields (`inputStorageId`, `maskStorageId`,
`outputStorageId`), so it has three ways to strand a file and none of them has
ever run in anger. A zero here is the absence of evidence, not evidence of
absence, and it should be re-measured once AI jobs and shares see real use.

## Local measurement — 2026-08-06 22:46 UTC

Run by Chris via `window.__ihContentAudit()` against the deployed origin in his
own profile. That is the only place this number means anything: the audit reads
real IndexedDB data after real use, so a fresh profile would return a clean zero
that proves nothing. `installContentAudit()` is gated behind
`import.meta.env.DEV || webgpuEnabled()` (`app/src/main.tsx:24`), so a default
production build needs `localStorage.setItem("ih_webgpu", "1")` first.

Roots: **8 live photos**, 16 distinct content keys (8 `originalKey` + 8
`uploadKey`), `manifestFound: true`.

| store | key | rows | reachable | orphans | orphan bytes |
|---|---|---:|---:|---:|---:|
| `image-horse-originals/originals` | content-hash | 72 | 0 | **72** | 93.7 MiB |
| `image-horse-dexie/originals` | content-hash | 189 | 16 | **173** | 111.1 MiB |
| `image-horse-dexie/keyframes` | photo-id | 32 | 0 | **32** | 47.9 MiB |
| `image-horse-dexie/opLogs` | photo-id | 67 | 0 | **67** | 73.4 KiB |
| `image-horse-dexie/oplogManifests` | photo-id | 32 | 0 | **32** | 0 B |
| `image-horse-dexie/workingCopies` | photo-id | 0 | 0 | 0 | 0 B |
| `image-horse-dexie/photos` | photo-id | **0** | 0 | 0 | 0 B |
| `image-horse-edits/edits` | photo-id | 8 | **8** | **0** | 0 B |

| Total | Bytes | MiB |
|---|---:|---:|
| All orphans | 265,054,082 | **252.8** |
| — live stores | 98,269,340 | 93.7 |
| — Dexie layer | 166,784,742 | 159.1 |
| `storageEstimate.usage` | 517,478,676 | 493.5 |

`photosRepointedByCompression: 8`, `photosWithoutUploadKey: 0`.

The edit archives are the one clean store: 8 rows, 8 reachable, zero orphans.
Everything that strands is either a content-addressed original or an op-log row.

## Three causes, three different fixes

They are not one leak, and a single sweeper is the wrong shape for all three.

### 1. The legacy store was never removed — 72 rows, 93.7 MiB

`image-horse-originals` is the pre-Dexie originals database (ADR-001's lazy
read-through migration). **0 of 72 rows are reachable**, which is not a leak
at all — it is the entire old database still resident after everything migrated
out of it.

Verified: `originalsStore.ts:4` is the only module that opens it for writing,
`contentAudit.ts` only reads it to report, and **no code path anywhere deletes
it.** `indexedDB.deleteDatabase` appears in exactly two places in the repo — a
test helper (`upgradeGuard.test.ts:55`) and a *doc comment* in
`GeneralPane.tsx:37` describing a "Clear local data" danger-zone button that
was specified and never implemented. There is no button, and there is no
delete.

**Fix:** a one-time `indexedDB.deleteDatabase("image-horse-originals")` behind
a migration guard, once the Dexie copy is confirmed complete. Not a sweeper —
this store will never gain another row.

### 2. Compression repoints strand the previous blob — 173 rows, 111.1 MiB

All 8 live photos have `originalKey ≠ uploadKey`, so every one has been
repointed by compression at least once.

**Unproven.** 173 orphans against 8 photos is ~21 stranded blobs per photo,
which is a lot of repoints for eight images, and it is not established that
repointing is the only producer here. `discardFailedUpload` (v7.68) and the
`originalRefs` reachable-set guard both close paths in this area, so some of
these may be historical. Do not assert the mechanism without measuring it.

### 3. Nothing deletes op-log rows on photo delete — 131 rows, 47.9 MiB

67 op-log chunks, 32 keyframes and 32 manifests for **8 live photos**, none
reachable.

`deletePhoto` in `db.ts:290` does cascade all of them correctly. It is **never
called by the application** — verified: the only references outside `db.ts`
are two comments and a test. `originalRefs.ts:35` already documents why, and
it is worth quoting because it was written before this measurement existed:

> `db.ts`'s `deletePhoto` does have a refcount, but it counts rows in the Dexie
> `photos` table, which the audit measured as EMPTY in production (the live
> gallery is still the hand-rolled manifest) — a count that is always zero is
> not a guard. That path is also currently called only from tests.

The live delete is `handleRemovePhoto` (`useImageSession.ts:516`), which calls
`deletePhotoEdit` and collects originals through the reachability guard — and
touches none of the three op-log tables. The only live code that deletes an
op-log row is inside the *save* path's rewrite branch
(`oplogPersistence.ts:500`), which clears rows for the photo it is about to
rewrite. That is not a delete-on-removal path.

So the answer to "do these predate the cascade, or do deletes take another
path?" is: **the deletes take another path, and that path has no op-log leg.**
The cascade is correct code that nothing reaches.

**Fix:** give `handleRemovePhoto` an op-log leg, or route it through
`deletePhoto` once the Dexie `photos` table is actually populated. The second
is the larger change and touches the gallery's source of truth.

## If it comes to building the sweeper

The starting point is the parked `cleanupOrphanedStorage.ts` (121 lines, in a
session scratchpad). It already scans all four root tables —
`photo_edits.storageId`, `shares.storageId`, `ai_jobs`'s three fields, and
`images.storageId` — including `images` even though that table is empty, rather
than assuming it stays empty. That is the right instinct: a sweeper that checks
only the tables with rows today deletes files the moment another table gains
one.

## Recommendation

This document was written conditionally: close on **"collect at the source, no
sweeper needed"** *once the local number lands and is also at or near zero.* It
never claimed the local half was clean — it named the condition and waited.

**The condition failed.** 252.8 MiB across 376 rows, 51% of everything stored.
So "no sweeper needed" is off the table, and the three causes above want three
different responses — one deleteDatabase, one unproven, one missing delete leg.

What still holds from the original reasoning: the *cloud* generators are closed
at the source, and the `photo_edits` path is genuinely clean at both ends —
0 Convex orphans and 0 orphaned edit archives locally. The failure is entirely
in originals and op-logs.

### The question this now turns on: backlog, or still growing?

Every named generator was closed at the source in v7.68. If these 252.8 MiB
accumulated *before* those fixes, the answer is a one-time cleanup and no
permanent sweeper. If it is still climbing, the source fixes do not hold and
that is a much bigger finding than the bytes.

**The delta is the whole answer.** Re-run `window.__ihContentAudit()` after a
session of normal editing and compare `totals.allOrphanBytes` against
265,054,082. Nothing else needs measuring first.

Do that before building anything. A sweeper written against a backlog is a
migration; a sweeper written against an active leak is a bandage over a bug
that is still running.

### Still unmeasured

`shares` (0 rows) and `ai_jobs` (0 rows) have never carried data, and `ai_jobs`
has three storage fields. Their zero is the absence of evidence. Re-measure the
cloud half once either sees real use.
