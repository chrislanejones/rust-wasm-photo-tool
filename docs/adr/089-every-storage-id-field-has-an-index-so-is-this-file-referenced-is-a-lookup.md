# ADR-089: Every storage-id field has an index, so "is this file referenced?" is a lookup
Date: 2026-10-14   Status: accepted (v9.32, 2026-10-18)   Relates to: ADR-083

## Context

`photoEdits.discardFailedUpload` deletes a file only if no row references it,
and it decided that from the first 2,000 rows of `photo_edits`, `shares` and
`ai_jobs`. Its own comment rejected an index as "a schema change carried
forever for a rare call". A file referenced by row 2,001 read as unreferenced
and was deleted under a live record (5 regression tests, one per field, seed
2,000 filler rows and go red on the old scan). Dev today: 34 / 4 / 2 rows, so
nobody has lost a file yet. The bug grows with the table, not with any one user.

## Decision

Five additive indexes, one per field that can hold a storage id:
`photo_edits.by_storageId`, `shares.by_storageId`, `ai_jobs.by_inputStorageId`,
`ai_jobs.by_outputStorageId`, `ai_jobs.by_maskStorageId`. `discardFailedUpload`
does one `.first()` lookup per index, in the same transaction as the delete.
A new storage-id field must get its own index and its own lookup, or the
cleanup will delete what it points at.

## Consequences

+ The answer no longer depends on table size; 5 index reads replace up to 6,000 row reads.
+ No data migration: Convex backfills the indexes on push. Merge deploys prod; dev `brave-ant-608` (the live app's backend) needs a manual `convex dev --once`.
- Every insert or patch on these three tables writes up to five more index entries, forever, to serve a failure path.
- The "every storage-id field" list is enforced by convention and one test table (`REFERENCES` in `convex/photoEdits.test.ts`), not by the type system.

## Alternatives rejected

- Raise the scan cap: moves the cliff, and a full scan hits Convex's per-transaction read limit long before it stops being wrong.
- Never delete in the client path, leave it all to `storageSweep`: the sweep is dry-run with its cron commented out (ADR-083), so failed uploads would pile up indefinitely.

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: someone
added a sixth storage-id field (a generate job's reference images are the
obvious candidate; today they are never written to a row) without an index,
`discardFailedUpload` did not know about it, and it deleted a referenced file
exactly as before. The indexes were right; the list was the weak point.
Early warning sign to watch for: `grep -c 'v.id("_storage")' convex/schema.ts`
differs from the number of lookups in `discardFailedUpload` (today 5 = 5).


### Reference-input follow-up (v9.32, 2026-10-18)

#381 adds three scalar reference slots and an equality index for each. The
shared `isStoredFileReferenced` helper now supplies all eight lookups to failed
upload cleanup and terminal-job reference cleanup. Completion/failure clears
reference ownership and checks remaining owners in the same transaction. It
preserves the newly attached output even when that output shares a reference ID.
Provider cancellation and timeout failures use the same terminal path; a local
browser timeout does not establish that the provider has stopped reading inputs.
