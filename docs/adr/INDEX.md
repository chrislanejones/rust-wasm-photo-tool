# Architecture Decision Records

Why the load-bearing, hard-to-reverse decisions were made the way they
were. New ADRs land as **Draft** (a proposal for review) and are flipped
to **Accepted** / **Rejected** by a human. Procedure + template:
`~/.claude/skills/adr/SKILL.md`.

Numbers are sequential and permanent — a superseded ADR keeps its number
and gains a `Superseded by ADR-NNN` status; it is never renumbered or
deleted.

| ADR | Title | Status | Date |
| --- | ----- | ------ | ---- |
| [000](000-template.md) | Template (not a decision) | — | — |
| [001](001-originals-lazy-migration-to-dexie.md) | Originals store: lazy read-through migration to Dexie | Draft | 2026-07-02 |
| [002](002-tool-module-registry.md) | Canvas tools become registry modules instead of hand-wired hooks | Draft | 2026-07-02 (backfilled) |
| [003](003-operation-log-undo.md) | Operation log replaces snapshot undo | Draft | 2026-07-02 (backfilled) |
| [004](004-tile-buffer.md) | 256×256 tiles become the canonical image representation | Draft | 2026-07-02 (backfilled) |
| [005](005-codec-worker-fallback.md) | Encoding and thumbnailing move to a worker, with mandatory main-thread fallback | Draft | 2026-07-02 (backfilled) |
| [006](006-render-cache-disposable.md) | Working copies become a disposable render cache; truth is original + op log | Draft | 2026-07-02 (backfilled) |
| [007](007-overnight-worktree-runs.md) | Unattended agent runs happen on disposable worktrees in auto mode | Draft | 2026-07-02 (backfilled) |
| [008](008-svg-rasterized-at-import.md) | SVG imports are rasterized to PNG at the import boundary | Draft | 2026-07-07 |

<!--
  Planned (from ~/claude-runs/PERSISTENCE_RUNS.md), not yet written:
  - service worker, precache-only (Night B) → takes the next free
    number when written (009+), not the runbook's old label.

  REVIEW NOTE (2026-07-07): 002-007 were imported from an external
  adr-bundle (drafted 2026-07-02, renumbered on import because 001
  already existed here). Several describe decisions that are PLANNED
  or live on unmerged branches rather than shipped on master today:
  003 (op-log undo — the engine still uses full-stack snapshot undo),
  004 (tile buffer — the tile engine is feature-gated and unmerged),
  006 (render-cache/op-log — depends on 003). Review before accepting.
  002 (registry migration, in progress), 005 (codec worker, shipped
  v7.7) and 007 (worktree runs, standing practice) match reality.
-->
