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
