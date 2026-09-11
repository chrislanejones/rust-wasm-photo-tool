# Data synchronization — the plan

**Status: 📋 PLAN, nothing built.** Written 2026-09-11 against v8.74.

The ask, stated as the test this design has to pass:

```
8:30  thinkpad-iza764 · Win11 · Chrome   · signed in as Chris · shows three photos
8:30  thinkpad-iza764 · Win11 · Firefox  · signed in as Chris · shows three photos
8:30  Android pixel-5 · Chrome           · signed in as Chris · shows three photos

8:31  Android pixel-5 · Chrome           · signed in as Chris · adds a photo

8:32  thinkpad-iza764 · Win11 · Chrome   · signed in as Chris · shows four photos
```

Google Keep is the right reference. Not because of what it stores, but because
of four rules it follows, and this document is largely an argument for adopting
all four:

1. The **list** is a reactive query, not a file. The server pushes; clients
   never poll.
2. The **body** and its **attachments** are separate transfers on separate
   schedules. Text lands instantly, the photo lands when it lands.
3. **Deletes are tombstones.** An absent row never means "deleted".
4. **More than one device open at once is the normal case**, not an error to be
   locked out.

---

## 1. What actually happens today

The scenario above does not partially work. It fails at 8:30, on the second
line, before anything is added.

| Time | What the code does | File |
|---|---|---|
| 8:30 Chrome | Gallery rebuilds from `image-horse-gallery`, one IndexedDB blob under the key `current` | `lib/galleryManifest.ts:11` |
| 8:30 Firefox | **Shows zero photos.** Different browser, different IndexedDB. Signing in changes nothing — no query exists that lists an account's photos | — |
| 8:30 Pixel | Shows zero photos, same reason | — |
| 8:31 Pixel adds | Bytes → `image-horse-originals` (local), row → the local manifest blob. Nothing leaves the device | `lib/originalsStore.ts`, `app/AppShell.tsx:1234` |
| 8:32 ThinkPad | Unchanged. Four never happens | — |

**The gallery is per-browser-profile, not per-account.** Three browsers are
three galleries. That is the whole finding.

What *does* cross devices today is narrower than it looks:

- **Preferences.** `users.settings` + `settingsHash`, pulled by a reactive
  `useQuery(api.users.me)` and pushed on `apply` with a hash-skip
  (`lib/preferences.ts:308-360`). Change the theme on the Pixel and the
  ThinkPad follows, live, no reload. **The mechanism this whole document wants
  already runs in production — for exactly one thing, and the gallery was never
  wired to it.**
- **Edit archives, one-way and blind.** `savePhotoEdit` uploads a per-photo
  archive to `photo_edits` keyed `(userId, photoKey)`
  (`hooks/useEditPersistence.ts:325`). But `loadPhotoEdit` is only ever called
  for a `photoId` the local gallery *already lists*, and the list is local. So
  the archives are up there, under ids no other device has ever heard of.
  Unreachable by construction.

---

## 2. The four layers, and what each costs to move

| Layer | Local store | Per photo | In cloud today | Needed for the test |
|---|---|---|---|---|
| **Gallery row** — id, name, dimensions, `originalKey`, thumb blob | `image-horse-gallery`, one blob | 10–40 KB (the WebP thumb dominates) | ✗ | **first** |
| **Original bytes** — SHA-256 content-addressed | `image-horse-originals` | 0.5–10 MB | ✗ | **second** |
| **Edit archive** — canvas PNG + *the whole undo and redo stack* as PNGs + annotations | `image-horse-edits` | 1–50 MB | ✔ `photo_edits` | third |
| **Op log + keyframes** | Dexie `opLogs` / `keyframes` | varies | ✗ | blocked, §6 |

Two things fall straight out of that table.

**The manifest cannot be synced in the shape it is in.** It is a single
IndexedDB value — `{ photos: PhotoEntry[], activeId, savedAt }` under one key.
A single blob has no per-row version, so merging two devices means whole-list
last-writer-wins, which means the Pixel's add deletes the ThinkPad's add. The
list has to become rows before any cloud work is worth starting. That is
Phase 0, and it is entirely local.

**The expensive layer is already the one syncing.** The archive carries every
undo step as a separate PNG. Twenty steps on a 12 MP image is comfortably
100 MB — for one photo. Today that lands in a quota nobody enforces (§5).
Cross-device sync turns it from a per-device cost into a per-account one.

---

## 3. Five decisions

### 3.1 Identity — keep the id, content-address the bytes

Photo ids are minted `${Date.now()}-${Math.random().toString(36).slice(2)}`
(`app/AppShell.tsx:728`). That is already unique enough to be a sync id. The
change is not the format — it is that **the receiving device must adopt the id
it is given and never re-mint it.**

Blobs are the opposite: address them by content. `originalKey` is already the
SHA-256 of the bytes, so a Convex `originals` table keyed `(userId, sha256)`
gives free dedupe — the same photo in two galleries, or re-uploaded after a
reconcile, costs one stored file and a refcount bump.

Deliberately *not* doing: collapsing two devices' independent adds of identical
bytes into one row. Keep wouldn't (two notes stay two notes), and merging them
would silently discard one device's edits.

### 3.2 Deletes are tombstones — and absence is never one

Every row carries `deletedAt?: number`. A delete sets it; it never removes the
row until a sweep well past any plausible offline window.

> **INVARIANT: a device that finds a row locally missing must never write a
> delete for it.** Only an explicit tombstone deletes.

This is not hypothetical caution. The app has already lost a gallery to exactly
this inference, locally, on 2026-07-11 — the comment at `app/AppShell.tsx:1226`
is the scar, and it forbids inferring deletion from a non-empty → empty
transition because dev-server churn drove one. Sync raises the blast radius of
that bug from one device to every device. The Safari path is the live version:
IndexedDB evicted after seven idle days, the app reopens, finds nothing local,
and — without this invariant — tombstones the account.

**Consequence for "Start fresh" and "Delete all".** Today they clear local
storage. Once rows sync, "clear local" and "delete everywhere" are different
operations and the current buttons mean the first. They keep meaning the first,
and deleting from all devices becomes its own explicitly-worded action. This
area already produced one bug about a confirm disagreeing with the button that
opened it (v8.73) — it gets the careful wording, not the convenient default.

### 3.3 Conflicts — LWW on metadata, conflict copies on pixels

| What | Rule | Why |
|---|---|---|
| Name, order, dimensions, thumb | Per-field LWW on `updatedAt` | A rename losing to a later rename costs nothing |
| Delete vs. edit | Newer wins; an edit newer than the tombstone resurrects the photo | Matches the user's last expressed intent |
| **Edit archive** | **Conflict copy** | Two devices editing the same photo offline produce genuinely divergent documents with no merge. LWW here silently destroys work. The loser becomes a new row — *"Horse (edited on pixel-5)"* — and both survive |

Conflict copies are what Keep does, and they are the only honest answer while
the pixels are an opaque archive. §6 is the version where they mostly stop
happening.

### 3.4 Local-first stays the rule, via an outbox

The existing invariant is stated at length and in capitals in
`useEditPersistence.ts:340-360`: write locally first, always, because a Convex
mutation against an unreachable deployment *hangs* rather than rejecting, and a
hang never reaches a `catch`. That code once wrote a user's edit precisely
nowhere. Sync does not get to relax it.

So: **every mutation writes IndexedDB, then appends to a local outbox table. A
flusher drains the outbox when online and authenticated.** Never the reverse
order, and no user-visible action ever awaits the network. Logged-out stays a
fully supported path — the outbox simply accumulates, and signing in flushes it.

The outbox also fixes a parked defect. `lastUploadedRef` is a `useRef`, so the
sync record is session-lived and per-tab (`docs/PARKING_LOT.md:1793`) — a reload
re-uploads everything, and two tabs duplicate each other's work. As a durable
Dexie field it becomes correct, which the parking-lot entry already anticipates
as "a dexie-migration decision".

### 3.5 The pull direction is already built

Convex `useQuery` is a websocket subscription: a mutation on the Pixel re-runs
the ThinkPad's query and pushes the result, with no poll and no cursor. Rule 1
from Keep costs one hook. `usePreferences` is the working proof.

What still has to be written is the *reconcile*: merging arriving rows into the
local Dexie tables under the rules in 3.2 and 3.3.

---

## 4. Phases

Each ships alone and is useful alone.

### Phase 0 — the list becomes rows *(local only, no cloud, no UI change)*

Adopt the Dexie `photos` table as the gallery list and retire the single-blob
manifest behind a read-through migration.

The table already exists — `PhotoMeta`, shipped in Dexie schema v1 — and is
described in `lib/dexie/db.ts:5` as "the parallel, not-yet-adopted layer" that
real photos have no rows in. This phase is what adopts it. Add `updatedAt`
(present), `deletedAt`, and a `syncedHash`.

Zero user-visible change. That is the point: the riskiest data movement in the
plan happens with nothing else in flight.

### Phase 1 — the list syncs *(the test half-passes)*

New Convex table `gallery_photos`, keyed `(userId, photoId)`, carrying only the
small fields plus the thumbnail. Reactive pull, outbox push.

A row whose bytes are not on this device renders as a **placeholder tile** — real
name, real thumbnail, dimmed, with a "download" affordance.

At 8:32 the ThinkPad now shows four tiles, the fourth one a placeholder. The
photo is visibly *there* a second after the Pixel adds it. Everything expensive
is still deferred.

### Phase 2 — the bytes follow *(the test passes)*

Convex `originals` table keyed `(userId, sha256)` → `_storage` id, refcounted by
the gallery rows that reference it, quota-enforced in the same mutation that
mints the upload URL (§5). Download is lazy — a placeholder tile fetches on
click — with an opt-in "keep this gallery on this device" for eager fetch.

Refcounting is also the garbage collection the app conspicuously lacks: the
existing storage sweep is a single best-effort `discardFailedUpload` on an error
path, written after 3,535 MB of orphans exceeded the Convex free plan on
2026-08-05 and disabled every deployment on the account.

### Phase 3 — edits follow, with conflict copies

Extend `photo_edits` with `version` and `baseVersion`; a save whose `baseVersion`
is behind the server's `version` becomes a conflict copy rather than a
patch. **Prerequisite:** stop shipping the entire undo stack in the archive, or
the quota from §5 is spent on three photos.

### Phase 4 — many tabs, one leader

`MultiTabScreen` exists because two tabs write the same IndexedDB and the loser
is overwritten with no warning (`hooks/useTabClaim.ts:13`), and because a stale
tab holding the database open blocks the next Dexie upgrade indefinitely. Both
reasons are real and neither is about *sync*.

With per-row versions and an outbox, tabs on one device stop needing a lockout
and start needing a **leader**: one tab holds a `navigator.locks` lease, owns the
engine and the outbox flusher, and the others run as live viewers off the same
reactive query. If the leader closes, the lock releases and another tab takes
over.

This is the user's opening question — "not have the app open in more than one
tab, but maybe this is not important". It is not important *first*. It becomes
easy once Phases 0–1 exist, and it is the wrong thing to attempt before them.

### Phase 5 — op-log sync *(someday; currently blocked)*

The end state is shipping op-log chunks rather than archives: ADR-006 already
establishes truth = original + op log with the render cache disposable, the
chunks are append-only and immutable, and `generation` already detects a
branched history. That is a sync protocol in all but name, and it would make
conflict copies rare instead of routine.

**It cannot carry sync today.** ADR-052: the log records six of sixty-seven
operations. A device replaying a peer's log would reconstruct a document missing
most of the edits. Phase 5 is blocked on closing that gap, and saying so is more
useful than designing against a log that does not yet describe the document.

---

## 5. The quota is advertised and enforced nowhere

`TIERS` promises 100 MB signed-in and 5 GB paid (`lib/tiers.ts:21,62,73`).
`storageQuotaBytes` has **four occurrences in the codebase and all four are in
that file.** Nothing reads it.

That is survivable while only edited photos upload archives. It stops being
survivable the moment originals go up on every add. 100 MB is roughly 25
twelve-megapixel JPEGs before a single edit archive — which is a real product
constraint that has to be visible in the UI, not a number discovered when
writes start failing.

**Phase 2 does not ship without server-side enforcement in the upload-URL
mutation, and a storage meter in the StatusBar.** The account has already been
taken down once by unbounded Convex storage.

---

## 6. Pre-mortem

**The echo loop.** A pull triggers a local write, which the outbox reads as a
change, which uploads, which pushes to every device, which pulls. The quota goes
in an afternoon and it is 2026-08-05 again. *Mitigations, in depth order:*
content-addressed blobs make a redundant upload a refcount bump rather than a
new file; the archive hash-skip already exists (`useEditPersistence.ts:489`); the
rate limiter already exists; and the outbox must stamp `syncedHash` durably —
which is the parking-lot fix in 3.4, and it is load-bearing here rather than
merely tidy.

**The eviction wipe.** Safari evicts IndexedDB after seven idle days. The app
reopens, finds an empty local gallery against thirty cloud rows, and a reconcile
that treats local absence as a delete tombstones the account from the one device
that lost its data. *Mitigation:* the invariant in 3.2, which is why it is
written as an invariant and not a guideline. This is the failure that ends the
plan, and it is one `if` away at all times.

**The silent divergence.** Two devices edit one photo offline. LWW picks one and
the other's afternoon is gone, with no error and nothing in the Diagnostics
window. *Mitigation:* conflict copies (3.3), plus a Diagnostics line whenever one
is minted.

**The stalled flusher.** The outbox accumulates behind one permanently-failing
row and the user believes they are synced. *Mitigation:* the sync indicator
reports the outbox depth and the oldest unflushed age, and a row that fails
repeatedly is parked and reported rather than retried forever.

---

## 7. Not in scope

- **Real-time collaborative editing.** Two people in one document is a different
  product with different primitives. This is one person's devices agreeing.
- **Sharing galleries between accounts.** `shares` already covers read-only
  snapshot links.
- **Syncing the anonymous tier.** No account, nothing to key on. Logged-out
  stays fully local and fully supported.
- **Migrating the unused `images` / `projects` / `layers` / `annotations` Convex
  tables.** They predate the current editor and nothing writes them — the
  `ai_jobs` comment in `convex/schema.ts` calls `images` unused outright. Phase 1
  adds a new table rather than resurrecting them, and retiring them is its own
  cleanup.

---

## 8. Open questions

1. **Does a placeholder tile count against the gallery cap?** `galleryLimit` is
   12/24/100 and also lives in Rust (`photo_limit`). A 100-photo paid account
   syncing to a phone means 100 rows the phone must render and cap-check. Likely
   answer: the cap counts rows, and phones fetch bytes lazily — but it needs
   deciding before Phase 1, not after.
2. **What is the sync unit for a rename?** The row, or the field? Per-field LWW
   needs per-field timestamps, which is a wider row for a case that may never
   matter. Start with per-row and revisit if renames actually collide.
3. **Does the thumbnail belong in the row or in storage?** In the row it is
   simple and makes Phase 1 self-contained; at 40 KB × 100 photos it is 4 MB in
   the document store, which Convex will not love.
