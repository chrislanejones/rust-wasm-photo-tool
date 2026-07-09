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
| [003](003-operation-log-undo.md) | Operation log replaces snapshot undo | Draft — blocked (merged to master `1703670` but feature-gated off; render path still snapshot-based) | 2026-07-02 (backfilled) |
| [004](004-tile-buffer.md) | 256×256 tiles become the canonical image representation | Draft — blocked (merged to master `1703670` but feature-gated off; render path still flat-buffer) | 2026-07-02 (backfilled) |
| [005](005-codec-worker-fallback.md) | Encoding and thumbnailing move to a worker, with mandatory main-thread fallback | Accepted (2026-07-09) — shipped v7.7 (`906082b`) | 2026-07-02 (backfilled) |
| [006](006-render-cache-disposable.md) | Working copies become a disposable render cache; truth is original + op log | Draft — blocked (depends on ADR-003) | 2026-07-02 (backfilled) |
| [007](007-overnight-worktree-runs.md) | Unattended agent runs happen on disposable worktrees in auto mode | Accepted (2026-07-09) — matches standing practice | 2026-07-02 (backfilled) |
| [008](008-svg-rasterized-at-import.md) | SVG imports are rasterized to PNG at the import boundary | Accepted (2026-07-09) — shipped v7.8 (`d9960f6`) | 2026-07-07 |
| [009](009-coop-coep-clerk-spike.md) | COOP/COEP vs. Clerk sign-in spike | Draft — spike, not a build; verdict: not blocked | 2026-07-09 |

<!--
  Planned:
  - service worker, precache-only → takes the next free number
    (010+) when written.
-->
