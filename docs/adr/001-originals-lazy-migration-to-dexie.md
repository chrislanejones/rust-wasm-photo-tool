# ADR-001 — Originals store: lazy read-through migration to Dexie

- **Status:** Draft            <!-- Draft | Accepted | Rejected | Superseded by ADR-NNN -->
- **Date:** 2026-07-02
- **Deciders:** Chris (owner) — persistence / storage
- **Supersedes:** —

## Context

Original photo bytes live in a hand-rolled raw-IndexedDB store
(`app/src/lib/originalsStore.ts`, DB `image-horse-originals`, content-addressed
by SHA-256). It is **user data with no backup and no server copy** — a bad
migration destroys a user's gallery permanently.

We are standing up a typed Dexie layer (`app/src/lib/dexie/db.ts`) to own the
heavy binary data (originals, working copies) and the gallery metadata, for
first-class TypeScript, declarative versioning, and live queries. The Dexie
module has existed as a parallel, unused database since it landed; nothing
imports it. To make it real we must move the originals read/write path onto it
without a flag day and without a risky bulk rewrite of the existing store.

Constraints that force the shape of this decision:

- The legacy store must stay a **valid rollback target** — byte-identical,
  readable — for at least one release after we cut over.
- The two stores have **different record shapes**: legacy returns
  `StoredOriginal { bytes: ArrayBuffer, ... }`; Dexie stores `blob: Blob`. Every
  call site reads `.bytes`.
- Galleries can be large; a blocking boot-time copy of every original would
  stall startup and, if interrupted, leave a half-migrated mess.

## Decision

Route all originals access through a single adapter
(`app/src/lib/dexie/originalsAdapter.ts`) that migrates **lazily, per record, on
read** — read-through IS the backfill; there is no bulk migrator.

Shape of it:

- **getOriginal** tries Dexie first; on a miss it reads the legacy store and, on
  a hit, copies the bytes into Dexie under the same content-hash key
  (best-effort, idempotent), then returns them. A copy failure never fails the
  read — the legacy bytes are returned and the next read retries the copy.
- **putOriginal** writes to Dexie only. **deleteOriginal** deletes from **both**
  stores so a delete cannot resurrect via read-through. **listOriginals**
  returns the deduped union of both stores' keys.
- The adapter presents the **legacy `StoredOriginal` signature** (converting
  Dexie's Blob at the boundary), so the four/five call sites cut over by a pure
  import-path swap — no behaviour change. `db.ts`'s native Blob API is untouched
  for future gallery/working-copy work.
- A single kill-switch const, `USE_DEXIE_ORIGINALS` in
  `app/src/lib/dexie/flags.ts` (default `true`), routes everything back to
  legacy-only reads/writes — the runtime rollback.
- The legacy store is **never written** by the migration path (only read); one
  read-only `listOriginalKeys()` accessor was added for the union listing.

## Alternatives considered

- **Bulk boot-time backfill (copy the whole store on first run, gated by a
  `migratedToDexie` localStorage flag)** — the path originally sketched in
  `dexie/USAGE.md`. Rejected: a large gallery blocks or races startup; an
  interrupted run (tab closed mid-copy) needs careful idempotency and progress
  tracking; and it front-loads all the risk into one moment instead of
  amortising it. Read-through gets the same end state with none of the boot
  stall and a naturally crash-safe copy.
- **Swap call sites directly onto `db.ts`'s Blob-based `getOriginal`.** Rejected:
  it does not typecheck (call sites read `.bytes`, Dexie has `.blob`) and would
  be a behaviour change dressed as an import swap — exactly what we want to avoid
  on unbacked data. The adapter's shape-preserving boundary keeps the cut-over
  mechanical and reviewable.
- **Dual-write (write every new original to both stores) instead of
  Dexie-only + read-through.** Rejected: it keeps the legacy store *growing*,
  muddying the "legacy is frozen, read-only, a clean rollback" invariant, and
  doubles write cost and quota pressure for no rollback benefit read-through
  doesn't already give.
- **Big-bang replacement (delete legacy, Dexie only).** Rejected outright: no
  rollback, and on unbacked user data that is unacceptable.

## Pre-mortem (mandatory)

It is six months out and we are paged: users report **missing photos** after an
update. Most likely cause: a bug in the Dexie write/read path (a bad version
upgrade, a quota-eviction of the Dexie DB, or a serialization defect) makes
originals unreadable *from Dexie*.

What mitigates it, by construction:

- The **legacy store is byte-identical and never written** by this change. The
  originals still physically exist. Recovery is flipping
  `USE_DEXIE_ORIGINALS = false` and shipping — reads/writes fall straight back to
  the intact legacy store, no data reshaping, no restore step.
- The **best-effort copy** means a transient Dexie write fault degrades to
  "served from legacy, retried later" rather than a failed photo load.
- **Deletes hit both stores**, so the failure mode is never "a deleted photo
  reappears" (which read-through could otherwise cause).

Second scenario: someone ships the **legacy-deletion follow-up too early** and a
Dexie defect surfaces afterward — now there is no rollback. Mitigation: legacy
deletion is explicitly gated to a **separate future ADR, at least one release
after this ships clean** (see Consequences). Until then the kill switch is real.

The residual risk this ADR does *not* fully cover: a user who, after cut-over,
adds originals (Dexie-only) and then we roll back to legacy-only — those
Dexie-era originals are not in legacy. This is why the kill switch is an
**emergency** measure and why legacy deletion must wait: during the overlap
window, rolling back loses only originals created *after* the cut-over, and the
window is kept short by design.

## Consequences

Good:

- Cut-over is mechanical (import-path swap) and independently reversible.
- No boot stall; migration cost is amortised across normal use.
- The rollback is a one-line flag, provable in tests.

Costs / things to know before touching this area:

- **Two stores coexist** during the migration window. `listOriginals` unions
  them; anything that reasons about "all originals" must go through the adapter,
  not either raw store.
- **Rollback is only complete for pre-cut-over originals.** Originals written
  after cut-over live in Dexie only (see the residual risk above).
- **`db.ts`'s `getOriginal` (Blob shape) and the adapter's `getOriginal`
  (bytes shape) are different APIs on purpose.** Call sites use the adapter.

Follow-ups (NOT part of this ADR):

- **Legacy `image-horse-originals` deletion is a SEPARATE future ADR, to land at
  least one release after this ships clean** — only once telemetry/QC show the
  Dexie path healthy and the kill switch has not been needed. Deleting it earlier
  forfeits the rollback.
- Gallery manifest → `db.photos`, working-copy consolidation, and edit-history
  modelling are later steps (see `dexie/USAGE.md`), out of scope here.
- `imagehorse-qc` is required before the next release: persistence was touched.
