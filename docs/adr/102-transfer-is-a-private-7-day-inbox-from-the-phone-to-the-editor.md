# ADR-102: Transfer is a private, 7-day inbox from a signed-in user's phone to their editor
Date: 2026-11-04   Status: draft (proposed)   Relates to: ADR-083, ADR-089, ADR-101

## Context

Getting a photo from a phone into the editor on a computer means emailing it to
yourself, AirDrop (Apple to Apple only), or a cloud drive. Transfer was decided
on 09-30 and waited for the storage pieces it needs: uploads that abort on
timeout (#318), indexed file references (ADR-089), the per-user stored-bytes
counter (#440) and the rule that every cleanup ships dry-run (ADR-101). All of
those are in as of v9.53.

The phone side must not load the engine: a phone fetches the wasm zero times
(the #288 decision), and Transfer must keep it that way.

## Decision

**1. One direction in v1: phone → computer.** A signed-in phone picks photos
(the system picker, several at once) and uploads each one **as is**. No
processing: the phone has no engine. The computer's editor shows an **Inbox**
with a count badge in the gallery header, listing what is waiting. **Add to
gallery** downloads the file and runs it through the **normal import** (the
same function a drag-and-drop uses, the HEIC Beta included), and only after
that succeeds calls `transfers.receive`, which removes the row and its file. If
the import fails, the photo stays in the inbox with the error. **Delete**
removes it without importing.

**2. A new table, `transfers`** {userId, storageId, name, mime, bytes, width?,
height?, fromDevice, createdAt, expiresAt}, with indexes `by_userId_createdAt`,
`by_storageId` (ADR-089's rule: every storage-id field has its reference
index) and `by_expiresAt`. Functions in `convex/transfers.ts`:
`generateUploadUrl`, `create`, `listMine`, `receive`, `remove`, and internal
`expire`.

**3. The server decides size and type.** `create` takes the storage id and a
file name only. `bytes` is `_storage.size`. `mime` is the content type
`_storage` recorded at upload (the uploading browser's `Content-Type`). Only
when that is missing or `application/octet-stream`, which some Android
browsers send for HEIC, does the name's extension decide (`resolveMime`). A
specific non-image type is refused whatever the name says. A mutation cannot
read the bytes, so there is no magic-byte check. The computer's import
decodes the file anyway.

**4. A refusal returns instead of throwing, and deletes the refused file in
the same transaction.** A throw would roll the delete back and leave an
orphan for the sweep (storageQuota.ts). The phone shows the returned message
beside the file: "Too big: 61.2 MB…", "Storage full: 12 MB left…", "Your
inbox already has 50 photos waiting…". **The exception is a storage id some
row already points at.** That is not a fresh upload, so it is refused with a
throw and the file is **not** deleted, because it belongs to that row,
possibly another account's.

**5. Quota through the counter.** A waiting photo counts against cloud
storage. `storageQuota.storedBytes`, the counter's `recountStoredBytes` and
its `referencesBy` all read `transfers` beside `photo_edits` and `shares`.
`create` and every delete path settle the counter in the same mutation (#440's
pattern). Over quota, the upload is refused with how much is left. **Nothing
ever deletes to make room.** `generateUploadUrl` also refuses an account
already over its cap and a full inbox, so a phone doesn't upload 30 MB just to
be told no.

**6. Every reference check knows the table.** `isStoredFileReferenced`
(failed-upload cleanup, share and transfer deletes), `aiJobFiles`'
`referencedOutside`, the counter, and the test-account wipe (`FILE_FIELDS`,
`WIPE_ORDER`, `deleteTransferRecord`) all read `transfers`. The orphan sweep
already scans every table in the schema. Without this, any cleanup could
delete a photo out of someone's inbox.

**7. Limits.** 50 MB a file, 50 photos in the inbox, image types only: JPEG,
PNG, WebP, AVIF, HEIC/HEIF (and their sequence types), GIF, SVG.

**8. Expiry is 7 days and ships dry-run** (ADR-101's rule).
`transfers.expire` defaults to `apply: false`. Its cron is written and
commented out in `crons.ts` until Chris has read the dry run on dev. An
expired photo still shows in the Inbox until the expiry actually runs: hiding
it would leave bytes counting against the quota that the user cannot see.

**9. Owner only.** Every function takes the user from auth, never from an
argument. `receive` and `remove` on someone else's id throw. Nothing in this
table is served to anyone but its owner. The `fromDevice` label is one of five
known strings ("iPhone", "iPad", "Android phone", "Android tablet", "Phone"),
so a row never stores whatever a client chose to send.

**10. The online switch and sign-in.** The online-features switch is per
device and lives in the browser (`useUIStore.onlineFeaturesEnabled`), so the
server cannot see it. Both sides check it before any call: when it is off,
the phone says "Transfer is off while everything stays in your browser
(Settings › Security)." Logged out, both sides show a sign-in prompt and
nothing else. Demo mode is untouched.

**11. Behind a Beta, `transfer`, on both sides**, until Chris has sent a real
photo.

## v2, not now

- **Computer → phone.** The same table with a direction field, or a second
  inbox. It needs the phone to show and save images, but still not to run the
  engine.
- **The PWA share target** (PARKING_LOT 191), so Android's Share sheet can send
  straight to Image Horse.
- **Gallery-photo trash** (ADR-101's open point). It needs originals that can
  live on the server, which this table is the first case of.
- A magic-byte type check, in an action, if a bad type ever gets past the
  import.

## Consequences

- A waiting photo holds quota for up to 7 days, and longer until the expiry
  cron is switched on.
- `storedBytes` reads one more table. The quota now counts something new, but
  only for accounts that use the new feature.
- `create`'s return value is a union, so the phone must read `ok`, not just
  catch.
- The reference checks now list three file tables plus `ai_jobs`'s six fields.
  The next table with a file has five places to touch: `isStoredFileReferenced`,
  `referencedOutside`, the counter (two functions), and `FILE_FIELDS`.

## Rejected

- **Process on the phone** (resize, convert HEIC). The phone has no engine,
  and loading it would undo #288.
- **Throw on every refusal.** It leaves the refused file behind for the sweep.
- **Trust the client's size or type.** `_storage` knows them.
- **Hide expired rows.** That shows less than the quota counts.
- **Keep the transfer after import.** The point is a hand-off, not a second
  copy. The gallery holds it from then on.

## Pre-mortem

It is six months from now, and Transfer lost someone's photo. The likeliest
way:
- a new cleanup path asks "is this file referenced?" without `transfers`;
- or the computer calls `receive` before the import has really landed in
  IndexedDB.

**Warning signs:**
- a `transfers` file missing while its row exists;
- or a `receive` call in the client that isn't behind the import's success.
