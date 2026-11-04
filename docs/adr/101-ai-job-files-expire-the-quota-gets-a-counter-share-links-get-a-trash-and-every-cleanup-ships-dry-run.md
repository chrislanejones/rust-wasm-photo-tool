# ADR-101: AI job files expire, the quota gets a counter, share links get a trash, and every cleanup ships dry-run
Date: 2026-11-03   Status: draft (proposed)   Relates to: ADR-083, ADR-089

## Context

Three retention holes are left after ADR-083. Every `ai_jobs` row keeps its
frames (input, mask, output) forever, and nothing deletes them. The quota
reads at most 2,000 rows per table per user (`storageQuota.storedBytes`), so
row 2,001 counts as 0 and the quota fails OPEN. The biggest real account has
about 32 rows, so this is a correctness fix, not an urgent one. And a deleted
share link is gone at once, while ADR-083 / UI Night 6 promised a trash (free
7 days, paid 30, counts against the quota, being over the quota refuses
uploads and never deletes to make room).

## Decision

**1. AI job files expire after 7 days (PR 1, `convex/aiJobFiles.ts`).**
`aiJobFiles.expire` (internal) clears the storage-id fields of jobs that
finished (`done` or `failed`; failed covers cancelled and timed out) more than
7 days ago, and deletes those files. **The row stays.** Type, status,
timestamps and error are the usage history, and the AI caps read counters on
`users`. Every row it visits gets `filesExpiredAt`, so the new index
`by_status_filesExpiredAt_completedAt` drops it and a rerun reads nothing it
already did. A file is kept if another row references it: one index lookup
per storage-id field (ADR-089), the same lookups as `discardFailedUpload`.
References from jobs in the same batch don't count, because they are cleared
in the same transaction. Otherwise two expiring jobs on one frame would
protect each other and the dry run would disagree with the apply. 200 jobs per
status per run, returns `more`. The app only reads a job's output right after
it finishes (`useAIJob`, `useImageGeneration`).

**2. A per-user counter for the quota (PR 2).** New table `storage_usage`
{userId, bytes, updatedAt}, adjusted in the same mutation by every path that
adds or removes a file reference on `photo_edits` or `shares`: save insert and
replace (a same-file save moves it by 0), remove, clearAll,
`shares.create`/`remove`, and the test-account wipe through the shared delete
helpers. It counts exactly what the quota counts today: distinct files
referenced by the user's `photo_edits` + `shares` rows. **AI files stay out**,
as in ADR-083. They now expire on their own, and the narrow step must change
nothing a user sees. A missing counter row is created on first adjustment by
an exact, uncapped recount of that user. Rollout is **widen, migrate,
narrow**. Widen (this night): the counter is kept current, the quota still
reads `storedBytes()`. Migrate (this night, code only): internal
`backfillStoredBytes`, paged over users, dry run reports mismatches, Chris runs
it attended on dev, then prod. Narrow (later PR): the quota reads the counter,
and a check compares the two.

**3. The trash holds share links only (PR 3).** `shares` gains an optional
`deletedAt`. A NEW `shares.moveToTrash` sets it, and `shares.remove` stays
immediate. Trashed links stop serving (public `get` returns `null`, exactly like a deleted link) and
leave `listMine`. Restore clears `deletedAt`. Delete now and Empty trash
remove the row and its file through the reference check. Internal
`trash.purge` removes rows past the owner's tier window. `TrashView` (UI
Night 6, unwired) is wired for signed-in users behind Beta `trash`, and
logged-out users see no Trash. Cloud edit backups keep deleting immediately:
one is only deleted when its photo is deleted in the browser
(`useEditPersistence`), and a restored backup would have no gallery photo to
attach to. Bringing the photo back needs the original on the server, which is
Transfer's / sync's job (plan items 89, 192). **Open follow-up, not built:** a
server trash for browser-deleted gallery photos.

**4. The rule.** Every server cleanup that deletes user files ships as a dry
run by default with its cron commented out, and a person switches it on after
reading a dry run against the deployment. Today that covers the orphan sweep,
AI expiry and the trash purge. `backfillStoredBytes` also defaults to a dry
run.

## Consequences

+ AI frames stop piling up, and the usage history stays.
+ The quota stops failing open past 2,000 rows, and the narrow step needs no
  visible change.
+ A deleted share link can be restored for 7 or 30 days, and users without the
  Beta see no change.
- **Nothing is deleted until a person acts.** ADR-083's sweep cron is still
  commented out a month later, and this adds two more crons that wait on the
  same person.
- Every new path that writes a file reference must also adjust the counter.
  Until the narrow-step check exists, drift is silent. A single user's recount
  is one transaction, so an account with many thousands of files would need a
  paginated recount.
- Shares get two delete paths (`remove`, `moveToTrash`) until the Beta
  graduates. Trashed links take storage and quota for up to 30 days. Gallery
  photos get no server trash.
- An AI job older than 7 days has no frame left, so it can't be looked at
  when debugging one.

## Alternatives rejected

- Count AI files in the quota: ADR-083 left them out because the user cannot
  delete them, and counting them would change what the quota refuses.
- A `bytes` field on `users`: tonight's plan forbids touching `users` rows,
  and the guidelines keep high-churn data apart from profile rows.
- Trash inside `shares.remove`: changes behavior for everyone before the Beta
  has been tried.
- A server trash for gallery photos: deferred to Transfer / sync (above).

## Pre-mortem
It is six months later and this was a mistake. Most likely reason: a later
write path (Transfer or sync is the obvious one) inserted `photo_edits` rows
without adjusting `storage_usage`, after the narrow step had moved the quota
onto the counter. Accounts drifted in both directions. Some were refused
uploads they had room for, others went past their cap. The 2,000-row cap had
been wrong but bounded; the counter was wrong and unbounded.
Early warning sign to watch for: a `backfillStoredBytes` dry run reporting
any nonzero mismatch, or a `ctx.db.insert("photo_edits"` / `("shares"`
outside the helpers that adjust the counter.
