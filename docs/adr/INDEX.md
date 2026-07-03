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

<!--
  Planned (from ~/claude-runs/PERSISTENCE_RUNS.md), not yet written:
  - service worker, precache-only                          (Night B)

  NUMBERING NOTE: the PERSISTENCE_RUNS runbook labelled the originals ADR
  "ADR-007", but docs/adr/ started empty here — there are no ADRs 001-006.
  Per the adr skill (next sequential number), it landed as ADR-001, the real
  next number in this tree. Night B's service-worker ADR should follow as
  ADR-002, NOT ADR-008 — ignore the runbook's numbering.
-->
