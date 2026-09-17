# Cross-device sync — what the code does today

**Step 0 of the sync scaffold. Read-only: nothing in this pass changed behaviour.**
Written 2026-09-16 against master `99e89b76`. Every number below is measured or
read out of the code, not estimated — where something is derived it says so.

---

## 1. What `savePhotoEdit` persists, and how big it is

### It persists PIXELS. Several times over. There is no op log in it.

There are **two** `savePhotoEdit`s and conflating them is the first trap:

| | Where | Writes to |
|---|---|---|
| `lib/editPersistence.ts` | the real one | **IndexedDB**, key `edit-<photoId>` |
| `hooks/useEditPersistence.ts` | the wrapper | IndexedDB **first**, then Convex |

The wrapper is local-first on purpose, and the comment above it is load-bearing
history: it used to try the cloud first and keep the local write in the `catch`,
which is only safe against a *rejection*. `generateUploadUrl()` can **hang** when
the deployment is unreachable — neither resolving nor rejecting — and a hang never
reaches a catch, so the local save never ran and the edit was written **nowhere**.

### The shape

`SavedEdit` (`editPersistence.ts:338`) holds:

| Field | What it is |
|---|---|
| `canvasPng` | the whole composited canvas, **PNG** |
| `undoStack: SnapEntry[]` | each entry is **a full-canvas PNG** |
| `redoStack: SnapEntry[]` | same |
| `layers: PersistedLayer[]` | each layer carries **its own full PNG** |
| `annotations`, `shapes` | vector, JSON, small |

The cloud copy is the same data through `encodeArchive` (`useEditPersistence.ts:49`)
— a length-prefixed binary blob, `MAGIC 0x49485354`, **VERSION 5** — uploaded to
Convex file storage. So the cloud stores one opaque archive per photo, not rows.

### Measured, not guessed

Production `edit.imagehorse.app`, one sample photo, **one** preset applied:

| | |
|---|---|
| Canvas | 1385 × 2068 = **2.9 MP** |
| `canvasPng` | 4,387 KB |
| Undo stack (**1** step) | **5,506 KB** |
| Layers (2) | 4,448 KB |
| **Archive total** | **≈ 14 MB** |
| **Cost per additional undo step** | **≈ 5.5 MB** |

⚠️ **That is 14 MB after a single click, on a 2.9 MP photo.** Phone cameras
shoot 12 MP, roughly 4× the pixels. The caps that bound this are
`DEFAULT_MAX_HISTORY = 50` steps and `DEFAULT_MAX_HISTORY_BYTES = 512 MB`
(`src/settings.rs:10,21`), and the byte cap binds long before the step cap — at
5.5 MB/step a 2.9 MP photo would reach ~50 steps around 275 MB, and a 12 MP one
hits 512 MB in roughly a dozen.

**This is the single fact that should drive the sync design.** Any scheme that
ships a whole archive per revision is moving tens of megabytes per edit per
device. Options worth costing in the ADR: sync only `canvasPng` + vectors and
let history stay device-local; or make history a real op log (see §2) and sync
that instead, which is orders of magnitude smaller but is a much bigger job.

---

## 2. What is NOT in the op log

The op log is **`OP_FORMAT_VERSION 6`** as of #130. The engine has **88 `snap()`
call sites** across `src/*.rs` (31 in `lib.rs` alone) — 88 user-visible
operations — against a far smaller set of recorded ops.

### Verified unrecorded — the body pushes no `Op`

| Operation | Pushes an Op? |
|---|---|
| `adjust_brightness` | **no** |
| `adjust_contrast` | **no** |
| `adjust_saturation` | **no** |
| `adjust_shadows` | **no** |
| `adjust_highlights` | **no** |
| `adjust_sharpen` | **no** |
| `flip_horizontal` | **no** |
| `resize_canvas` | **no** |
| `apply_pixelate` | **no** |
| `rotate_90` | yes (1) |

All six tonal adjustments `snap()` and write straight into the layer buffer.
**Presets are deliberately unrecorded too** (ADR-055) — `apply_stack` calls those
same filters, so a preset inherits their silence by construction.

### The consequence is sticky within a session

Nothing corrupts: ADR-013's composite-hash check catches the desync on the next
undo and falls back to snapshot undo. But `oplog_broken` is reset **only** on
document load/restore, so **one Brightness nudge ends op-log undo for that
document for the rest of the session** — and the fallback is the 5.5 MB/step
snapshot path measured above.

### Pixel-path perspective vs the vector path

#130 added `Op::ShapePerspective` and `Op::TextPerspective`, so warping *an
object you drew* is recorded. Warping **pixels** goes through
`Op::PerspectiveWarp`, which is also recorded. ⚠️ Note for whoever greps next:
`ShapePerspective` looks unproduced if you search outside `ops.rs` — it is
emitted from `annotation_sync_ops` **inside** `ops.rs` (lines 547, 552), the
function #130 moved out of `lib.rs`.

`Op::FillRegion` still has **zero producers** — pickaxe-verified never wired
(ADR-052), and it is not a dormant recorder for the adjustments: it cannot
express an additive brightness shift or a cross-channel saturation lerp.

---

## 3. What Convex and file storage already do for a signed-in user

### Wired and called from the app

| Convex module | Used for | Files? |
|---|---|---|
| `photoEdits` | **the per-photo archive** — `save`, `getEdit`, `remove`, `clearAll`, `discardFailedUpload` | ✅ `_storage` |
| `shares` | share links, view counts | ✅ |
| `ai` / `aiJobs` | rembg / inpaint via Replicate | ✅ |
| `users` | profile, tier, settings blob | — |
| `textHistory`, `userColors` | recent text, saved swatches | — |
| `subscriptions`, `stripe` | billing | — |

`photoEdits.save` (`convex/photoEdits.ts`) is upsert-by-`(userId, photoKey)` and
**deletes the previous file** on overwrite. There is exactly one row per photo
per user and **no history, no revision, no device column**.

### Declared but unused by the editor

`projects`, `images`, `layers`, `annotations`, `history` are in the schema with
indexes, and the app calls **none** of them — no `api.projects.*` or
`api.images.*` appears anywhere in `app/src`. They are an earlier design's
tables. A sync schema should decide explicitly whether to adopt or tombstone
them rather than leave a second half-built model alongside the new one.

### Everything is gated behind `requireUser`

`photoEdits` calls it 6 times. Nothing syncs for a signed-out user, which is
consistent with demo mode being the default path.

### ⚠️ Three findings that affect the plan

1. **Production Convex is EMPTY.** Every table on `pastel-alligator-180`
   reports `inferredSchema: Never` — zero documents, including `users`. Nobody
   has ever signed in on production. There is no data to migrate, which makes
   this the cheapest possible moment to change the schema.

2. **Production runs an OLDER function set than dev.** Prod has no `shares.js`,
   and no `shares` / `session_edits` / `user_colors` / `userProfiles` tables,
   all of which exist in dev. This is the known "Convex functions never
   auto-deploy" drift — and it is exactly what step 5 of the plan
   (`convex deploy` in CI) exists to stop.

3. **Local rev tracking already half-exists.** `useEditPersistence` keeps a
   `lastUploadedRef` (photoId → hash of the last archive synced) and an
   `attemptSeqRef` (photoId → sequence number of the newest started save, so a
   deferred retry drops itself rather than writing stale bytes). Both are
   `useRef` and **session-lived** — a reload re-uploads once per photo. That is
   a revision counter and a single-writer guard in everything but name, and the
   scaffold should promote them rather than invent a parallel mechanism.

---

## 4. ⚠️ STOP CONDITION HIT — undo is not durable

> **RESOLVED 09-16 by PR #161 (`2e6c5f32`), after this section was written.**
> The gate this section raises is cleared and sync work may proceed. The
> section is kept as written, because the reasoning below is what found the
> bug and one paragraph of it turned out to be wrong — see *What actually
> fixed it* at the end.

**This outranks the sync plan, and it is not a sync bug. It was live on
production when this was written.**

PARKING_LOT's flush-path entry says *"Undo still shows the right pixels, so
nothing is lost."* That is true **within a session** and false **across a
reload**. Measured on `edit.imagehorse.app`, production, twice (Vivid, then
Warm), on a 1385×2068 sample photo:

| Step | Screen | Archive on disk |
|---|---|---|
| Apply preset | `8ed2e567` | `5b389c67` — written ✅ |
| **Ctrl+Z** | **`77686a30`** — undo visibly worked | `5b389c67` — **unchanged** |
| Wait 35 s | `77686a30` | `5b389c67` — still unchanged |
| **Reload → Resume editing** | **`8ed2e567`** | — |

**The reload silently put the undone edit back.** The user pressed undo, saw it
work, reloaded, and got the change they had just removed.

### It is not a stale-pixel capture. No save fires at all.

`window.__ihSaveGuard()` counts every archive write. Across a clean run:

| | `allowedKnown` | Δ |
|---|---|---|
| Baseline | 1 | — |
| After applying a preset | 2 | **+1** |
| After Ctrl+Z (+8 s) | 2 | **0** |

`refused` stayed **0** throughout, so this is not the ownership guard declining
the write — the autosave never asks. Final state of that run: screen
`77686a30`, archive `b6cb4374`, two different documents.

### Why the debounce does not explain it

`useImageSession.ts:256` returns early unless `dirtyRef.current`, and that is
`undoCount > 0 || hasBeenModified || layerRevision > 0`. After an undo
`hasBeenModified` is still true — the comment at line 264 notes it "cannot
re-trigger once true" — so **dirty is true and the guard is not the cause
either**. `autosaveDelayMs` returns 300 ms or 2500 ms, so a 35-second silence
is not a long timer. The effect's dependency list includes
`stamp.state.undoCount`, which *does* change on undo. Something between that
effect firing and `savePhotoEdit` being called is dropping the write, and the
next step is to instrument those four lines rather than reason about them.

### Why no gate catches it

Same shape as the flush-path entry: `saveOwnership.test.ts` drives
`savePhotoEdit` directly, and the Rust tests drive the engine directly.
**Nothing exercises edit → undo → reload.** Vacuous-checks family 3 — the
observation was never taken.

### What it means for sync

A sync engine replicates **the archive**, not the screen. So on the evidence
above, sync today would faithfully copy the *un-undone* document to the second
device — and the first device would get it back on its next pull. Two devices
disagreeing with the user instead of one.

**This has to be fixed and covered by a test before any sync code is written.**
It is also worth fixing regardless of sync: it is silent, it is on production
now, and it costs the user work they explicitly asked to discard.

### What actually fixed it — and the paragraph above that was wrong

PR **#161** (`2e6c5f32`), merged 09-16. Both conditions are met: fixed, and
covered by a test that fails against the old rule.

⚠️ **"Why the debounce does not explain it" reasons from a false premise.** It
argues the early return cannot be the cause because `hasBeenModified` is still
true after an undo. A probe said otherwise: `hasBeenModified` read **false**
during editing, so the early return *was* the cause. The lesson is the one this
audit keeps finding — take the observation, do not reason about the code from
a comment.

The dirty rule had no way to tell *edited back to where it was saved* from
*never edited*. Undoing to zero made `undoCount === 0`, the session read as
clean, and no write was asked for. The fix compares against the undo count at
the moment of the last successful write:

| | Old rule | New rule |
|---|---|---|
| Never edited | clean | clean |
| Edited, unsaved | dirty | dirty |
| **Undone back to zero after a save** | **clean — the bug** | **dirty** |

`app/src/lib/dirtyRule.test.ts` pins it in 11 cases; reverting the old rule
turns **3** of them red. The count is captured *before* the `await`, so a save
that lands late cannot record a number the session has already moved past.

**For sync this matters more than it looks.** The archive is now consistent
with what the user sees, which is the precondition for replicating the archive
rather than the screen. Without it, §"What it means for sync" above stands.

---

## What this implies for the ADR (step 1)

Not decisions — the questions step 0 says are now answerable:

- **Snapshot-per-rev of *what*?** A 14 MB archive per revision is not viable
  over the wire. Either history stays device-local, or the op log gets the
  missing producers first.
- **`opFormatVersion` gate** has a real number to gate on: **6**.
- **Single writer + conflicted copy** has a foothold already: `lastUploadedRef`
  / `attemptSeqRef` need to become durable and device-scoped.
- **The empty prod database is a one-time window.** Schema changes that would
  normally need a migration currently need none.
