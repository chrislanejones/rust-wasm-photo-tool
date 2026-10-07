# ADR-083: Cloud storage quota is enforced on the server, and the orphan sweep is dry-run first
Date: 2026-10-05   Status: accepted (10-06-2026)   Relates to: ADR-084

## Context

Measured 10-05 on the live deployment (dev `brave-ant-608`): 207 files,
6,914 MiB, against 34 `photo_edits`, 4 `shares`, 1 `ai_jobs` and 4 `users`
rows. #235's dry run found 167 of those files (6,333.7 MiB) referenced by
nothing, all from the edit backup upload (`photoEdits.generateUploadUrl`).
Root cause: `useEditPersistence` races the upload against an 8 s timeout that
rejects without aborting, so the file lands and the client never learns its
id. The pricing page also promised 100 MB / 5 GB, and nothing enforced it.

## Decision

**1. One quota table.** `STORAGE_QUOTA_BYTES` in `convex/entitlement.ts`:
`none` 0, `free` 100 MiB, `paid` 5 GiB (binary units). `app/src/lib/tiers.ts`
imports it, so the pricing matrix and the server cannot disagree. Admins get
their cap through `entitlementOf`.

**2. Enforced where the size is known.** `photoEdits.save` and `shares.create`
read the landed file's size from `_storage` and refuse with a readable
`ConvexError` if the account would end up over its cap (exactly at the cap is
allowed; the file being replaced is credited). The upload-URL mutations only
refuse an account already over. Counted: edit archives and share snapshots.
Not counted: AI job frames (the app cannot delete them) and orphans. Deletes
are never checked.

**3. An orphan is a file no string references.** `storageOrphans.ts` walks
every string at any depth in every row of every schema table, JSON blobs
included, and calls a file an orphan only if nothing matches and it is older
than the grace period (default 24 h, minimum 1 h).

**4. Deleting is opt-in.** `storageSweep:sweep` is a dry run unless called with
`apply: true`. It deletes at most 200 files per run, and deletes nothing
(`refused-incomplete-scan`) if `_storage` or any table has more than 4,000
rows. The cron line in `convex/crons.ts` is written and commented out. It stays
off until a person has read a dry-run report from the live deployment.

## Consequences

+ The advertised caps are real, with one source for the number.
+ About 6.3 GiB can be reclaimed, and the sweep also catches leaks nobody has
  found yet. A field added next month is covered without editing the sweep.
- **The leak is not fixed.** The 8 s timeout is parked, so orphans keep
  arriving until the cron is switched on or the client is fixed.
- A refused save leaves its uploaded file behind (the throw rolls back any
  delete). The sweep is what collects it, so the quota depends on the sweep.
- The 4,000-row cap is a ceiling. Past it the sweep refuses and has to become
  a paginated job. Each quota check also reads up to 2,000 rows per table.
- Accounts already over 100 MiB can still delete but cannot save until they
  are back under.

## Alternatives rejected

1. **Check the size at `generateUploadUrl`.** The size is unknown before
   upload, so the check would only be a guess.
2. **Look for references in a list of known fields.** Faster, but a new
   field holding a storage id would be swept, which means a sweep that loses
   user data.
3. **Schedule the sweep with `apply: true` now.** Unattended deletes of user
   files before anyone has read a report.

## Pre-mortem

It is six months later and this was a mistake. Most likely reason: the cron
was never switched on because nobody ran the dry run, the client timeout stayed
parked, and storage grew past the old 6.9 GB while the quota counted only
committed files, so no account ever hit its cap. The quota went live and the
cost problem it was paired with did not go away.
Early warning sign: `_storage` total bytes climbing while `photo_edits` +
`shares` bytes stay flat, or `crons.ts` still commented out at the next
release.

## Outcome

| Date | What happened |
| --- | --- |
| 2026-10-05 | Shipped in v9.16 (#300). Functions deployed to dev `brave-ant-608` by hand and to prod `pastel-alligator-180` by CI. Every account under its cap at deploy (largest 563.7 MiB on Pro). |
| 2026-10-06 | Chris chose to run the sweep. A fresh dry run matched the first one exactly (167 orphans, 6,333.7 MiB, scan complete, none too young), then `apply: true` deleted **167 files** on dev. After: 40 files, 40 referenced, 0 orphans. |
| 2026-10-07 | **The leak is fixed at its source (Night 10-07, PR 2).** A timed-out upload is now CANCELLED, not abandoned: `lib/withTimeout` takes the upload's `AbortController` and aborts it when the timer fires, so the browser tears the request down before the file can land. The edit backup (`useEditPersistence`), AI uploads (`useAIJob`) and share snapshots (`useShare`, which had no timeout at all) all go through it. A photo switch (`detachCloudUpload`) still does not abort; it only stops waiting. `discardFailedUpload` stays for the other hole (upload done, `save` timed out). **Measured in unit tests, red on master and green after:** an upload stalled past 8 s has its fetch signal `aborted` (master: `false`), and no pointer is written. **Not yet measured live:** the throttled before/after on the test account needs that account signed in, which an unattended run cannot do. Baseline for that run on dev `brave-ant-608`, read 10-07: **40 files, 580.7 MiB**, newest 09-22. Count `_storage`, not the wipe tool's dry run: an orphan has no row, so the dry run cannot see one. |
| Still open | The cron line stays commented out, prod has not been swept, and the live throttled before/after above is owed (attended). |
