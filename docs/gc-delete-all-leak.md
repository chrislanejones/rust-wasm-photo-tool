# Delete All strands every original

**The content-addressed GC leak, found 2026-08-07.** Measured in the browser on
the deployed origin against Chris's own gallery, then confirmed in code.

`docs/content-addressed-gc-audit.md` names three suspected causes and marks the
compression-repoint one `[assumed]`. **All three suspicions were wrong, and the
real cause was not on the list.**

## The measurement

Deployed origin, real profile, 12 photos. Every path exercised one at a time,
with `livePhotos` checked before and after so a changing photo set could not
fake a result.

| Action | Dexie rows | Orphans | Orphan bytes | Verdict |
|---|---|---|---|---|
| Compress a fresh photo | 189 → 189 | 176 → **175** | **−183,798** | **reclaims** |
| Import | 189 → 190 | 175 → 175 | 0 | clean |
| Edit (Vivid) | — | 175 → 175 | 0 | clean |
| Delete one, unedited | 190 → **189** | 175 → 175 | 0 | **collects** |
| Delete one, edited | 190 → **189** | 175 → 175 | 0 | **collects** |
| **Delete All (12)** | **189 → 189** | **175 → 189** | **+113,880,359** | **STRANDS** |

Delete All in detail:

| Store | rows/reachable before | after |
|---|---|---|
| `image-horse-originals/originals` | 72 / **12** | 72 / **0** |
| `image-horse-dexie/originals` | 189 / **14** | 189 / **0** |
| `image-horse-edits/edits` | 2 / 2 | **0 / 0** |
| `opLogs` / `keyframes` | 67 / 32 | 67 / 32 |

**Row counts did not move.** 26 reachable rows became unreachable — nothing was
deleted, the pointers were just dropped. **+108.6 MiB from one click.**

Edit archives went to zero correctly, which is the tell: the handler collects
one kind of thing and not the other.

## The cause

`confirmDeleteAll` (`app/src/app/AppShell.tsx:1164`):

```
clearAllEdits()          ← collects edit archives ✓
clearWorkingCopyCache()
clearGalleryManifest()
setImageSavings({}) / setModifiedPhotos(new Set())
stamp.reset() / setPhotos([])
```

There is no `collectOriginals` call. The single-photo path has one, and says
why (`useImageSession.ts:518`):

> Collect the originals this photo pointed at — audit finding #2. The entry has
> to be read BEFORE setPhotos drops it, and the collection has to run AFTER, so
> the deleted photo no longer roots its own keys. Routed through the same
> reachability guard a repoint uses rather than deleting the two keys directly.

`confirmDeleteAll` does the `setPhotos([])` half and not the collect half. Two
paths for one operation, and only one of them was finished.

## What this corrects in the audit doc

| Doc says | Actually |
|---|---|
| Cause 2: compression repoints strand the previous blob — `[assumed]` | **Wrong.** Compressing *reclaims*: the new blob's content hash matched an existing orphan, making it reachable again |
| Cause 3: photo delete leaves op-logs behind | **Dormant, not active.** The op-log tables did not move across any action, including an edit. The artboard default gives every document two layers, and ADR-004 scopes the op log to single-layer documents — nothing writes those rows now |
| Cause 1: `image-horse-originals` is a dead legacy store, 0 of 72 reachable | **Wrong.** 12 live photos resolved into it during this session. It is content-addressed, so re-importing the same file makes an existing row reachable again. It is not dead, it is *cold* |
| "backlog or still growing?" left open | **Both.** The pre-existing 316.9 MiB is backlog — but Delete All actively adds to it |

## The fix

One call, mirroring the single-photo path: collect each photo's originals
through the reachability guard before `setPhotos([])` drops the roots. The guard
already exists and is already the right shape — `confirmDeleteAll` just does not
use it.

**Not written here.** This changes deletion of user data with no backup, which
is the one area where a wrong fix is unrecoverable. It wants its own session,
its own test, and a browser verification that rows actually drop.

## Reproducing it

```js
const g = (r,s) => r.classes.find(c => c.store === s);
window.__pre = (await window.__ihContentAudit()).report;
// … Delete All …
const a = (await window.__ihContentAudit()).report;
console.log(
  "rows", g(window.__pre,"image-horse-dexie/originals").total, "→", g(a,"image-horse-dexie/originals").total,
  "orphanBytes +", a.totals.allOrphanBytes - window.__pre.totals.allOrphanBytes,
);
```

Rows staying flat while orphan bytes climb is the signature. If rows drop, it is
fixed.
