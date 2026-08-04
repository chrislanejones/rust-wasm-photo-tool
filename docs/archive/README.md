# Archive — superseded docs

Kept, not deleted. Everything here was accurate when it was written and is not any more, so it stays out of the [main index](../../README.md) — but the reasoning in these files is often still the best record of *why* something ended up the way it did.

**Nothing in here is a reference.** If a statement in an archived doc contradicts the live docs or the code, the code wins. Each file opens with a banner saying what specifically went stale.

| Doc | Retired | Why, and what's still worth reading |
| --- | --- | --- |
| [Service-Workers-Caching.md](Service-Workers-Caching.md) | 2026-08-04 | **The most wrong file here.** Its status line says "investigation only — no service worker ships today" and "nothing here is wired yet". Both were true when written; **Phase 1 and Phase 2 have since shipped.** The SW ships dark behind `__IH_SW_MODE__` (ADR-019, v7.41) and the Phase 2 update prompt is live as `UpdatePrompt.tsx`. Phase 3 (installable PWA) really is unstarted. The never-cache deny-list reasoning is still sound. |
| [State-Management.md](State-Management.md) | 2026-08-04 | Predates the AppShell split — names none of the five session hooks, and its §5 "`/zustand` blueprint (planned hook extraction)" describes a plan that was carried out differently. The store list and the `SetArg` migration pattern are still what the app does. |
| [IndexedDB-Investigation.md](IndexedDB-Investigation.md) | 2026-08-04 | An investigation, not a reference. Everything it argues for shipped: the Dexie content layer, the Zustand persist adapter, content-addressed originals. **Any schema change goes through the `dexie-migration` procedure, not this file.** |
| [Architecture-Roadmap.md](Architecture-Roadmap.md) | 2026-08-04 | Overtaken by the work actually done (AppShell decomposition, the Zustand stores, the engine-in-a-worker spike, the five-group toolbar). Treat its P-numbers as historical. Live planning is in [Engine-Roadmap.md](../Engine-Roadmap.md) and the [ADRs](../adr/INDEX.md). |
| [Refactor-Playbook.md](Refactor-Playbook.md) | 2026-08-04 | Not stale — **moved because it is a contributor playbook, not a visitor's question.** Still the canonical source for the single-source-of-truth conventions (colour / type / z-index tokens) that the CI `guardrails` job enforces; the checks themselves are in [CI.md](../CI.md). |
| [toolbar-migration-map.md](toolbar-migration-map.md) | 2026-08-04 | Working map for the five-group toolbar migration, shipped across v7.51–v7.53. |
| [Tool-Arc-Plan.md](Tool-Arc-Plan.md) | 2026-08-04 | Planning doc for the tool-registry arc. |
| [vector-tool-verdict-2026-08-01.md](vector-tool-verdict-2026-08-01.md) | 2026-08-04 | The merge-or-delete verdict on `feat/vector-tool`. Still the best worked example in this repo of deciding a decaying branch with measurements rather than vibes. The branch was deleted and preserved as the annotated tag `abandoned/vector-tool` on both remotes — see its Outcome section. |

## Two files that were merged rather than archived

`GitHub-Actions.md` and `CI-Guardrails.md` became **[CI.md](../CI.md)** on 2026-08-04. Same subject, two files, and they had drifted into contradicting each other — one said the local git hooks were "not yet installed" while the other documented them as installed, and the last section still told you to bypass `lefthook`, which this project rejected. Recoverable from git history if you want the originals.

## Also not here

Internal working notes — the security roadmap, the auth-misconfiguration write-up and two session audits — live in `docs/internal/`, which is **gitignored**. They are not in this repo. That was a deliberate call on 2026-08-04; the reasoning and its limits are recorded in `docs/PARKING_LOT.md`.

## Recovering an original

Nothing here was rewritten apart from the banner and the link depth, but if you want a file exactly as it was:

```bash
git log --follow --oneline -- docs/archive/State-Management.md
git show <sha>:docs/State-Management.md
```
