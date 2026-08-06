# Content-addressed GC — does anything still strand?

Measured 2026-08-06. The sweeper was always conditional: build it only if
orphans accumulate. This is the measurement that decides.

## Verdict so far: the cloud half is clean, the local half is unmeasured

| Half | Number | Verdict |
|---|---|---|
| Convex `_storage` orphans | **0** | clean |
| Local IndexedDB (`__ihContentAudit`) | not run | **OPEN — needs Chris** |

One of the two numbers is in. The cloud side shows nothing stranding at all.
The local side cannot be measured from an agent session — see below — so the
item is **not closed yet**.

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
plus the delete cascade — is not stranding anything. That is the path that has
actually been exercised, and it is clean.

It does **not** exercise two cascades, because their tables have never held a
row: `shares` (0 rows) and `ai_jobs` (0 rows). `ai_jobs` is the wider surface —
it carries **three** storage fields (`inputStorageId`, `maskStorageId`,
`outputStorageId`), so it has three ways to strand a file and none of them has
ever run in anger. A zero here is the absence of evidence, not evidence of
absence, and it should be re-measured once AI jobs and shares see real use.

## Why the local number isn't here

`installContentAudit()` is gated behind `import.meta.env.DEV || webgpuEnabled()`
(`app/src/main.tsx:24`), so `window.__ihContentAudit()` is absent from a default
production build. More fundamentally, the audit reads **real IndexedDB data
after real use** — that lives in Chris's own browser profile, not in an agent's
throwaway tab. A run against a fresh profile would return a clean zero that
means nothing.

To produce it: open the app in the profile you actually edit in, then run
`window.__ihContentAudit()` from the console (dev server, or a build with
`ih_webgpu` on). Record the unreachable count here.

## If it comes to building the sweeper

The starting point is the parked `cleanupOrphanedStorage.ts` (121 lines, in a
session scratchpad). It already scans all four root tables —
`photo_edits.storageId`, `shares.storageId`, `ai_jobs`'s three fields, and
`images.storageId` — including `images` even though that table is empty, rather
than assuming it stays empty. That is the right instinct: a sweeper that checks
only the tables with rows today deletes files the moment another table gains
one.

## Recommendation

Close on **"collect at the source, no sweeper needed"** once the local number
lands and is also at or near zero. Three of the three named generators are now
closed at the source — `handleAutoCompress` by the refcount guard, photo-delete
by the cascade, failed pointer writes by `discardFailedUpload` in v7.68
(`useEditPersistence.ts:311,596`) — and the cloud measurement agrees with that
story.

Re-open only if `shares` or `ai_jobs` start carrying real volume, since those
cascades remain untested by data.
