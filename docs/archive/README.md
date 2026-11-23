# Archive — superseded docs

Kept, not deleted. Everything here was accurate when it was written and is not any more, so it stays out of the [main index](../../README.md) — but the reasoning in these files is often still the best record of *why* something ended up the way it did.

**Nothing in here is a reference.** If a statement in an archived doc contradicts the live docs or the code, the code wins. Each file opens with a banner saying what specifically went stale.

| Doc | Retired | Why, and what's still worth reading |
| --- | --- | --- |
| [State-Management.md](State-Management.md) | 2026-08-04 | Predates the AppShell split — names none of the five session hooks, and its §5 "`/zustand` blueprint (planned hook extraction)" describes a plan that was carried out differently. The store list and the `SetArg` migration pattern are still what the app does. |
| [IndexedDB-Investigation.md](IndexedDB-Investigation.md) | 2026-08-04 | An investigation, not a reference. Everything it argues for shipped: the Dexie content layer, the Zustand persist adapter, content-addressed originals. **Any schema change goes through the `dexie-migration` procedure, not this file.** |
| [Refactor-Playbook.md](Refactor-Playbook.md) | 2026-08-04 | Not stale — **moved because it is a contributor playbook, not a visitor's question.** Still the canonical source for the single-source-of-truth conventions (color / type / z-index tokens) that the CI `guardrails` job enforces; the checks themselves are in [CI.md](../11-CI.md). |
| [toolbar-migration-map.md](toolbar-migration-map.md) | 2026-08-04 | Working map for the five-group toolbar migration, shipped across v7.51–v7.53. |
| [vector-tool-verdict-2026-08-01.md](vector-tool-verdict-2026-08-01.md) | 2026-08-04 | The merge-or-delete verdict on `feat/vector-tool`. Still the best worked example in this repo of deciding a decaying branch with measurements rather than vibes. The branch was deleted and preserved as the annotated tag `abandoned/vector-tool` on both remotes — see its Outcome section. |
| [FINDINGS-oplog-and-text-0919.md](FINDINGS-oplog-and-text-0919.md) | 10-05-2026 | The 09-19 overnight diagnosis of "a text edit loses its settings after a reload", plus the v7/v8 op-log fixture capture. It stopped at a format decision and left red tests behind for an attended session. That session happened: ADR-060 records the decision and #195 shipped the repair, so the red tests are green and its "next session" list is done. Still the best account of why the archive allowlist alone could not fix the bug. Moved from the repo root. |
| [UI_NIGHTS_09_15.md](UI_NIGHTS_09_15.md) | 11-18-2026 | The run report for UI Nights 9–15: gallery overlap, preview loading, Shared, Batch thumbnails and keyboard-reachable Settings. All of it shipped in v9.27. Its no-merge and pending-QC notes describe the review stack before that release. Still useful for why each fix took the shape it did. Moved from `docs/`. |
| [UI_NIGHTS_16_19.md](UI_NIGHTS_16_19.md) | 11-18-2026 | The plan and run report for UI Nights 16–19, loading skeletons for the surfaces Nights 9–15 missed. Nights 16–18 shipped in v9.28, Night 19 in v9.29. The "Not in these nights" table still says why the mobile boot spinner stayed. Moved from `docs/`. |
| [ui-state-v4/](ui-state-v4/07-audit.md) | 11-18-2026 | The document-state pass: the Night 7 audit with its screenshots in `evidence/`, and the v9.27 integration review. Merged as #348, shipped in v9.29. The rules it settled are in [UI_CONSISTENCY.md](../06.1-UI-Consistency.md). Moved from `docs/ui-state-v4/`. |
| [day-logs/2026-11-15.md](day-logs/2026-11-15.md) | 11-18-2026 | The 11-15-2026 day log: Find duplicates, Auto tone, rename tokens and Compare on the compact bar, one PR each, with screenshots in `day-logs/2026-11-15/`. All four shipped in v9.64, so its merge order and "When you're back" list are done. Its eight leftovers are now in [PARKING_LOT.md](../PARKING_LOT.md). Moved from `docs/day-logs/`. |

## Removed 11-23-2026

Nine files were deleted outright rather than kept here: nothing linked to them,
and what they said is either wrong now or already said better somewhere else.

| File | Why it went |
| --- | --- |
| `Service-Workers-Caching.md` | The most wrong file here: it said no service worker ships. One does, dark, behind `__IH_SW_MODE__` (ADR-019, ADR-049). |
| `Architecture-Roadmap.md` | Overtaken by the work actually done; the planning it did lives in the ADRs. |
| `Tool-Arc-Plan.md` | The plan for the tool-registry arc, which shipped. Its links pointed at a file moved out on 09-17. |
| `ui-state-v4/01`–`06` | Six short night records. The [audit](ui-state-v4/07-audit.md) sums them up and links each night's PR (#328–#333), which holds the same detail. |

Every one is still in git history: `git log --all --oneline -- docs/archive/<file>`.

## Two files that were merged rather than archived

`GitHub-Actions.md` and `CI-Guardrails.md` became **[CI.md](../11-CI.md)** on 2026-08-04. Same subject, two files, and they had drifted into contradicting each other — one said the local git hooks were "not yet installed" while the other documented them as installed, and the last section still told you to bypass `lefthook`, which this project rejected. Recoverable from git history if you want the originals.

## Also not here

Internal working notes — the security roadmap, the auth-misconfiguration write-up and two session audits — live in `docs/internal/`, which is **gitignored**. They are not in this repo. That was a deliberate call on 2026-08-04; the reasoning and its limits are recorded in `docs/PARKING_LOT.md`.

## Recovering an original

Nothing here was rewritten apart from the banner and the link depth, but if you want a file exactly as it was:

```bash
git log --follow --oneline -- docs/archive/State-Management.md
git show <sha>:docs/State-Management.md
```
