# ADR-027: Collecting originals uses a derived reachable set, not a stored refcount
Date: 2026-07-30   Status: draft   Records: v7.59 (shipped)

Written after the fact, recording the call made when fixing the only known
data-loss bug in the repo.

## Context

Originals are content-addressed: the key is the SHA-256 of the bytes, so
identical bytes are ONE blob with many referrers. `handleDuplicateSelected`
leans on that deliberately — a duplicated photo reuses its source's
`originalKey` for a zero-pixel copy.

Every compress path guarded its cleanup with `oldKey !== entry.uploadKey`, which
knows about the photo being compressed and nothing else. That produced real data
loss:

1. Import P → `originalKey = K`, `uploadKey = K`
2. Compress P → new blob N; guard holds (K is the baseline), K kept
3. Duplicate P → C shares `originalKey = N` **and** `uploadKey = K`
4. Compress C → `N !== C.uploadKey`, so the guard deleted N — **while P still
   pointed at it**

P's bytes gone, P's entry still referencing them, and no backup anywhere:
IndexedDB is the only copy.

Something had to decide "is this blob still needed?", and there are two ways to
know.

## Decision

**Derive the reachable set from the gallery at delete time. Do not store a
count.** All four repoint sites call one function,
`deleteReplacedOriginal` (`lib/originalRefs.ts`); no call site owns a delete
decision any more.

Reasons, in order of weight:

- **A stored count can drift; a derived set cannot.** A refcount has to be
  retrofitted onto every write site, and the moment one of them is missed the
  count is wrong in a way nothing detects — at which point it needs a repair
  path of its own, which is a second mechanism to get right.
- **It needs no schema change.** IndexedDB, no backup, and the `dexie-migration`
  skill governs any schema change. A derived set touches no stored byte.
- **It already existed.** The GC audit (`lib/contentAudit.ts`) computes exactly
  this mark phase to report orphans. The collector and the audit now agree by
  construction rather than by maintenance.
- **The precedent in the codebase is a count, and it is dead.** `db.ts`'s
  `deletePhoto` guards with `if (refs === 0)`, counting rows in the Dexie
  `photos` table — which the audit measured as **empty** in production, and that
  path is only ever called from tests. A count that is always zero is not a
  guard; it is a guard-shaped hole.

Three properties are part of the decision:

- **The gallery is read fresh** (`useGalleryStore.getState().photos`), never a
  render-time snapshot. Batch passes repoint many photos in a loop and a stale
  array can miss a reference added part-way through — invisible to the guard
  means deleted. Reading fresh also makes the batch case come out *right*: with
  two duplicates sharing a blob, the first pass keeps it and the second collects
  it.
- **Roots that live outside the gallery must be declared.** `BatchSettings` keeps
  each photo's pre-logo/pre-text baseline in a React ref so re-apply replaces
  rather than stacks; that key is in no manifest and no `PhotoEntry`. Those call
  sites pass it as `extraRoots`. Writing the guard as "check the gallery" would
  have introduced a NEW data-loss path by collecting them.
- **The bias is one-directional: when in doubt, KEEP.** Over-keeping leaves
  garbage the audit can measure and a future sweep can take. Over-deleting
  destroys a photo. A failing delete is swallowed for the same reason — garbage
  is recoverable, a thrown error mid-edit is not.

## Consequences

- Collection is O(live photos) per delete rather than O(1). At a 100-photo cap
  this is nothing.
- A future garbage collector is now safe to build on top: it is the same mark
  phase, and it inherits the `extraRoots` obligation — a sweep that reads only
  the manifest would collect the batch baselines and break re-apply.
- Auto Compress gained collection at the same time; it was the one repoint path
  with no delete at all, stranding a blob per run over an already-compressed
  photo.
- Deleting a photo still strands its originals. Deliberately not fixed with this
  change: that is the collector's first step and carries its own decision about
  whether the `uploadKey` A/B baseline dies with the photo.

## Alternatives rejected

- **Stored refcount on the original record.** Rejected above: schema change,
  four write sites to retrofit, drift with no detector, and a repair path.
- **Reference-counting table.** Same drift problem plus a second table to keep
  transactional with the first.
- **Never delete; let a periodic sweep do everything.** Attractive, and probably
  where this ends up — but it needed the guard to exist first, because the eager
  deletes were the data-loss path and a sweep layered on top would have left
  them in place.
