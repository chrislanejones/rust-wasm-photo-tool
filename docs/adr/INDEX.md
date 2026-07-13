# Architecture Decision Records

Why the load-bearing, hard-to-reverse decisions were made the way they
were. New ADRs land as **Draft** (a proposal for review) and are flipped
to **Accepted** / **Rejected** by a human. Procedure + template:
`~/.claude/skills/adr/SKILL.md`.

Numbers are sequential and permanent — a superseded ADR keeps its number
and gains a `Superseded by ADR-NNN` status; it is never renumbered or
deleted.

> **Status audit (2026-07-09, against v7.8 / `d9960f6`):** every ADR
> below was checked against actual git history and code (grep, not
> assumption) — see each file's added status line for the evidence,
> and `SESSION_LOG.md` on the `docs/adr-status-audit` branch for the
> full trail. This audit **supersedes** the 2026-07-07 review note
> that used to live here. Four flagged verified-shipped were confirmed
> Accepted by Chris the same day. Note also: 003/004 (op-log / tile
> buffer) merged to master later on 2026-07-09 as feature-gated,
> off-by-default code (fast-forward, `1703670`) — that's a merge, not
> a wiring, so they correctly stay Draft/blocked below.

| ADR | Title | Status | Date |
| --- | ----- | ------ | ---- |
| [000](000-template.md) | Template (not a decision) | — | — |
| [001](001-originals-lazy-migration-to-dexie.md) | Originals store: lazy read-through migration to Dexie | Accepted (2026-07-09) — shipped v7.5 (`6ccd67b`) | 2026-07-02 |
| [002](002-tool-module-registry.md) | Canvas tools become registry modules instead of hand-wired hooks | Draft — blocked (Stage 4 not started; AppShell still hand-wires 8 tool hooks) | 2026-07-02 (backfilled) |
| [003](003-operation-log-undo.md) | Operation log replaces snapshot undo | Draft — IMPLEMENTED on `feat/tile-wiring-oplog-undo` (recorder + replay undo live behind `ih_oplog_undo`, engine-parity green); ready to Accept when it ships | 2026-07-02 (backfilled) |
| [004](004-tile-buffer.md) | 256×256 tiles become the canonical image representation | Draft — flush path reads through TileBuffer on `feat/tile-wiring-oplog-undo` (single-layer scope, behind `ih_tiles_flush`); canonical-representation claim still partial | 2026-07-02 (backfilled) |
| [005](005-codec-worker-fallback.md) | Encoding and thumbnailing move to a worker, with mandatory main-thread fallback | Accepted (2026-07-09) — shipped v7.7 (`906082b`) | 2026-07-02 (backfilled) |
| [006](006-render-cache-disposable.md) | Working copies become a disposable render cache; truth is original + op log | Draft — code COMPLETE on `feat/persist-oplog-complete` (Dexie v2 + write/restore + log-identity binding + stale-log retirement, kill switch OFF); blocked on the real-gallery dogfood check listed in the ADR | 2026-07-02 (backfilled) |
| [007](007-overnight-worktree-runs.md) | Unattended agent runs happen on disposable worktrees in auto mode | Accepted (2026-07-09) — matches standing practice | 2026-07-02 (backfilled) |
| [008](008-svg-rasterized-at-import.md) | SVG imports are rasterized to PNG at the import boundary | Accepted (2026-07-09) — shipped v7.8 (`d9960f6`) | 2026-07-07 |
| [009](009-coop-coep-clerk-spike.md) | COOP/COEP vs. Clerk sign-in spike | Draft — spike, not a build; verdict: not blocked | 2026-07-09 |
| [010](010-metadata-scrub-privacy-modes.md) | Export metadata scrub gets a GPS-only mode alongside the existing full strip | Draft | 2026-07-10 |
| [011](011-parallel-kernels-rayon-threads.md) | Parallel kernels via wasm-bindgen-rayon, gated on COOP/COEP | Draft | 2026-07-10 |
| [012](012-oplog-document-model.md) | The op log replays over a document (pixels + live annotation lists), not the flattened composite | Draft | 2026-07-11 |
| [013](013-oplog-undo-hash-fallback.md) | Op-log undo activates behind a composite-hash sync check, with snapshot fallback | Draft | 2026-07-11 |
| [014](014-magnetic-lasso-smart-brush-cost-map.md) | Magnetic lasso and Smart Brush both stand on one shared edge cost map | Draft — kernels tested + wired behind `ih_smart_edge` (default OFF); needs a human canvas check of the FEEL | 2026-07-13 |

<!--
  Planned:
  - service worker, precache-only → takes the next free number
    (014+) when written.
-->
